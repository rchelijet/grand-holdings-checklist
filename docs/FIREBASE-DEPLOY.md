# Deploy Grand Holdings to Firebase App Hosting

This guide deploys the Next.js checklist app to **Firebase App Hosting** (not Classic Hosting). App Hosting runs the app on Cloud Run with SSR and API routes — the only viable Firebase path for this stack.

## Before you start

### Critical blockers

1. **Database:** Production uses **Turso (libSQL)** via `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` App Hosting secrets. Local dev uses a SQLite file at `data/grand-holdings.db` automatically when those env vars are unset. See [Turso setup](#turso-database-setup).

2. **PDF files on disk** (`data/form-pdfs/`) are still ephemeral on App Hosting — guest registration PDFs are written to the container filesystem and lost on redeploy. Database rows persist; PDF downloads may fail until you migrate PDFs to Cloud Storage (separate task).

3. **Blaze (pay-as-you-go) plan required.** App Hosting is not available on the free Spark plan. Upgrade at [Firebase billing](https://console.firebase.google.com/project/_/overview?purchaseBillingPlan=metered).

4. **Build must pass locally.** Run `npm run build` before deploying. Fix any TypeScript or build errors first.

### What you need from your side

| Item | Purpose |
|------|---------|
| Google account with Firebase access | Login and project ownership |
| Firebase project ID | Links CLI to your project |
| Blaze billing enabled | Required for App Hosting |
| `AUTH_SECRET` | Long random string for signed session cookies |
| `SMTP_PASSWORD` | Rotated SMTP credential for task email notifications |
| `TURSO_DATABASE_URL` | Turso libSQL database URL (production) |
| `TURSO_AUTH_TOKEN` | Turso database auth token (production) |

---

## Step 1: Install and log in to Firebase CLI

```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest login:list   # verify account
```

Requires **firebase-tools v14.4.0+** (current: 15.x).

---

## Step 2: Create a Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/) → **Add project**.
2. Name it (e.g. `grand-holdings-checklist`).
3. Enable **Blaze** billing when prompted.
4. Note the **Project ID** (e.g. `grand-holdings-checklist-a1b2c`).

---

## Step 3: Link this repo to the project

```bash
cd /Users/sachin/Projects/grand-holdings-checklist
cp .firebaserc.example .firebaserc
```

Edit `.firebaserc` and replace `YOUR_FIREBASE_PROJECT_ID` with your project ID.

Alternatively, run interactive init (creates/updates `firebase.json` and `.firebaserc`):

```bash
npx -y firebase-tools@latest init apphosting
```

When prompted:

- Select your Firebase project
- Backend ID: `grand-holdings-checklist` (must match `firebase.json`)
- Region: choose closest to staff (e.g. `europe-west1` for South Africa)
- Root directory: `/` (project root)
- Node.js runtime: latest LTS (Node 22 recommended)

---

## Step 4: Set secrets

Secrets are stored in Google Cloud Secret Manager — never commit them.

```bash
# Session signing key (generate a long random value, e.g. openssl rand -base64 48)
openssl rand -base64 48 | npx -y firebase-tools@latest apphosting:secrets:set AUTH_SECRET --project YOUR_PROJECT_ID --data-file -

# SMTP password (use your rotated credential, not the old leaked one)
printf '%s' 'YOUR_SMTP_PASSWORD' | npx -y firebase-tools@latest apphosting:secrets:set SMTP_PASSWORD --project YOUR_PROJECT_ID --data-file -

# Turso database URL (from turso db show --url)
printf '%s' 'libsql://YOUR-DB-NAME-ORG.turso.io' | npx -y firebase-tools@latest apphosting:secrets:set TURSO_DATABASE_URL --project YOUR_PROJECT_ID --data-file -

# Turso auth token (from turso db tokens create)
printf '%s' 'YOUR_TURSO_AUTH_TOKEN' | npx -y firebase-tools@latest apphosting:secrets:set TURSO_AUTH_TOKEN --project YOUR_PROJECT_ID --data-file -

# Grant the backend access to all secrets (comma-separated, not space-separated)
npx -y firebase-tools@latest apphosting:secrets:grantaccess AUTH_SECRET,SMTP_PASSWORD,TURSO_DATABASE_URL,TURSO_AUTH_TOKEN --backend grand-holdings-checklist --project YOUR_PROJECT_ID
```

Grant access when prompted during `secrets:set`, or run `grantaccess` afterward. Secret names must match `apphosting.yaml` (`AUTH_SECRET`, `SMTP_PASSWORD`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`). **Use commas between secret names** — space-separated names are treated as one invalid secret ID.

Turso secrets use `RUNTIME` availability only (see `apphosting.yaml`) — they are not needed at build time.

Non-secret SMTP settings are already in `apphosting.yaml`. Override there if your mail host differs.

---

## Step 5: Deploy

From the project root:

```bash
npm run build   # verify locally first
npx -y firebase-tools@latest deploy --only apphosting:grand-holdings-checklist
```

First deploy to a new region may require **Project Owner** or **IAM Admin** to create the source upload bucket. Subsequent deploys need only Editor/App Hosting Admin.

After deploy, find your URL in Firebase Console → **App Hosting** → your backend. Format:

```
https://grand-holdings-checklist--YOUR_PROJECT_ID.REGION.hosted.app
```

Initial rollout can take ~5 minutes.

---

## Step 6: Post-deploy checks

1. Open the hosted URL → should redirect to `/login`.
2. Log in with seeded demo credentials (`admin@grandholdings.co.za` / `admin123` on first Turso connection, or your migrated users).
3. Create a test task and confirm SMTP notifications (check server logs in Cloud Logging if mail fails).
4. **Verify data survives a redeploy** — create a record, redeploy, confirm it still exists.

---

## Turso database setup

Production data is stored in [Turso](https://turso.tech) (libSQL). The app uses `@libsql/client`:

- **Production:** `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` (Firebase secrets)
- **Local dev:** no Turso env vars → uses `file:data/grand-holdings.db` automatically

### 1. Install Turso CLI and create a database

```bash
# macOS
brew install tursodatabase/tap/turso
turso auth login

# Create database (pick a name, e.g. grand-holdings-checklist)
turso db create grand-holdings-checklist

# Get connection URL and create an auth token
turso db show grand-holdings-checklist --url
turso db tokens create grand-holdings-checklist
```

Save the URL (format `libsql://…turso.io`) and token — you will add them as Firebase secrets in Step 4.

For project **grandh-3c1b2**:

```bash
PROJECT_ID=grandh-3c1b2

printf '%s' 'libsql://YOUR-DB.turso.io' | npx -y firebase-tools@latest apphosting:secrets:set TURSO_DATABASE_URL --project "$PROJECT_ID" --data-file -
printf '%s' 'YOUR_TURSO_TOKEN' | npx -y firebase-tools@latest apphosting:secrets:set TURSO_AUTH_TOKEN --project "$PROJECT_ID" --data-file -
npx -y firebase-tools@latest apphosting:secrets:grantaccess TURSO_DATABASE_URL,TURSO_AUTH_TOKEN --backend grand-holdings-checklist --project "$PROJECT_ID"
```

### 2. First deploy / empty database

On first connection to an empty Turso database, the app runs schema migration and seeds demo data (admin user, sample properties, daily checklist). Same behavior as local SQLite.

Demo login after seed:

- **Admin:** `admin@grandholdings.co.za` / `admin123`
- **Manager:** `manager.cpt@grandholdings.co.za` / `manager123`

Change passwords immediately in production.

### 3. Optional: migrate existing local SQLite data

If you have data in `data/grand-holdings.db` from local dev:

```bash
# Export local SQLite to SQL dump
sqlite3 data/grand-holdings.db .dump > /tmp/grand-holdings.sql

# Import into Turso (requires turso CLI)
turso db shell grand-holdings-checklist < /tmp/grand-holdings.sql
```

Review the dump for `BEGIN TRANSACTION` / `COMMIT` compatibility. For small datasets, re-seeding and re-entering data may be simpler.

### 4. Local dev with Turso (optional)

To point local dev at Turso instead of the file:

```bash
export TURSO_DATABASE_URL="libsql://YOUR-DB.turso.io"
export TURSO_AUTH_TOKEN="YOUR_TOKEN"
npm run dev
```

Or add these to `.env.local` (never commit).

---

## Optional: GitHub CI/CD

Instead of `firebase deploy`, connect a GitHub repo in Firebase Console → App Hosting → **Create backend** → connect repository. Pushes to your live branch auto-deploy.

Use this after Turso secrets are configured and a first deploy has succeeded.

---

## Optional: Custom domain

Firebase Console → App Hosting → your backend → **Add custom domain** (e.g. `checklist.grandholdings.co.za`). Follow DNS verification steps.

---

## File uploads and PDFs

- Task attachments and identity documents are stored as base64 in the database (persists with Turso).
- Guest registration PDFs are written to `data/form-pdfs/` on disk — **still ephemeral** on App Hosting.
- Production fix (future): store PDF blobs in **Firebase Cloud Storage** and save URLs in the database.

---

## Database alternatives (reference)

<details>
<summary>Other options if not using Turso</summary>

### Cloud SQL (PostgreSQL) — native GCP

- Requires SQL dialect changes (SQLite → PostgreSQL).
- Rough cost: ~$10–50+/mo for a small always-on instance.

### Firestore — native Firebase

- Requires rewriting the entire data layer (no SQL).
- Highest migration effort.

### Classic Firebase Hosting

- Static/SPA only — cannot run API routes or cookie auth server logic.

</details>

---

## Estimated monthly cost (staff internal app)

For a small team (~10–50 users, low traffic), expect **~$0–5/month** within Blaze free tiers:

| Service | Free tier (approx.) | Notes |
|---------|---------------------|-------|
| Cloud Run (CPU/memory) | 180k vCPU-sec, 360k GiB-sec/mo | Low traffic stays free |
| Cloud Run requests | 2M/mo | Internal app unlikely to exceed |
| App Hosting bandwidth | 10 GiB/mo | Then $0.15–0.20/GiB |
| Cloud Build | 2,500 build-min/mo | One deploy ≈ few minutes |
| Secret Manager | 6 active secret versions free | AUTH_SECRET, SMTP_PASSWORD, Turso secrets |
| **Turso** | Free tier for small teams | ~$0–29/mo at production scale |

Firebase’s own example: ~**$0.01/mo at 10k visits**, ~**$70/mo at 1M visits** (mostly bandwidth). Internal staff usage should stay at the low end.

Set a [budget spend cap](https://firebase.google.com/docs/projects/billing/avoid-surprise-bills) on the Cloud Run service in Google Cloud Billing.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `No authorized accounts` | Run `firebase login` |
| `403 PERMISSION_DENIED` on first deploy | Project Owner must run first deploy to create storage bucket |
| `Misconfigured secret` / secret version errors | Create secrets; run `grantaccess` with comma-separated names: `AUTH_SECRET,SMTP_PASSWORD,TURSO_DATABASE_URL,TURSO_AUTH_TOKEN` |
| Build fails on `apphosting-adapter-nextjs-build` | Open rollout debug logs; confirm `grantaccess` succeeded; run `npm run build` locally |
| Build fails on native modules | `serverExternalPackages` in `next.config.ts` includes `@libsql/client` and `bcryptjs` |
| App loads but data resets | Turso secrets missing or not granted — check Cloud Run env and `grantaccess` |
| Turso connection errors | Verify `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`; token must match the database |
| SMTP errors | Verify `SMTP_PASSWORD` secret; check Cloud Logging |
| TypeScript build errors | Run `npm run build` locally; `ripple-sync/` is excluded from main app TS config |

---

## Files in this repo

| File | Purpose |
|------|---------|
| `firebase.json` | App Hosting backend and deploy ignore list |
| `apphosting.yaml` | Cloud Run resources, env vars, secret references |
| `.firebaserc.example` | Template — copy to `.firebaserc` with your project ID |
| `next.config.ts` | `serverExternalPackages` for `@libsql/client` / `bcryptjs` |
| `lib/db.ts` | Database init, schema, seed — Turso or local file via `@libsql/client` |
| `lib/db-client.ts` | libSQL client wrapper with prepare/run/get/all API |

Do **not** commit `.firebaserc` if it contains sensitive info (project ID alone is fine). Never commit `.env.local`, secrets, or `data/`.
