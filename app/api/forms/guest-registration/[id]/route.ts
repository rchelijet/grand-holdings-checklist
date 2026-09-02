import fs from "fs";
import { NextResponse } from "next/server";
import {
  MAX_IDENTITY_DOCUMENT_COUNT,
  validateIdentityDocuments,
  type StoredIdentityDocument,
} from "@/lib/form-attachment-constants";
import { fileToIdentityDocument } from "@/lib/form-attachments";
import {
  completeGuestRegistration,
  getIdentityDocuments,
  getSubmission,
  getSubmissionPdfPath,
} from "@/lib/form-submissions";
import type { GuestRegistrationData } from "@/lib/guest-registration";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

const COMPLETION_REQUIRED: (keyof GuestRegistrationData)[] = [
  "fullName",
  "idPassportNo",
  "arrivalDate",
  "departureDate",
  "guestSignatureName",
  "guestSignature",
  "guestSignatureDate",
  "hotelRepName",
  "hotelRepSignature",
  "hotelRepSignatureDate",
];

async function parseCompleteRequest(
  request: Request
): Promise<{ data: GuestRegistrationData; identityDocuments: StoredIdentityDocument[] }> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const dataRaw = form.get("data");
    if (typeof dataRaw !== "string") {
      throw new Error("Form data is required.");
    }

    const data = JSON.parse(dataRaw) as GuestRegistrationData;
    const uploads = form
      .getAll("identityDocuments")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    const validationError = validateIdentityDocuments(
      uploads.map((file) => ({
        name: file.name,
        type: file.type,
        size: file.size,
      }))
    );
    if (validationError) {
      throw new Error(validationError);
    }

    const identityDocuments: StoredIdentityDocument[] = [];
    for (const upload of uploads) {
      const document = await fileToIdentityDocument(upload);
      if (document) identityDocuments.push(document);
    }

    return { data, identityDocuments };
  }

  const body = await request.json();
  const { data, identityDocuments = [] } = body as {
    data?: GuestRegistrationData;
    identityDocuments?: StoredIdentityDocument[];
  };

  if (!data) {
    throw new Error("Form data is required.");
  }

  if (identityDocuments.length > MAX_IDENTITY_DOCUMENT_COUNT) {
    throw new Error(
      `You can upload up to ${MAX_IDENTITY_DOCUMENT_COUNT} identity document images.`
    );
  }
  for (const document of identityDocuments) {
    if (!document.data?.startsWith("data:image")) {
      throw new Error(`"${document.fileName}" is not a supported image type.`);
    }
  }

  return { data, identityDocuments };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const submissionId = Number(id);
  const { searchParams } = new URL(request.url);

  if (searchParams.get("download") === "pdf") {
    const pdfPath = getSubmissionPdfPath(user, submissionId);
    if (!pdfPath) {
      return NextResponse.json({ error: "PDF not found" }, { status: 404 });
    }
    const buffer = fs.readFileSync(pdfPath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="guest-registration-${submissionId}.pdf"`,
      },
    });
  }

  const submission = getSubmission(user, submissionId);
  if (!submission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    submission: {
      id: submission.id,
      formSlug: submission.form_slug,
      facilityId: submission.facility_id,
      facilityName: submission.facility_name,
      status: submission.status,
      submittedAt: submission.submitted_at,
      preparedAt: submission.prepared_at,
      completedAt: submission.completed_at,
      submittedByName: submission.submitted_by_name,
      preparedByName: submission.prepared_by_name,
      guestName: submission.guest_name,
      guestSurname: submission.guest_surname,
      idNumber: submission.id_number,
      contentHash: submission.content_hash,
      data: submission.data,
      identityDocuments: getIdentityDocuments(submissionId),
    },
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const submissionId = Number(id);

  let data: GuestRegistrationData;
  let identityDocuments: StoredIdentityDocument[];

  try {
    ({ data, identityDocuments } = await parseCompleteRequest(request));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid completion request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  for (const field of COMPLETION_REQUIRED) {
    if (!data[field]?.trim()) {
      return NextResponse.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  try {
    const submission = await completeGuestRegistration(
      user,
      submissionId,
      data,
      identityDocuments
    );
    return NextResponse.json({ submission });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to complete registration.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
