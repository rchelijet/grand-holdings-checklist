"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { PhoneField } from "@/components/PhoneField";
import {
  buildGuestWhatsAppMessage,
  type GuestRegistrationData,
} from "@/lib/guest-registration";

interface IdentityDocumentAttachment {
  id: number;
  fileName: string;
  mimeType: string;
  data: string;
}

interface SubmissionDetail {
  id: number;
  formSlug: string;
  facilityId: number;
  facilityName: string;
  status: string;
  submittedAt: string;
  preparedAt: string | null;
  completedAt: string | null;
  submittedByName: string;
  preparedByName: string;
  guestName: string;
  guestSurname: string;
  idNumber: string;
  contentHash: string;
  data: GuestRegistrationData;
  identityDocuments?: IdentityDocumentAttachment[];
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function GuestRegistrationDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/forms/guest-registration/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setSubmission(d.submission);
      })
      .catch(() => setError("Failed to load submission."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <p className="text-forest/70">Loading…</p>;
  }

  if (error || !submission) {
    return (
      <div>
        <PageHeader title="Submission not found" />
        <p className="text-forest/70">{error || "This submission could not be found."}</p>
        <Link href="/dashboard/forms/guest-registration" className="mt-4 inline-block">
          <Button variant="secondary">Back to hub</Button>
        </Link>
      </div>
    );
  }

  if (submission.status !== "completed") {
    return (
      <div>
        <PageHeader title="Registration incomplete" />
        <p className="text-forest/70">
          This registration has not been completed yet. Use check-in to collect
          signatures and generate the PDF.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/dashboard/forms/guest-registration/${submission.id}/complete`}>
            <Button>Complete check-in</Button>
          </Link>
          <Link href="/dashboard/forms/guest-registration">
            <Button variant="secondary">Back to hub</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { data } = submission;
  const guestWhatsAppMessage = buildGuestWhatsAppMessage(
    data.fullName ||
      [submission.guestName, submission.guestSurname].filter(Boolean).join(" "),
    submission.facilityName
  );

  return (
    <div>
      <PageHeader
        title="Guest Registration"
        description={`Submission #${submission.id} — ${submission.facilityName}`}
        action={
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/forms/guest-registration/${submission.id}?download=pdf`}
              download
              title="Download PDF"
            >
              <Button>Download PDF</Button>
            </a>
            <Link href="/dashboard/forms/guest-registration">
              <Button variant="secondary">Back to hub</Button>
            </Link>
          </div>
        }
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success">Completed</Badge>
          <span className="text-sm text-forest/60">
            {formatDateTime(submission.completedAt)} by{" "}
            {submission.submittedByName}
          </span>
        </div>
        {submission.preparedByName && (
          <p className="mt-2 text-sm text-forest/60">
            Prepared {formatDateTime(submission.preparedAt)} by{" "}
            {submission.preparedByName}
          </p>
        )}
        <p className="mt-3 font-mono text-xs break-all text-forest/50">
          SHA-256: {submission.contentHash}
        </p>
      </Card>

      <div className="grid gap-6">
        <Card>
          <h3 className="font-serif text-2xl text-forest">Guest Information</h3>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Field label="Full Name" value={data.fullName} />
            <Field label="ID / Passport No" value={data.idPassportNo} />
            <Field label="Address" value={data.address} className="sm:col-span-2" />
            <PhoneField
              label="Telephone / Mobile"
              value={data.telephone}
              whatsAppMessage={guestWhatsAppMessage}
            />
            <Field label="Email" value={data.email} />
            <Field label="Vehicle Registration" value={data.vehicleRegistration} />
          </dl>
        </Card>

        <Card>
          <h3 className="font-serif text-2xl text-forest">Booking Details</h3>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Field label="Arrival Date" value={data.arrivalDate} />
            <Field label="Departure Date" value={data.departureDate} />
            <Field label="Number of Guests" value={data.numberOfGuests} />
            <Field label="Room Number" value={data.roomNumber} />
          </dl>
        </Card>

        <Card>
          <h3 className="font-serif text-2xl text-forest">Emergency Contact</h3>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Field label="Name" value={data.emergencyContactName} />
            <PhoneField label="Telephone" value={data.emergencyContactTelephone} />
            <Field
              label="Special occasions"
              value={data.specialOccasions}
              className="sm:col-span-2"
            />
          </dl>
        </Card>

        {(submission.identityDocuments?.length ?? 0) > 0 && (
          <Card>
            <h3 className="font-serif text-2xl text-forest">
              Client Identity Documentation
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {submission.identityDocuments?.map((document) => (
                <div
                  key={document.id}
                  className="overflow-hidden rounded-lg border border-forest/10 bg-white"
                >
                  {document.data ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={document.data}
                      alt={document.fileName}
                      className="aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    <p className="p-4 text-sm text-forest/50">Image unavailable</p>
                  )}
                  <p className="truncate px-3 py-2 text-sm text-forest/70">
                    {document.fileName}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <h3 className="font-serif text-2xl text-forest">Signatures</h3>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <SignatureBlock
              title="Guest"
              name={data.guestSignatureName}
              signature={data.guestSignature}
              date={data.guestSignatureDate}
            />
            <SignatureBlock
              title="Hotel Representative"
              name={data.hotelRepName}
              signature={data.hotelRepSignature}
              date={data.hotelRepSignatureDate}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[11px] tracking-[0.16em] text-forest/60 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-forest">{value || "—"}</dd>
    </div>
  );
}

function SignatureBlock({
  title,
  name,
  signature,
  date,
}: {
  title: string;
  name: string;
  signature: string;
  date: string;
}) {
  return (
    <div>
      <p className="text-[11px] tracking-[0.16em] text-forest/60 uppercase">
        {title}
      </p>
      <p className="mt-1 font-medium text-forest">{name}</p>
      {signature ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={signature}
          alt={`${title} signature`}
          className="mt-2 max-h-24 rounded-lg border border-forest/10 bg-white"
        />
      ) : (
        <p className="mt-2 text-sm text-forest/50">No signature captured</p>
      )}
      <p className="mt-2 text-sm text-forest/65">Date: {date || "—"}</p>
    </div>
  );
}
