import PDFDocument from "pdfkit";
import {
  ACKNOWLEDGEMENT_CLAUSES,
  type GuestRegistrationData,
} from "./guest-registration";
import type { StoredIdentityDocument } from "./form-attachment-constants";

interface PdfContext {
  submissionId: number;
  submittedAt: string;
  submittedBy: string;
  facilityName: string;
  facilityAddress: string;
  contentHash: string;
  data: GuestRegistrationData;
  identityDocuments?: StoredIdentityDocument[];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-ZA", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function drawLabelValue(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number
): number {
  doc.fontSize(9).fillColor("#4a5c52").text(label, x, y, { width });
  doc.fontSize(11).fillColor("#1a2e24").text(value || "—", x, y + 12, { width });
  return y + 36;
}

function embedSignature(
  doc: PDFKit.PDFDocument,
  dataUrl: string,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  if (!dataUrl?.startsWith("data:image")) return;
  try {
    const base64 = dataUrl.split(",")[1];
    const buffer = Buffer.from(base64, "base64");
    doc.image(buffer, x, y, { width, height, fit: [width, height] });
  } catch {
    doc.fontSize(9).fillColor("#888").text("(signature unavailable)", x, y);
  }
}

function embedIdentityDocument(
  doc: PDFKit.PDFDocument,
  attachment: StoredIdentityDocument,
  x: number,
  y: number,
  width: number,
  height: number
): number {
  if (!attachment.data.startsWith("data:image")) {
    doc.fontSize(9).fillColor("#888").text("(image unavailable)", x, y);
    return y + 20;
  }

  try {
    const base64 = attachment.data.split(",")[1];
    const buffer = Buffer.from(base64, "base64");
    doc
      .fontSize(9)
      .fillColor("#4a5c52")
      .text(attachment.fileName, x, y, { width });
    doc.image(buffer, x, y + 14, { width, height, fit: [width, height] });
    return y + height + 28;
  } catch {
    doc.fontSize(9).fillColor("#888").text("(image unavailable)", x, y);
    return y + 20;
  }
}

export function generateGuestRegistrationPdf(ctx: PdfContext): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const { data } = ctx;
    const pageWidth = doc.page.width - 100;

    doc
      .fontSize(22)
      .fillColor("#1a2e24")
      .font("Helvetica-Bold")
      .text("The Grand Hotel", { align: "center" });
    doc
      .fontSize(16)
      .font("Helvetica")
      .text("Guest Registration Form", { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .fillColor("#4a5c52")
      .text(ctx.facilityName, { align: "center" });
    doc.moveDown(1.5);

    const section = (title: string) => {
      doc.moveDown(0.5);
      doc
        .fontSize(12)
        .fillColor("#1a2e24")
        .font("Helvetica-Bold")
        .text(title);
      doc.moveDown(0.3);
      doc
        .moveTo(50, doc.y)
        .lineTo(50 + pageWidth, doc.y)
        .strokeColor("#c9a84c")
        .lineWidth(0.5)
        .stroke();
      doc.moveDown(0.5);
    };

    section("Guest Information");
    let y = doc.y;
    const colWidth = pageWidth / 2 - 10;
    y = drawLabelValue(doc, "Full Name", data.fullName, 50, y, pageWidth);
    y = drawLabelValue(doc, "ID/Passport No", data.idPassportNo, 50, y, pageWidth);
    y = drawLabelValue(doc, "Address", data.address, 50, y, pageWidth);
    y = drawLabelValue(doc, "Telephone / Mobile", data.telephone, 50, y, colWidth);
    y = drawLabelValue(
      doc,
      "Email Address",
      data.email,
      50 + colWidth + 20,
      y - 36,
      colWidth
    );
    y += 36;
    y = drawLabelValue(
      doc,
      "Vehicle Registration",
      data.vehicleRegistration,
      50,
      y,
      pageWidth
    );
    doc.y = y;

    section("Booking Details");
    y = doc.y;
    y = drawLabelValue(doc, "Arrival Date", data.arrivalDate, 50, y, colWidth);
    y = drawLabelValue(
      doc,
      "Departure Date",
      data.departureDate,
      50 + colWidth + 20,
      y - 36,
      colWidth
    );
    y += 36;
    y = drawLabelValue(
      doc,
      "Number of Guests",
      data.numberOfGuests,
      50,
      y,
      colWidth
    );
    y = drawLabelValue(
      doc,
      "Room Number",
      data.roomNumber,
      50 + colWidth + 20,
      y - 36,
      colWidth
    );
    y += 36;
    doc.y = y;

    section("Emergency Contact");
    y = doc.y;
    y = drawLabelValue(doc, "Name", data.emergencyContactName, 50, y, colWidth);
    y = drawLabelValue(
      doc,
      "Telephone",
      data.emergencyContactTelephone,
      50 + colWidth + 20,
      y - 36,
      colWidth
    );
    y += 36;
    y = drawLabelValue(
      doc,
      "Special occasions during your stay",
      data.specialOccasions,
      50,
      y,
      pageWidth
    );
    doc.y = y;

    const identityDocuments = ctx.identityDocuments ?? [];
    if (identityDocuments.length > 0) {
      section("Client Identity Documentation");
      const imageWidth = pageWidth;
      const imageHeight = 220;

      for (const attachment of identityDocuments) {
        if (doc.y + imageHeight + 40 > doc.page.height - 50) {
          doc.addPage();
        }

        doc.y = embedIdentityDocument(
          doc,
          attachment,
          50,
          doc.y,
          imageWidth,
          imageHeight
        );
        doc.moveDown(0.5);
      }
    }

    doc.addPage();
    section("Acknowledgement & Indemnity");
    doc
      .fontSize(9)
      .fillColor("#1a2e24")
      .font("Helvetica")
      .text(
        "By signing this form, I/we acknowledge and agree as follows:",
        { width: pageWidth }
      );
    doc.moveDown(0.5);

    ACKNOWLEDGEMENT_CLAUSES.forEach((clause, index) => {
      doc.text(`${index + 1}. ${clause}`, { width: pageWidth, lineGap: 2 });
      doc.moveDown(0.3);
    });

    doc.moveDown(1);
    section("Guest Signature");
    doc
      .fontSize(9)
      .fillColor("#1a2e24")
      .text(
        "I/we have read and understood the above and agree to the terms and conditions of my/our stay.",
        { width: pageWidth }
      );
    doc.moveDown(0.5);
    y = doc.y;
    drawLabelValue(doc, "Name", data.guestSignatureName, 50, y, pageWidth);
    doc.fontSize(9).fillColor("#4a5c52").text("Signature", 50, doc.y + 4);
    embedSignature(doc, data.guestSignature, 50, doc.y + 16, 200, 60);
    drawLabelValue(
      doc,
      "Date",
      data.guestSignatureDate,
      300,
      y,
      200
    );
    doc.y = y + 90;

    section("Hotel Representative");
    y = doc.y;
    drawLabelValue(doc, "Name", data.hotelRepName, 50, y, pageWidth);
    doc.fontSize(9).fillColor("#4a5c52").text("Signature", 50, doc.y + 4);
    embedSignature(doc, data.hotelRepSignature, 50, doc.y + 16, 200, 60);
    drawLabelValue(
      doc,
      "Date",
      data.hotelRepSignatureDate,
      300,
      y,
      200
    );

    doc.addPage();
    doc
      .fontSize(18)
      .fillColor("#1a2e24")
      .font("Helvetica-Bold")
      .text("Security & POPIA Compliance Record", { align: "center" });
    doc.moveDown(1);

    const complianceFields: [string, string][] = [
      ["Submission ID", String(ctx.submissionId)],
      ["Form Type", "Guest Registration"],
      ["Property", `${ctx.facilityName} — ${ctx.facilityAddress}`],
      ["Submitted At", formatDate(ctx.submittedAt)],
      ["Submitted By (staff)", ctx.submittedBy],
      ["Guest Name", data.fullName],
      ["ID/Passport No", data.idPassportNo],
      ["Content SHA-256 Hash", ctx.contentHash],
      [
        "Document Generated",
        formatDate(new Date().toISOString()),
      ],
    ];

    complianceFields.forEach(([label, value]) => {
      doc
        .fontSize(9)
        .fillColor("#4a5c52")
        .font("Helvetica-Bold")
        .text(label, { continued: false });
      doc
        .fontSize(10)
        .fillColor("#1a2e24")
        .font("Helvetica")
        .text(value, { width: pageWidth });
      doc.moveDown(0.5);
    });

    doc.moveDown(1);
    doc
      .fontSize(11)
      .fillColor("#1a2e24")
      .font("Helvetica-Bold")
      .text("Data Protection & Retention");
    doc.moveDown(0.3);
    doc
      .fontSize(9)
      .fillColor("#1a2e24")
      .font("Helvetica")
      .text(
        "This electronic record was created and stored in accordance with the Protection of Personal Information Act (POPIA), Act 4 of 2013. Personal information collected on this form is used solely for guest registration, safety, and legal compliance purposes. Records are retained for the period required by applicable hospitality and tax regulations, after which they are securely destroyed. Access is restricted to authorised Grand Holdings staff with a legitimate operational need. The SHA-256 content hash above provides a cryptographic fingerprint of the submitted form data at the time of signing, supporting audit and non-repudiation requirements.",
        { width: pageWidth, align: "justify", lineGap: 2 }
      );

    doc.end();
  });
}
