"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, Input, PageHeader, Select } from "@/components/ui";
import { frequencyLabel } from "@/lib/schedule";
import type { Frequency } from "@/lib/types";

interface Facility {
  id: number;
  name: string;
}

interface ChecklistItem {
  id: number;
  description: string;
  sort_order: number;
}

export default function ChecklistDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [allFacilities, setAllFacilities] = useState<Facility[]>([]);
  const [selectedFacilities, setSelectedFacilities] = useState<number[]>([]);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [checklistRes, facilitiesRes] = await Promise.all([
      fetch(`/api/checklists/${id}`),
      fetch("/api/facilities"),
    ]);

    const checklistData = await checklistRes.json();
    const facilitiesData = await facilitiesRes.json();

    if (checklistData.checklist) {
      setName(checklistData.checklist.name);
      setFrequency(checklistData.checklist.frequency);
      setItems(checklistData.items || []);
      setSelectedFacilities(
        (checklistData.facilities || []).map((f: Facility) => f.id)
      );
    }
    setAllFacilities(facilitiesData.facilities || []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function saveChecklist() {
    await fetch(`/api/checklists/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        frequency,
        facilityIds: selectedFacilities,
      }),
    });
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;
    await fetch(`/api/checklists/${id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: newItem }),
    });
    setNewItem("");
    load();
  }

  async function deleteItem(itemId: number) {
    await fetch(`/api/checklists/${id}/items?itemId=${itemId}`, {
      method: "DELETE",
    });
    load();
  }

  function toggleFacility(fid: number) {
    setSelectedFacilities((prev) =>
      prev.includes(fid) ? prev.filter((f) => f !== fid) : [...prev, fid]
    );
  }

  if (loading) return <p className="text-forest/70">Loading...</p>;

  return (
    <div>
      <PageHeader
        title="Manage checklist"
        description="Edit checklist settings and add checklist items."
        action={
          <Link href="/dashboard/checklists">
            <Button variant="secondary">Back to list</Button>
          </Link>
        }
      />

      <Card className="mb-6">
        <div className="space-y-4">
          <Input
            label="Checklist name"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
              Assigned properties
            </p>
            <div className="flex flex-wrap gap-2">
              {allFacilities.map((f) => (
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

          <div className="flex items-center gap-2">
            <Badge>{frequencyLabel(frequency)}</Badge>
            <Button onClick={saveChecklist}>Save changes</Button>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 font-serif text-2xl text-forest">
          Checklist items
        </h3>

        <form onSubmit={addItem} className="mb-4 flex gap-2">
          <input
            className="flex-1 rounded-xl border border-forest/15 bg-white px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            placeholder="e.g. Check Wi-Fi is operational"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
          />
          <Button type="submit">Add item</Button>
        </form>

        <ol className="space-y-2">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-forest/10 px-4 py-3"
            >
              <span className="text-sm text-forest">
                {index + 1}. {item.description}
              </span>
              <Button variant="danger" onClick={() => deleteItem(item.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
