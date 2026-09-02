# Deploy from GitHub (Firebase App Hosting)

This guide connects this repository to **Firebase App Hosting** so every push to `main` automatically builds and deploys the Next.js app. Use this instead of (or alongside) local `firebase deploy`.

For one-off CLI deploys, see [FIREBASE-DEPLOY.md](./FIREBASE-DEPLOY.md).

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| GitHub account | You create the empty repo |
| Firebase project | `project-67828be3-02ec-42e6-945` |
| **Blaze** billing | [Upgrade plan](https://console.firebase.google.com/project/project-67828be3-02ec-42e6-945/overview?purchaseBillingPlan=metered) — App Hosting is not on Spark |
| Secrets ready | `AUTH_SECRET` (long random string), `SMTP_PASSWORD` (rotated credential) |
| Local build passes | Run `npm run build` before the first push |

### Critical: SQLite does not persist on App Hosting

The app stores data in `data/grand-holdings.db` (SQLite) and PDFs in `data/form-pdfs/`. App Hosting runs on **Cloud Run** with **ephemeral disks** — data is lost on redeploy, scale-to-zero, or new instances.

- **OK for:** testing the deploy pipeline, demo logins on a fresh seed
- **Not OK for:** production staff use until you migrate to **Turso**, Cloud SQL, or Firestore

See [Database migration](./FIREBASE-DEPLOY.md#database-migration-required) in the CLI deploy doc for options.

---

## Part 1 — Push this repo to GitHub

The local repo is on branch `main` with **no commits yet** and **no remote**. Run these from the project root:

### 1. Create the GitHub repository

1. Open [github.com/new](https://github.com/new).
2. Repository name: e.g. `grand-holdings-checklist`.
3. **Do not** initialize with README, `.gitignore`, or license (this repo already has them).
4. Create the repository and copy the HTTPS or SSH URL.

### 2. Initial commit and push

```bash
cd /Users/sachin/Projects/grand-holdings-checklist

# Stage deploy-critical files (secrets and local data stay gitignored)
git add .

# Review what will be committed — confirm these are NOT listed:
#   .env.local, .firebaserc, data/, node_modules/, ripple-sync/, *.zip
git status

git commit -m "Initial commit: Grand Holdings checklist (Firebase App Hosting)"

git remote add origin git@github.com:YOUR_ORG/grand-holdings-checklist.git
# or: git remote add origin https://github.com/YOUR_ORG/grand-holdings-checklist.git

git push -u origin main
```

### Files that must be in the repo for GitHub deploy

| File | Purpose |
|------|---------|
| `firebase.json` | Backend ID, root directory, deploy ignore list |
| `apphosting.yaml` | Cloud Run resources, env vars, secret references |
| `next.config.ts` | `serverExternalPackages` for `better-sqlite3` / `bcryptjs` |
| `package.json` / `package-lock.json` | Build dependencies |
| `.firebaserc.example` | Documents the Firebase project ID (safe to commit) |

### Files that must stay out of the repo

| Path | Why |
|------|-----|
| `.env.local` | Local secrets |
| `.firebaserc` | Local CLI link (project ID only, but keep local) |
| `data/` | SQLite DB and PDFs |
| `node_modules/` | Installed by Cloud Build |
| `ripple-sync/` | Separate Expo app (341 MB; excluded from deploy) |
| `grand-holdings-php*.zip` | Archive duplicates |

---

## Part 2 — Connect GitHub in Firebase Console

### 1. Open App Hosting

1. Go to [Firebase Console](https://console.firebase.google.com/project/project-67828be3-02ec-42e6-945/apphosting).
2. Select project **project-67828be3-02ec-42e6-945**.
3. Open **App Hosting** in the left menu.

### 2. Enable Blaze (if not already)

If prompted, upgrade to the **Blaze (pay-as-you-go)** plan. App Hosting requires it.

### 3. Create backend and connect GitHub

1. Click **Get started** or **Create backend**.
2. Choose **Connect to GitHub** (not “Deploy from local machine”).
3. Authorize the **Firebase GitHub App** for your GitHub account/org.
4. Select the repository you pushed in Part 1.
5. Configure the backend:

   | Setting | Value |
   |---------|-------|
   | **Branch** | `main` (live branch — auto-deploy on push) |
   | **Root directory** | `/` (repository root) |
   | **Backend ID** | `grand-holdings-checklist` (must match `firebase.json`) |
   | **Region** | Closest to staff (e.g. `europe-west1` for South Africa) |

6. Firebase detects **Next.js** and uses `npm run build` automatically.
7. Finish setup. The first rollout starts from the latest `main` commit.

### 4. Set secrets in Firebase Console

Secrets are **not** read from `.env.local` during GitHub builds. Create them in Google Cloud Secret Manager via Firebase:

**Option A — Firebase Console**

1. App Hosting → your backend → **Environment** / **Secrets**.
2. Add secret **`AUTH_SECRET`** — paste a long random value (e.g. `openssl rand -base64 48`).
3. Add secret **`SMTP_PASSWORD`** — paste your rotated SMTP password.
4. Grant App Hosting access when prompted.

**Option B — CLI (same project)**

```bash
npx -y firebase-tools@latest login

openssl rand -base64 48 | npx -y firebase-tools@latest apphosting:secrets:set AUTH_SECRET --project grandh-3c1b2 --data-file -
printf '%s' 'YOUR_SMTP_PASSWORD' | npx -y firebase-tools@latest apphosting:secrets:set SMTP_PASSWORD --project grandh-3c1b2 --data-file -

# Comma-separated secret names (not space-separated)
npx -y firebase-tools@latest apphosting:secrets:grantaccess AUTH_SECRET,SMTP_PASSWORD --backend grand-holdings-checklist --project grandh-3c1b2
```

Secret names must match `apphosting.yaml`:

```yaml
- variable: AUTH_SECRET
  secret: AUTH_SECRET
- variable: SMTP_PASSWORD
  secret: SMTP_PASSWORD
```

Non-secret SMTP settings (`SMTP_HOST`, `SMTP_PORT`, etc.) and `APP_TIME_ZONE` are already in `apphosting.yaml`.

### 5. Re-run rollout if secrets were added after the first build

If the first build failed due to missing secrets:

1. App Hosting → **grand-holdings-checklist** → **Rollouts**.
2. Click **Create rollout** (or push a small commit to `main`).

---

## Part 3 — Verify auto-deploy

1. After the rollout completes, open the hosted URL:

   ```
   https://grand-holdings-checklist--project-67828be3-02ec-42e6-945.<region>.hosted.app
   ```

   Exact URL is shown in App Hosting → backend → **Domains**.

2. Confirm `/login` loads.
3. Log in with demo credentials (fresh SQLite seed on each new instance).
4. Push a trivial commit to `main` and confirm a new rollout starts automatically.

---

## How config maps to GitHub builds

```
firebase.json          → backend ID, root dir, files excluded from upload
apphosting.yaml        → CPU/memory, env vars, Secret Manager refs
next.config.ts         → native modules for Cloud Build
package.json "build"   → npm run build (App Hosting default for Next.js)
```

`firebase.json` already ignores `ripple-sync`, `php-site`, and `data` so they are not uploaded even if present locally.

---

## Optional: custom domain

Firebase Console → App Hosting → **grand-holdings-checklist** → **Add custom domain** (e.g. `checklist.grandholdings.co.za`). Follow DNS verification.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| GitHub connection fails | Re-authorize Firebase GitHub App; confirm repo visibility |
| Build fails on `better-sqlite3` | `serverExternalPackages` is in `next.config.ts`; check Cloud Build logs |
| `AUTH_SECRET` / `SMTP_PASSWORD` errors | Create secrets in Console; names must match `apphosting.yaml` |
| `grantaccess` fails with invalid Secret ID | Use comma-separated names: `AUTH_SECRET,SMTP_PASSWORD` (not a space) |
| Generic `apphosting-adapter-nextjs-build` failure | Check rollout debug logs; confirm secrets exist and `grantaccess` succeeded; run `npm run build` locally |
| App works but data resets | Expected with SQLite — migrate to Turso/Cloud SQL/Firestore |
| `403` on first deploy | Project Owner may need to complete first rollout (bucket creation) |
| Wrong branch deploys | App Hosting → backend settings → set live branch to `main` |

Cloud Build logs: Firebase Console → App Hosting → backend → **Rollouts** → select rollout → **View build log**.

---

## Cost reminder

Low-traffic internal use is typically **~$0–5/month** on Blaze free tiers. Database migration (Turso ~$0–29/mo) is separate. Set a [billing budget](https://firebase.google.com/docs/projects/billing/avoid-surprise-bills) in Google Cloud.
