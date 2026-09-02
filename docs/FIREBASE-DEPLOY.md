# Deploy Grand Holdings to Firebase App Hosting

This guide deploys the Next.js checklist app to **Firebase App Hosting** (not Classic Hosting). App Hosting runs the app on Cloud Run with SSR and API routes — the only viable Firebase path for this stack.

## Before you start

### Critical blockers

1. **SQLite does not persist on App Hosting.** The app stores data in `data/grand-holdings.db` and PDFs in `data/form-pdfs/`. Cloud Run containers use ephemeral disks — data is lost on redeploy, scale-to-zero, or new instances. **You must migrate to a cloud database before production use.** See [Database migration](#database-migration-required) below.

2. **Blaze (pay-as-you-go) plan required.** App Hosting is not available on the free Spark plan. Upgrade at [Firebase billing](https://console.firebase.google.com/project/_/overview?purchaseBillingPlan=metered).

3. **Build must pass locally.** Run `npm run build` before deploying. Fix any TypeScript or build errors first.

### What you need from your side

| Item | Purpose |
|------|---------|
| Google account with Firebase access | Login and project ownership |
| Firebase project ID | Links CLI to your project |
| Blaze billing enabled | Required for App Hosting |
| `AUTH_SECRET` | Long random string for signed session cookies |
| `SMTP_PASSWORD` | Rotated SMTP credential for task email notifications |
| (Later) Cloud database | Replace SQLite for persistent production data |

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
npx -y firebase-tools@latest apphosting:secrets:set AUTH_SECRET

# SMTP password (use your rotated credential, not the old leaked one)
npx -y firebase-tools@latest apphosting:secrets:set SMTP_PASSWORD
```

Grant access if prompted. Secret names must match `apphosting.yaml` (`AUTH_SECRET`, `SMTP_PASSWORD`).

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
2. Log in with seeded demo credentials (only if DB was migrated/seeded — see below).
3. Create a test task and confirm SMTP notifications (check server logs in Cloud Logging if mail fails).
4. **Do not rely on SQLite in production** — verify data survives a redeploy.

---

## Optional: GitHub CI/CD

Instead of `firebase deploy`, connect a GitHub repo in Firebase Console → App Hosting → **Create backend** → connect repository. Pushes to your live branch auto-deploy.

Use this after the database migration is complete.

---

## Optional: Custom domain

Firebase Console → App Hosting → your backend → **Add custom domain** (e.g. `checklist.grandholdings.co.za`). Follow DNS verification steps.

---

## Database migration (required)

App Hosting **cannot** use local SQLite in production. Pick one:

### Recommended: Turso (libSQL) — minimal code change

- SQLite-compatible SQL; smallest migration from `better-sqlite3`.
- Works on serverless; remote database with persistent storage.
- Not a Firebase product, but pairs well with App Hosting.
- Rough cost: free tier for small teams; ~$5–29/mo for production scale.

**Migration outline:**

1. Create a Turso database and auth token.
2. Replace `better-sqlite3` with `@libsql/client` in `lib/db.ts`.
3. Export local SQLite → import to Turso (or run schema + seed).
4. Add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` as App Hosting secrets.
5. Move PDF files from `data/form-pdfs/` to Firebase Cloud Storage or store in DB.

### Alternative: Cloud SQL (PostgreSQL) — native GCP

- Best if you want everything in Google Cloud.
- Requires SQL dialect changes (SQLite → PostgreSQL).
- Rough cost: ~$10–50+/mo for a small always-on instance.

### Alternative: Firestore — native Firebase

- Requires rewriting the entire data layer (no SQL).
- Best long-term Firebase integration, highest migration effort.
- Rough cost: free tier generous; pay per read/write at scale.

### Not recommended for this app: Classic Firebase Hosting

Static/SPA only — **cannot** run API routes, SQLite, or cookie auth server logic.

---

## File uploads and PDFs

- Task attachments and identity documents are stored as base64 in SQLite today.
- Guest registration PDFs are written to `data/form-pdfs/` on disk — **also ephemeral** on App Hosting.
- Production fix: store blobs in **Firebase Cloud Storage** (or keep in DB if size allows) and store URLs/paths in the database.

---

## Estimated monthly cost (staff internal app)

For a small team (~10–50 users, low traffic), expect **~$0–5/month** within Blaze free tiers:

| Service | Free tier (approx.) | Notes |
|---------|---------------------|-------|
| Cloud Run (CPU/memory) | 180k vCPU-sec, 360k GiB-sec/mo | Low traffic stays free |
| Cloud Run requests | 2M/mo | Internal app unlikely to exceed |
| App Hosting bandwidth | 10 GiB/mo | Then $0.15–0.20/GiB |
| Cloud Build | 2,500 build-min/mo | One deploy ≈ few minutes |
| Secret Manager | 6 active secret versions free | AUTH_SECRET + SMTP_PASSWORD |
| **Database (Turso/Cloud SQL)** | — | **+$0–50/mo depending on choice** |

Firebase’s own example: ~**$0.01/mo at 10k visits**, ~**$70/mo at 1M visits** (mostly bandwidth). Internal staff usage should stay at the low end.

Set a [budget spend cap](https://firebase.google.com/docs/projects/billing/avoid-surprise-bills) on the Cloud Run service in Google Cloud Billing.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `No authorized accounts` | Run `firebase login` |
| `403 PERMISSION_DENIED` on first deploy | Project Owner must run first deploy to create storage bucket |
| Build fails on `better-sqlite3` | `serverExternalPackages` is set in `next.config.ts`; ensure native module compiles in Cloud Build |
| App loads but data resets | Expected with SQLite — migrate database |
| SMTP errors | Verify `SMTP_PASSWORD` secret; check Cloud Logging |
| TypeScript build errors | Run `npm run build` locally; `ripple-sync/` is excluded from main app TS config |

---

## Files in this repo

| File | Purpose |
|------|---------|
| `firebase.json` | App Hosting backend and deploy ignore list |
| `apphosting.yaml` | Cloud Run resources, env vars, secret references |
| `.firebaserc.example` | Template — copy to `.firebaserc` with your project ID |
| `next.config.ts` | `serverExternalPackages` for native Node modules |

Do **not** commit `.firebaserc` if it contains sensitive info (project ID alone is fine). Never commit `.env.local`, secrets, or `data/`.
