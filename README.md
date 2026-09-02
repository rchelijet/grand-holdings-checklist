# Grand Holdings Checklist Manager

Web application for Grand Holdings to manage hotel facilities, create recurring checklists, and track completion across properties.

## Features

- **Facilities** — Add hotels with address and contact details
- **Checklists** — Create daily, weekly, monthly, quarterly, or yearly checklists
- **Checklist items** — Add tasks like "Check Wi-Fi is operational"
- **Multi-facility assignment** — Assign one checklist to one or many hotels
- **Pending reminders** — Users see due checklists based on schedule:
  - Daily — every day
  - Weekly — first Monday of each week
  - Monthly — 1st of each month
  - Quarterly — 1 Jan, 1 Apr, 1 Jul, 1 Oct
  - Yearly — 1 January
- **Completion flow** — Tick items, add notes, save progress, submit
- **Search history** — Filter submitted checklists by date and facility
- **User management** — Admin can add admin, manager, or basic users with access to one, several, or all properties
- **Task scheduler** — Create property tasks with due dates, assignees, file uploads, progress updates, and notes
- **Task dashboard** — Filter tasks by property, status, month, year, and search; review overdue work and on-time property performance

## Access rules

- **Admin** — all properties and all management functions; only admins can delete tasks.
- **Manager** — assigned properties (one, several, or all); can create and modify checklists and tasks, assign tasks, and update progress.
- **Basic** — assigned properties only; can complete checklists and add notes/files to property tasks.

Authorization is enforced in route handlers and the SQLite access tables, not only by hiding navigation links.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Demo logins

| Role    | Email                             | Password   |
|---------|-----------------------------------|------------|
| Admin   | admin@grandholdings.co.za         | admin123   |
| Manager | manager.cpt@grandholdings.co.za   | manager123 |

The app seeds three demo hotels and a sample "Daily Checks" checklist on first run. Existing SQLite databases are migrated with manager roles, multi-property assignments, and admin all-property access on next startup.

## Production notes

Set `AUTH_SECRET` in your environment for secure session tokens.
Recurring checklist periods use `APP_TIME_ZONE` (default `Africa/Johannesburg`)
so midnight and calendar boundaries match the properties’ local time.

Data is stored in `data/grand-holdings.db` (SQLite).

Task-created email notifications use authenticated SMTP and are sent to every
manager who can access the selected property. Copy `.env.example` to `.env.local`
and set `SMTP_PASSWORD` to the rotated SMTP credential. The other SMTP settings
default to `smtp.melohospitality.co.za`, port `587`, STARTTLS, and
`noreply@meloshospitality.co.za`; they can be overridden with the `SMTP_*`
variables. Keep all SMTP variables server-side and never expose them through
client-side configuration. Task creation succeeds even when delivery fails; the
server logs a warning and the API returns a non-secret warning.

The SMTP password previously shared in chat must be rotated immediately. Do not
reuse it in local or production configuration.

## Firebase deployment (App Hosting)

This Next.js app uses server-side API routes, cookie auth, and SQLite — it requires **Firebase App Hosting**, not Classic Hosting.

Prepared config files: `firebase.json`, `apphosting.yaml`, `.firebaserc.example`.

**Deploy from GitHub (recommended):** see [docs/FIREBASE-GITHUB-DEPLOY.md](docs/FIREBASE-GITHUB-DEPLOY.md) — push to `main`, auto-deploy via Firebase App Hosting.

**Deploy from CLI:** see [docs/FIREBASE-DEPLOY.md](docs/FIREBASE-DEPLOY.md).

Quick CLI summary:

1. `firebase login` and create a Blaze-plan Firebase project
2. Copy `.firebaserc.example` → `.firebaserc` with your project ID
3. Set secrets: `AUTH_SECRET`, `SMTP_PASSWORD`
4. `npm run build` then `firebase deploy --only apphosting:grand-holdings-checklist`

**Blocker:** SQLite and local PDF files do not persist on App Hosting. Migrate to Turso, Cloud SQL, or Firestore before production use. See the deploy doc for options and cost notes.

## xneelo PHP/MySQL version

The upload-ready PHP/MySQL version is in `php-site/`. It includes its own `README.md`, SQL import file, configuration file, CSS, and hospitality assets. It is designed for standard xneelo PHP hosting and does not require Node.js.
