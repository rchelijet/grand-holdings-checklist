"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GuestRegistrationFields } from "@/components/GuestRegistrationFields";
import { IdentityDocumentCapture } from "@/components/IdentityDocumentCapture";
import { SignaturePad } from "@/components/SignaturePad";
import {
  Badge,
  Button,
  Card,
  Input,
  PageHeader,
} from "@/components/ui";
import {
  ACKNOWLEDGEMENT_CLAUSES,
  emptyGuestRegistrationData,
  type GuestRegistrationData,
} from "@/lib/guest-registration";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface CompleteFormProps {
  submissionId: number;
}

export function GuestRegistrationCompleteForm({ submissionId }: CompleteFormProps) {
  const router = useRouter();
  const [data, setData] = useState<GuestRegistrationData>(
    emptyGuestRegistrationData()
  );
  const [identityFiles, setIdentityFiles] = useState<File[]>([]);
  const [facilityName, setFacilityName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/forms/guest-registration/${submissionId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          return;
        }
        const sub = d.submission;
        if (sub.status === "completed") {
          router.replace(`/dashboard/forms/guest-registration/${submissionId}`);
          return;
        }
        setFacilityName(sub.facilityName);
        setData({
          ...sub.data,
          guestSignatureDate: sub.data.guestSignatureDate || todayIso(),
          hotelRepSignatureDate: sub.data.hotelRepSignatureDate || todayIso(),
        });
      })
      .catch(() => setError("Failed to load registration."))
      .finally(() => setLoading(false));
  }, [submissionId, router]);

  function updateField<K extends keyof GuestRegistrationData>(
    field: K,
    value: GuestRegistrationData[K]
  ) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("data", JSON.stringify(data));
      for (const file of identityFiles) {
        formData.append("identityDocuments", file);
      }

      const res = await fetch(`/api/forms/guest-registration/${submissionId}`, {
        method: "PUT",
        body: formData,
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Failed to complete registration.");
        return;
      }
      router.push(`/dashboard/forms/guest-registration/${submissionId}`);
    } catch {
      setError("Failed to complete registration. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-forest/70">Loading…</p>;
  }

  if (error && !facilityName) {
    return (
      <div>
        <PageHeader title="Registration not found" />
        <p className="text-forest/70">{error}</p>
        <Link href="/dashboard/forms/guest-registration" className="mt-4 inline-block">
          <Button variant="secondary">Back to hub</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Guest arrival"
        description={`Complete registration for ${facilityName}. Optionally capture identity documentation, then collect both signatures.`}
        action={
          <Link href="/dashboard/forms/guest-registration">
            <Button variant="secondary">Back to hub</Button>
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">Guest check-in</Badge>
            <span className="text-sm text-forest/60">{facilityName}</span>
          </div>
        </Card>

        <Card>
          <h3 className="font-serif text-2xl text-forest">Guest Information</h3>
          <div className="mt-4">
            <GuestRegistrationFields
              data={data}
              onChange={updateField}
              requiredFields={{
                fullName: true,
                idPassportNo: true,
                arrivalDate: true,
                departureDate: true,
              }}
            />
          </div>
        </Card>

        <Card>
          <h3 className="font-serif text-2xl text-forest">
            Acknowledgement &amp; Indemnity
          </h3>
          <p className="mt-2 text-sm text-forest/70">
            By signing this form, I/we acknowledge and agree as follows:
          </p>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-forest/80">
            {ACKNOWLEDGEMENT_CLAUSES.map((clause) => (
              <li key={clause}>{clause}</li>
            ))}
          </ol>
        </Card>

        <Card>
          <h3 className="font-serif text-2xl text-forest">
            Client Identity Documentation
          </h3>
          <div className="mt-4">
            <IdentityDocumentCapture
              files={identityFiles}
              onChange={setIdentityFiles}
              disabled={saving}
            />
          </div>
        </Card>

        <Card>
          <h3 className="font-serif text-2xl text-forest">Guest Signature</h3>
          <p className="mt-2 text-sm text-forest/70">
            I/we have read and understood the above and agree to the terms and
            conditions of my/our stay.
          </p>
          <fieldset disabled={saving} className="mt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input
                  label="Name"
                  value={data.guestSignatureName}
                  onChange={(e) =>
                    updateField("guestSignatureName", e.target.value)
                  }
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <SignaturePad
                  label="Signature"
                  value={data.guestSignature}
                  onChange={(v) => updateField("guestSignature", v)}
                />
              </div>
              <Input
                label="Date"
                type="date"
                value={data.guestSignatureDate}
                onChange={(e) =>
                  updateField("guestSignatureDate", e.target.value)
                }
                required
              />
            </div>
          </fieldset>
        </Card>

        <Card>
          <h3 className="font-serif text-2xl text-forest">
            Hotel Representative
          </h3>
          <fieldset disabled={saving} className="mt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input
                  label="Name"
                  value={data.hotelRepName}
                  onChange={(e) => updateField("hotelRepName", e.target.value)}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <SignaturePad
                  label="Signature"
                  value={data.hotelRepSignature}
                  onChange={(v) => updateField("hotelRepSignature", v)}
                />
              </div>
              <Input
                label="Date"
                type="date"
                value={data.hotelRepSignatureDate}
                onChange={(e) =>
                  updateField("hotelRepSignatureDate", e.target.value)
                }
                required
              />
            </div>
          </fieldset>
        </Card>

        {error && (
          <p className="text-sm text-red-800" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Complete & generate PDF"}
          </Button>
          <Link href="/dashboard/forms/guest-registration">
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
