"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GuestRegistrationFields } from "@/components/GuestRegistrationFields";
import { PropertyField } from "@/components/PropertyField";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { useAccessibleFacilities } from "@/hooks/useAccessibleFacilities";
import {
  emptyGuestRegistrationData,
  type GuestRegistrationData,
} from "@/lib/guest-registration";

interface PrepareFormProps {
  submissionId?: number;
}

export function GuestRegistrationPrepareForm({ submissionId }: PrepareFormProps) {
  const router = useRouter();
  const {
    facilities,
    facilityId,
    setFacilityId,
    loading: facilitiesLoading,
    requiresSelection,
  } = useAccessibleFacilities();
  const [data, setData] = useState<GuestRegistrationData>(
    emptyGuestRegistrationData()
  );
  const [status, setStatus] = useState<"draft" | "prepared">("prepared");
  const [loading, setLoading] = useState(!!submissionId);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!submissionId) return;
    fetch(`/api/forms/guest-registration/${submissionId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          return;
        }
        const sub = d.submission;
        if (sub.status === "completed") {
          setError("This registration is already completed.");
          return;
        }
        setData(sub.data);
        setStatus(sub.status === "draft" ? "draft" : "prepared");
        setFacilityId(String(sub.facilityId));
      })
      .catch(() => setError("Failed to load preparation."))
      .finally(() => setLoading(false));
  }, [submissionId, setFacilityId]);

  function updateField<K extends keyof GuestRegistrationData>(
    field: K,
    value: GuestRegistrationData[K]
  ) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(saveStatus: "draft" | "prepared") {
    setError("");

    if (!facilityId) {
      setError(
        requiresSelection
          ? "Please select a property."
          : "Your assigned property could not be determined."
      );
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/forms/guest-registration/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityId: Number(facilityId),
          data,
          status: saveStatus,
          id: submissionId,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Failed to save preparation.");
        return;
      }
      router.push("/dashboard/forms/guest-registration");
    } catch {
      setError("Failed to save preparation. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-forest/70">Loading…</p>;
  }

  return (
    <div>
      <PageHeader
        title={submissionId ? "Edit preparation" : "New preparation"}
        description="Enter guest details before arrival. Signatures are collected when the guest checks in."
        action={
          <Link href="/dashboard/forms/guest-registration">
            <Button variant="secondary">Back to hub</Button>
          </Link>
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave(status);
        }}
        className="space-y-6"
      >
        <Card>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge tone="warning">Pre-arrival</Badge>
            {status === "draft" && <Badge>Draft</Badge>}
          </div>
          <PropertyField
            facilities={facilities}
            value={facilityId}
            onChange={setFacilityId}
            loading={facilitiesLoading}
          />
        </Card>

        <Card>
          <h3 className="font-serif text-2xl text-forest">Guest Information</h3>
          <div className="mt-4">
            <GuestRegistrationFields data={data} onChange={updateField} />
          </div>
        </Card>

        {error && (
          <p className="text-sm text-red-800" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={saving}
            onClick={() => {
              setStatus("draft");
              handleSave("draft");
            }}
          >
            {saving && status === "draft" ? "Saving…" : "Save draft"}
          </Button>
          <Button
            type="submit"
            disabled={saving}
            onClick={() => setStatus("prepared")}
          >
            {saving && status === "prepared" ? "Saving…" : "Mark as prepared"}
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
