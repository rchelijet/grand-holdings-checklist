# Guest Registration Form — PHP Mirror Notes

The primary Guest Registration implementation lives in the **Next.js app** (`/dashboard/forms/guest-registration`). The PHP site (`php-site/`) includes a **partial UI mirror** for pre-arrival preparation; signatures, PDF generation, and POPIA compliance pages are **Next.js only**.

## Two-phase workflow

1. **Preparation (PHP + Next.js)** — Staff enter guest details before arrival. Status: `draft` or `prepared`. No signatures or PDF.
2. **Check-in completion (Next.js only)** — Staff select a prepared guest, guest completes missing fields, both signatures required, then PDF is generated with POPIA page.

## What is mirrored in PHP

- Form listing on `?page=forms` with pending arrivals list
- Guest Registration preparation page (`?page=form-guest-registration`) with guest/booking/emergency fields
- POST action `save_guest_registration` persists draft/prepared records to MySQL

## Database (MySQL)

The `form_submissions` table in `grand_holdings.sql` includes:

- `status` — `draft`, `prepared`, or `completed`
- `prepared_by`, `prepared_at` — staff who prepared the record
- `completed_at` — set when finalized in Next.js

### Migrating existing MySQL databases

```sql
ALTER TABLE form_submissions
  ADD COLUMN status ENUM('draft', 'prepared', 'completed') NOT NULL DEFAULT 'prepared' AFTER submitted_at,
  ADD COLUMN prepared_by INT UNSIGNED NULL AFTER status,
  ADD COLUMN prepared_at DATETIME NULL AFTER prepared_by,
  ADD COLUMN completed_at DATETIME NULL AFTER prepared_at,
  ADD KEY idx_form_submissions_status (status),
  ADD CONSTRAINT form_submissions_prepared_by_fk FOREIGN KEY (prepared_by) REFERENCES users(id) ON DELETE SET NULL;

UPDATE form_submissions
SET status = 'completed', completed_at = submitted_at, prepared_by = submitted_by, prepared_at = submitted_at
WHERE pdf_path IS NOT NULL;

UPDATE form_submissions
SET prepared_by = submitted_by, prepared_at = submitted_at
WHERE status IN ('draft', 'prepared') AND prepared_by IS NULL;
```

## Limitations (PHP)

- No canvas signature capture
- No PDF generation or POPIA compliance page
- No guest check-in completion flow
- No completed-form search UI
- Use Next.js for production electronic registration with signatures and compliance PDFs

## Recommended approach

Deploy the Next.js app for the full two-phase guest registration workflow. Keep PHP pages as a fallback for pre-arrival data entry only, or redirect staff to the Next.js URL.
