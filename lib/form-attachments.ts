import { getDb } from "./db";
import {
  isIdentityImageFile,
  MAX_IDENTITY_UPLOAD_BYTES,
  type IdentityDocumentAttachment,
  type StoredIdentityDocument,
} from "./form-attachment-constants";

export type {
  IdentityDocumentAttachment,
  StoredIdentityDocument,
} from "./form-attachment-constants";

export async function fileToIdentityDocument(
  file: File
): Promise<StoredIdentityDocument | null> {
  if (file.size <= 0) return null;
  if (file.size > MAX_IDENTITY_UPLOAD_BYTES) {
    throw new Error("Each identity document must be smaller than 8 MB.");
  }
  if (!isIdentityImageFile(file.name, file.type || "")) {
    throw new Error(`"${file.name}" is not a supported image type.`);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";
  return {
    fileName: file.name,
    mimeType,
    data: `data:${mimeType};base64,${bytes.toString("base64")}`,
  };
}

export async function saveIdentityDocuments(
  submissionId: number,
  documents: StoredIdentityDocument[]
): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      "DELETE FROM form_submission_attachments WHERE submission_id = ? AND kind = 'identity_document'"
    )
    .run(submissionId);

  const insert = db.prepare(`
    INSERT INTO form_submission_attachments (
      submission_id, kind, file_name, mime_type, data
    ) VALUES (?, 'identity_document', ?, ?, ?)
  `);

  for (const doc of documents) {
    await insert.run(submissionId, doc.fileName, doc.mimeType, doc.data);
  }
}

export async function getIdentityDocuments(
  submissionId: number
): Promise<IdentityDocumentAttachment[]> {
  const db = await getDb();
  const rows = (await db
    .prepare(
      `SELECT id, file_name, mime_type, data
       FROM form_submission_attachments
       WHERE submission_id = ? AND kind = 'identity_document'
       ORDER BY id ASC`
    )
    .all(submissionId)) as {
    id: number;
    file_name: string;
    mime_type: string;
    data: string;
  }[];

  return rows.map((row) => ({
    id: row.id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    data: row.data,
  }));
}
