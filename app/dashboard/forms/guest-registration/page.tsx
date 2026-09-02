"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WhatsAppButton } from "@/components/PhoneField";
import { buildGuestWhatsAppMessage } from "@/lib/guest-registration";
import { normalizePhone, validatePhone } from "@/lib/phone";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
} from "@/components/ui";
import { useAccessibleFacilities } from "@/hooks/useAccessibleFacilities";
import type { GuestRegistrationStatus } from "@/lib/guest-registration";

interface PendingSubmission {
  id: number;
  facilityId: number;
  facilityName: string;
  status: GuestRegistrationStatus;
  guestName: string;
  guestSurname: string;
  idNumber: string;
  roomNumber: string;
  arrivalDate: string;
  departureDate: string;
  preparedAt: string | null;
  preparedByName: string;
  telephone: string;
}

interface CompletedSubmission {
  id: number;
  facilityId: number;
  facilityName: string;
  guestName: string;
  guestSurname: string;
  idNumber: string;
  roomNumber: string;
  arrivalDate: string;
  departureDate: string;
  completedAt: string | null;
  submittedByName: string;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function guestDisplayName(s: { guestName: string; guestSurname: string }): string {
  return [s.guestName, s.guestSurname].filter(Boolean).join(" ") || "Unnamed guest";
}

export default function GuestRegistrationHubPage() {
  const {
    facilities,
    facilityId,
    setFacilityId,
    loading: facilitiesLoading,
    requiresSelection,
  } = useAccessibleFacilities();
  const [pending, setPending] = useState<PendingSubmission[]>([]);
  const [completed, setCompleted] = useState<CompletedSubmission[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFacilityId, setSearchFacilityId] = useState("");
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (facilityId) params.set("facilityId", facilityId);

    setLoadingPending(true);
    fetch(`/api/forms/guest-registration?${params}`)
      .then((r) => r.json())
      .then((d) => setPending(d.submissions || []))
      .finally(() => setLoadingPending(false));
  }, [facilityId]);

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    setSearching(true);
    const params = new URLSearchParams({ formSlug: "guest-registration" });
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (searchFacilityId) params.set("facilityId", searchFacilityId);

    try {
      const res = await fetch(`/api/forms/search?${params}`);
      const data = await res.json();
      setCompleted(data.submissions || []);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  const showPropertyColumn = facilities.length > 1;

  return (
    <div>
      <PageHeader
        title="Guest Registration"
        description="Prepare guest details before arrival, complete registrations at check-in, and search completed forms."
        action={
          <Link href="/dashboard/forms">
            <Button variant="secondary">All forms</Button>
          </Link>
        }
      />

      <div className="mb-8 flex flex-wrap gap-3">
        <Link href="/dashboard/forms/guest-registration/prepare">
          <Button>New preparation</Button>
        </Link>
      </div>

      <PageHeader
        title="Pending arrivals"
        description="Draft and prepared registrations awaiting guest check-in."
      />

      {!facilitiesLoading && requiresSelection && (
        <Card className="mb-4">
          <Select
            label="Filter by property"
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
          >
            <option value="">All properties</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </Card>
      )}

      {loadingPending ? (
        <p className="text-forest/70">Loading pending registrations…</p>
      ) : pending.length === 0 ? (
        <EmptyState message="No pending registrations. Create a new preparation before guest arrival." />
      ) : (
        <div className="mb-10 grid gap-3">
          {pending.map((s) => {
            const guestName = guestDisplayName(s);
            const whatsAppMessage = buildGuestWhatsAppMessage(
              guestName,
              s.facilityName
            );
            const phoneDisplay =
              s.telephone && !validatePhone(s.telephone)
                ? normalizePhone(s.telephone) || s.telephone
                : null;

            return (
              <Card key={s.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-serif text-xl text-forest">
                        {guestName}
                      </h3>
                      <Badge tone={s.status === "draft" ? "warning" : "success"}>
                        {s.status === "draft" ? "Draft" : "Prepared"}
                      </Badge>
                      {s.idNumber && <Badge>{s.idNumber}</Badge>}
                      {phoneDisplay && (
                        <Badge>
                          <a href={`tel:${phoneDisplay}`} className="hover:text-gold">
                            {phoneDisplay}
                          </a>
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-forest/65">
                      {showPropertyColumn ? `${s.facilityName} · ` : ""}
                      {s.roomNumber ? `Room ${s.roomNumber}` : "No room assigned"}
                      {s.arrivalDate ? ` · ${s.arrivalDate} → ${s.departureDate}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-forest/50">
                      {formatDateTime(s.preparedAt)} · {s.preparedByName}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {s.telephone && (
                      <WhatsAppButton phone={s.telephone} message={whatsAppMessage} />
                    )}
                    <Link href={`/dashboard/forms/guest-registration/prepare/${s.id}`}>
                      <Button variant="secondary">Edit</Button>
                    </Link>
                    <Link href={`/dashboard/forms/guest-registration/${s.id}/complete`}>
                      <Button>Complete check-in</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <PageHeader
        title="Completed registrations"
        description="Search finalized forms by guest name, surname, or ID number."
      />

      <Card className="mb-6">
        <form
          onSubmit={handleSearch}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="sm:col-span-2">
            <Input
              label="Search"
              placeholder="Name, surname, ID number…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {showPropertyColumn && (
            <Select
              label="Property"
              value={searchFacilityId}
              onChange={(e) => setSearchFacilityId(e.target.value)}
            >
              <option value="">All properties</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          )}
          <div className="flex items-end">
            <Button type="submit" className="w-full sm:w-auto" disabled={searching}>
              {searching ? "Searching…" : "Search"}
            </Button>
          </div>
        </form>
      </Card>

      {searched && completed.length === 0 && (
        <EmptyState message="No completed registrations match your search." />
      )}

      {completed.length > 0 && (
        <div className="grid gap-3">
          {completed.map((s) => (
            <Card key={s.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-serif text-xl text-forest">
                      {guestDisplayName(s)}
                    </h3>
                    {s.idNumber && <Badge>{s.idNumber}</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-forest/65">
                    {showPropertyColumn ? `${s.facilityName} · ` : ""}
                    {s.roomNumber ? `Room ${s.roomNumber}` : ""}
                    {s.arrivalDate ? ` · ${s.arrivalDate} → ${s.departureDate}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-forest/50">
                    {formatDateTime(s.completedAt)} · {s.submittedByName}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/dashboard/forms/guest-registration/${s.id}`}>
                    <Button variant="secondary">View</Button>
                  </Link>
                  <a
                    href={`/api/forms/guest-registration/${s.id}?download=pdf`}
                    download
                    title="Download PDF"
                  >
                    <Button variant="secondary">PDF</Button>
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
