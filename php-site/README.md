# Grand Holdings PHP/MySQL site

This folder is the upload-ready version for xneelo PHP hosting.

## Install on xneelo

1. Create an empty MySQL/MariaDB database and database user in the xneelo control panel.
2. Open `grand_holdings.sql` in phpMyAdmin and import it into that database.
3. Edit `config.php` and replace:
   - `YOUR_DATABASE_NAME`
   - `YOUR_DATABASE_USER`
   - `YOUR_DATABASE_PASSWORD`
   - Keep `app_timezone` as `Africa/Johannesburg` unless the properties use another timezone.
4. Upload the contents of this folder into the website's document root.
5. Make sure `uploads/tasks` is writable by PHP (normally folder permission `755`; use `775` if xneelo requires it).
6. Visit the domain.

The default logins after importing the SQL file are:

- Administrator: `admin@grandholdings.co.za` / `admin123`
- Manager: `manager.cpt@grandholdings.co.za` / `manager123` (Grand Game Lodge only)

Change the demo passwords after the first login by creating new users in Team and removing or replacing the demo accounts in phpMyAdmin.

## Task email notifications

Task creation sends an HTML notification to every Manager with access to the
selected property through All properties, `user_facilities`, or legacy
`facility_id`. Configure the SMTP placeholders in `config.php`:

- Host: `smtp.melohospitality.co.za`
- Port: `587` with STARTTLS (`smtp_encryption` set to `tls`), or `ssl` for an
  implicit TLS port such as `465`
- Username/from address: `noreply@meloshospitality.co.za`
- Password: set `smtp_password` to the rotated SMTP credential

The included `inc/mail.php` uses authenticated SMTP with certificate
verification and does not use insecure PHP `mail()`. Keep `config.php`
uncommitted or otherwise protected when it contains the production password.
If delivery fails, the task remains created and a generic warning is shown;
the server log records a non-secret diagnostic.

The SMTP password previously shared in chat must be rotated immediately. Do not
reuse it in `config.php` or any other environment.

## Included functionality

- Session login with Administrator, Manager, and Basic user roles
- Multi-property access per user, plus an All properties option
- Properties, checklists, checklist items, recurring checklist dates, notes, and completion history
- Tasks, property filtering, pending/closed status, month/year filters, task search, assignees, reassignment, progress updates, and uploads
- Overall task dashboard with overdue work, completion progress, and on-time property performance

Uploaded task files are stored in `uploads/tasks` and their metadata is stored in MySQL. This package accepts images, PDF, Word, Excel, and text files up to 8 MB each.

## Access rules

- **Administrator**: all properties, all checklist/task functionality, and can delete any task.
- **Manager**: assigned properties (one, several, or all), can create and modify checklists and tasks, reassign tasks, and update task progress.
- **Basic user**: assigned properties only; can complete checklists and add notes/files to property tasks. Basic users cannot create or reassign tasks, change task percentages, manage checklists, or delete tasks.

Managers can create and modify checklists and tasks only for properties assigned to them. Administrators can manage every property and are the only role allowed to delete tasks. Basic users are intentionally restricted to checklist completion and task notes/files; these rules are enforced in the request handlers as well as the navigation.

The SQL file is a clean import (it drops and recreates the application tables). Back up an existing production database before importing it. Uploaded task files remain on disk under `uploads/tasks`; include that directory in backups.
