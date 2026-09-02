"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { frequencyLabel } from "@/lib/schedule";
import type { Frequency } from "@/lib/types";

interface Facility {
  id: number;
  name: string;
}

interface SearchResult {
  id: number | null;
  checklist_name: string;
  frequency: Frequency;
  facility_name: string;
  due_date: string;
  submitted_at: string | null;
  status: string;
  completed_by: string | null;
}

export default function HistoryPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    fetch("/api/facilities")
      .then((r) => r.json())
      .then((d) => setFacilities(d.facilities || []));
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (facilityId) params.set("facilityId", facilityId);

    const res = await fetch(`/api/completions/search?${params}`);
    const data = await res.json();
    setResults(data.results || []);
    setSearched(true);
  }

  return (
    <div>
      <PageHeader
        title="House records"
        description="Search completed and missed checklists by date and property."
      />

      <Card className="mb-6">
        <form
          onSubmit={handleSearch}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Input
            label="From date"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            label="To date"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          <Select
            label="Facility"
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
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              Search
            </Button>
          </div>
        </form>
      </Card>

      {!searched ? (
        <EmptyState message="Use the filters above to search checklist history." />
      ) : results.length === 0 ? (
        <EmptyState message="No checklists found for the selected filters." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-forest/10 text-forest/60">
                  <th className="px-3 py-2 font-medium tracking-[0.12em] uppercase">Checklist</th>
                  <th className="px-3 py-2 font-medium tracking-[0.12em] uppercase">Property</th>
                  <th className="px-3 py-2 font-medium tracking-[0.12em] uppercase">Due date</th>
                  <th className="px-3 py-2 font-medium tracking-[0.12em] uppercase">Status</th>
                  <th className="px-3 py-2 font-medium tracking-[0.12em] uppercase">Completed by</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={`${r.id ?? "missed"}-${r.checklist_name}-${r.facility_name}-${r.due_date}`} className="border-b border-forest/5">
                    <td className="px-3 py-3">
                      <p className="font-medium text-forest">
                        {r.checklist_name}
                      </p>
                      <p className="text-xs text-forest/50">
                        {frequencyLabel(r.frequency)}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-forest/70">{r.facility_name}</td>
                    <td className="px-3 py-3 text-forest/70">{r.due_date}</td>
                    <td className="px-3 py-3">
                      <Badge
                        tone={
                          r.status === "completed"
                            ? "success"
                            : r.status === "missed"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-forest/70">
                      {r.completed_by || "—"}
                    </td>
                    <td className="px-3 py-3">
                      {r.id ? (
                        <Link
                          href={`/dashboard/history/${r.id}`}
                          className="text-sm font-medium text-gold hover:underline"
                        >
                          View
                        </Link>
                      ) : (
                        <span className="text-sm text-forest/40">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
