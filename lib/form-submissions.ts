import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getDb } from "./db";
import {
  buildSearchText,
  GUEST_REGISTRATION_SLUG,
  PENDING_STATUSES,
  splitGuestName,
  type GuestRegistrationData,
  type GuestRegistrationStatus,
} from "./guest-registration";
import {
  getIdentityDocuments,
  saveIdentityDocuments,
  type StoredIdentityDocument,
} from "./form-attachments";
import { generateGuestRegistrationPdf } from "./form-pdf";
import { normalizeGuestRegistrationPhones } from "./phone";
import { accessibleFacilityIds, canAccessFacility } from "./tasks";
import type { SessionUser } from "./types";

export interface FormSubmissionRow {
  id: number;
  form_slug: string;
  facility_id: number;
  submitted_by: number;
  submitted_at: string;
  status: GuestRegistrationStatus;
  prepared_by: number | null;
  prepared_at: string | null;
  completed_at: string | null;
  guest_name: string;
  guest_surname: string;
  id_number: string;
  form_data: string;
  pdf_path: string | null;
  content_hash: string;
  search_text: string;
  facility_name?: string;
  submitted_by_name?: string;
  prepared_by_name?: string;
}

export interface FormSubmissionSummary {
  id: number;
  formSlug: string;
  facilityId: number;
  facilityName: string;
  status: GuestRegistrationStatus;
  submittedAt: string;
  preparedAt: string | null;
  completedAt: string | null;
  guestName: string;
  guestSurname: string;
  idNumber: string;
  submittedByName: string;
  preparedByName: string;
  roomNumber: string;
  arrivalDate: string;
  departureDate: string;
  telephone: string;
}

function pdfDir(): string {
  const dir = path.join(process.cwd(), "data", "form-pdfs");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function computeHash(data: GuestRegistrationData): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex");
}

function rowToSummary(row: FormSubmissionRow): FormSubmissionSummary {
  const data = JSON.parse(row.form_data) as GuestRegistrationData;
  return {
    id: row.id,
    formSlug: row.form_slug,
    facilityId: row.facility_id,
    facilityName: row.facility_name ?? "",
    status: row.status,
    submittedAt: row.submitted_at,
    preparedAt: row.prepared_at,
    completedAt: row.completed_at,
    guestName: row.guest_name,
    guestSurname: row.guest_surname,
    idNumber: row.id_number,
    submittedByName: row.submitted_by_name ?? "",
    preparedByName: row.prepared_by_name ?? "",
    roomNumber: data.roomNumber,
    arrivalDate: data.arrivalDate,
    departureDate: data.departureDate,
    telephone: data.telephone,
  };
}

function summarySelect(): string {
  return `
    SELECT fs.*, f.name AS facility_name,
           u.name AS submitted_by_name,
           prep.name AS prepared_by_name
    FROM form_submissions fs
    JOIN facilities f ON f.id = fs.facility_id
    JOIN users u ON u.id = fs.submitted_by
    LEFT JOIN users prep ON prep.id = fs.prepared_by
  `;
}

export function canAccessSubmission(
  user: SessionUser,
  submissionId: number
): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT facility_id FROM form_submissions WHERE id = ?")
    .get(submissionId) as { facility_id: number } | undefined;
  if (!row) return false;
  return canAccessFacility(user, row.facility_id);
}

export function getSubmission(
  user: SessionUser,
  submissionId: number
): (FormSubmissionRow & { data: GuestRegistrationData }) | null {
  if (!canAccessSubmission(user, submissionId)) return null;
  const db = getDb();
  const row = db
    .prepare(`${summarySelect()} WHERE fs.id = ?`)
    .get(submissionId) as FormSubmissionRow | undefined;
  if (!row) return null;
  return {
    ...row,
    data: JSON.parse(row.form_data) as GuestRegistrationData,
  };
}

export function getSubmissionPdfPath(
  user: SessionUser,
  submissionId: number
): string | null {
  if (!canAccessSubmission(user, submissionId)) return null;
  const db = getDb();
  const row = db
    .prepare("SELECT status, pdf_path FROM form_submissions WHERE id = ?")
    .get(submissionId) as { status: GuestRegistrationStatus; pdf_path: string | null } | undefined;
  if (!row || row.status !== "completed") return null;
  const fullPath = path.join(
    process.cwd(),
    "data",
    "form-pdfs",
    `${submissionId}.pdf`
  );
  return fs.existsSync(fullPath) ? fullPath : null;
}

export function listPendingGuestRegistrations(
  user: SessionUser,
  options: { facilityId?: number } = {}
): FormSubmissionSummary[] {
  const db = getDb();
  const facilityIds = accessibleFacilityIds(user);
  if (facilityIds.length === 0) return [];

  const params: (string | number)[] = [...facilityIds];
  let query = `${summarySelect()}
    WHERE fs.facility_id IN (${facilityIds.map(() => "?").join(",")})
      AND fs.form_slug = ?
      AND fs.status IN (${PENDING_STATUSES.map(() => "?").join(",")})
  `;
  params.push(GUEST_REGISTRATION_SLUG, ...PENDING_STATUSES);

  if (options.facilityId) {
    query += " AND fs.facility_id = ?";
    params.push(options.facilityId);
  }

  query += " ORDER BY COALESCE(fs.prepared_at, fs.submitted_at) DESC LIMIT 100";

  const rows = db.prepare(query).all(...params) as FormSubmissionRow[];
  return rows.map(rowToSummary);
}

export function prepareGuestRegistration(
  user: SessionUser,
  facilityId: number,
  data: GuestRegistrationData,
  status: "draft" | "prepared",
  submissionId?: number
): FormSubmissionSummary {
  if (!canAccessFacility(user, facilityId)) {
    throw new Error("You do not have access to this property.");
  }

  const db = getDb();
  const facility = db
    .prepare("SELECT id FROM facilities WHERE id = ?")
    .get(facilityId) as { id: number } | undefined;
  if (!facility) throw new Error("Property not found.");

  data = normalizeGuestRegistrationPhones(data);

  const { guestName, guestSurname } = splitGuestName(data.fullName);
  const contentHash = computeHash(data);
  const searchText = buildSearchText(data);
  const now = new Date().toISOString();

  if (submissionId) {
    const existing = db
      .prepare(
        "SELECT id, facility_id, status FROM form_submissions WHERE id = ? AND form_slug = ?"
      )
      .get(submissionId, GUEST_REGISTRATION_SLUG) as
      | { id: number; facility_id: number; status: GuestRegistrationStatus }
      | undefined;

    if (!existing) throw new Error("Submission not found.");
    if (!canAccessFacility(user, existing.facility_id)) {
      throw new Error("You do not have access to this property.");
    }
    if (existing.status === "completed") {
      throw new Error("Completed registrations cannot be edited.");
    }

    db.prepare(`
      UPDATE form_submissions SET
        facility_id = ?, submitted_by = ?, submitted_at = ?,
        status = ?, prepared_by = ?, prepared_at = ?,
        guest_name = ?, guest_surname = ?, id_number = ?,
        form_data = ?, content_hash = ?, search_text = ?,
        pdf_path = NULL, completed_at = NULL
      WHERE id = ?
    `).run(
      facilityId,
      user.id,
      now,
      status,
      user.id,
      now,
      guestName,
      guestSurname,
      data.idPassportNo.trim(),
      JSON.stringify(data),
      contentHash,
      searchText,
      submissionId
    );
  } else {
    const result = db.prepare(`
      INSERT INTO form_submissions (
        form_slug, facility_id, submitted_by, submitted_at,
        status, prepared_by, prepared_at,
        guest_name, guest_surname, id_number, form_data,
        content_hash, search_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      GUEST_REGISTRATION_SLUG,
      facilityId,
      user.id,
      now,
      status,
      user.id,
      now,
      guestName,
      guestSurname,
      data.idPassportNo.trim(),
      JSON.stringify(data),
      contentHash,
      searchText
    );
    submissionId = Number(result.lastInsertRowid);
  }

  const row = db
    .prepare(`${summarySelect()} WHERE fs.id = ?`)
    .get(submissionId) as FormSubmissionRow;

  return rowToSummary(row);
}

export async function completeGuestRegistration(
  user: SessionUser,
  submissionId: number,
  data: GuestRegistrationData,
  identityDocuments: StoredIdentityDocument[] = []
): Promise<FormSubmissionSummary> {
  const db = getDb();
  const existing = db
    .prepare(
      "SELECT id, facility_id, status FROM form_submissions WHERE id = ? AND form_slug = ?"
    )
    .get(submissionId, GUEST_REGISTRATION_SLUG) as
    | { id: number; facility_id: number; status: GuestRegistrationStatus }
    | undefined;

  if (!existing) throw new Error("Submission not found.");
  if (!canAccessFacility(user, existing.facility_id)) {
    throw new Error("You do not have access to this property.");
  }
  if (existing.status === "completed") {
    throw new Error("This registration is already completed.");
  }

  data = normalizeGuestRegistrationPhones(data);

  const facility = db
    .prepare("SELECT name, address FROM facilities WHERE id = ?")
    .get(existing.facility_id) as { name: string; address: string };

  const { guestName, guestSurname } = splitGuestName(data.fullName);
  const contentHash = computeHash(data);
  const searchText = buildSearchText(data);
  const completedAt = new Date().toISOString();

  saveIdentityDocuments(submissionId, identityDocuments);

  const pdfBuffer = await generateGuestRegistrationPdf({
    submissionId,
    submittedAt: completedAt,
    submittedBy: user.name,
    facilityName: facility.name,
    facilityAddress: facility.address,
    contentHash,
    data,
    identityDocuments,
  });

  pdfDir();
  const relativePath = path.join("data", "form-pdfs", `${submissionId}.pdf`);
  const absolutePath = path.join(process.cwd(), relativePath);
  fs.writeFileSync(absolutePath, pdfBuffer);

  db.prepare(`
    UPDATE form_submissions SET
      submitted_by = ?, submitted_at = ?,
      status = 'completed', completed_at = ?,
      guest_name = ?, guest_surname = ?, id_number = ?,
      form_data = ?, content_hash = ?, search_text = ?,
      pdf_path = ?
    WHERE id = ?
  `).run(
    user.id,
    completedAt,
    completedAt,
    guestName,
    guestSurname,
    data.idPassportNo.trim(),
    JSON.stringify(data),
    contentHash,
    searchText,
    relativePath,
    submissionId
  );

  const row = db
    .prepare(`${summarySelect()} WHERE fs.id = ?`)
    .get(submissionId) as FormSubmissionRow;

  return rowToSummary(row);
}

export { getIdentityDocuments };

export function searchFormSubmissions(
  user: SessionUser,
  options: {
    query?: string;
    formSlug?: string;
    facilityId?: number;
    limit?: number;
  } = {}
): FormSubmissionSummary[] {
  const db = getDb();
  const facilityIds = accessibleFacilityIds(user);
  if (facilityIds.length === 0) return [];

  const params: (string | number)[] = [...facilityIds];
  let query = `${summarySelect()}
    WHERE fs.facility_id IN (${facilityIds.map(() => "?").join(",")})
      AND fs.status = 'completed'
  `;

  if (options.formSlug) {
    query += " AND fs.form_slug = ?";
    params.push(options.formSlug);
  }

  if (options.facilityId) {
    query += " AND fs.facility_id = ?";
    params.push(options.facilityId);
  }

  if (options.query?.trim()) {
    const terms = options.query.trim().toLowerCase().split(/\s+/);
    for (const term of terms) {
      query += ` AND (
        fs.search_text LIKE ? OR
        fs.guest_name LIKE ? OR
        fs.guest_surname LIKE ? OR
        fs.id_number LIKE ?
      )`;
      const pattern = `%${term}%`;
      params.push(pattern, pattern, pattern, pattern);
    }
  }

  query += " ORDER BY fs.completed_at DESC, fs.submitted_at DESC";
  const limit = options.limit ?? 50;
  query += ` LIMIT ${limit}`;

  const rows = db.prepare(query).all(...params) as FormSubmissionRow[];
  return rows.map(rowToSummary);
}
