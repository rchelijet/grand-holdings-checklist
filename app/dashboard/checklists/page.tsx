"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { frequencyLabel } from "@/lib/schedule";
import type { Frequency } from "@/lib/types";

interface Facility {
  id: number;
  name: string;
}

interface Checklist {
  id: number;
  name: string;
  frequency: Frequency;
  itemCount: number;
  facilities: Facility[];
}

export default function ChecklistsPage() {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [selectedFacilities, setSelectedFacilities] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [checklistsRes, facilitiesRes] = await Promise.all([
      fetch("/api/checklists"),
      fetch("/api/facilities"),
    ]);
    const checklistsData = await checklistsRes.json();
    const facilitiesData = await facilitiesRes.json();
    setChecklists(checklistsData.checklists || []);
    setFacilities(facilitiesData.facilities || []);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/checklists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        frequency,
        facilityIds: selectedFacilities,
      }),
    });
    setName("");
    setFrequency("daily");
    setSelectedFacilities([]);
    setShowForm(false);
    load();
  }

  function toggleFacility(id: number) {
    setSelectedFacilities((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this checklist?")) return;
    await fetch(`/api/checklists/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <PageHeader
        title="Checklists"
        description="Housekeeping, engineering, and guest-experience standards for each property."
        action={
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "Create checklist"}
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <Input
              label="Checklist name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Daily Checks"
            />
            <Select
              label="Frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as Frequency)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly (first Monday)</option>
              <option value="monthly">Monthly (1st of month)</option>
              <option value="quarterly">Quarterly (Jan, Apr, Jul, Oct)</option>
              <option value="yearly">Yearly (1st of January)</option>
            </Select>

            <div>
              <p className="mb-2 text-[11px] font-medium tracking-[0.16em] text-forest/70 uppercase">
                Assign to properties
              </p>
              <div className="flex flex-wrap gap-2">
                {facilities.map((f) => (
                  <label
                    key={f.id}
                    className={`cursor-pointer rounded-full border px-3 py-2 text-sm ${
                      selectedFacilities.includes(f.id)
                        ? "border-gold bg-gold/10 text-forest"
                        : "border-forest/15 text-forest/80"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={selectedFacilities.includes(f.id)}
                      onChange={() => toggleFacility(f.id)}
                    />
                    {f.name}
                  </label>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={selectedFacilities.length === 0}>
              Create checklist
            </Button>
          </form>
        </Card>
      )}

      {loading ? (
        <p className="text-forest/70">Loading...</p>
      ) : checklists.length === 0 ? (
        <EmptyState message="No checklists created yet." />
      ) : (
        <div className="grid gap-4">
          {checklists.map((c) => (
            <Card key={c.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-serif text-2xl text-forest">
                      {c.name}
                    </h3>
                    <Badge>{frequencyLabel(c.frequency)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-forest/65">
                    {c.itemCount} items · Assigned to{" "}
                    {c.facilities.map((f) => f.name).join(", ")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/dashboard/checklists/${c.id}`}>
                    <Button variant="secondary">Manage items</Button>
                  </Link>
                  <Button variant="danger" onClick={() => handleDelete(c.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
