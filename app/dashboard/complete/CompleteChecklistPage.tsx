"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { getPropertyImage, getPropertyKind } from "@/lib/properties";

interface CompletionItem {
  id: number;
  item_id: number;
  description: string;
  completed: number;
  note: string | null;
  sort_order: number;
}

interface CompletionDetail {
  completion: {
    id: number;
    status: string;
    due_date: string;
    checklist_name: string;
    frequency: string;
    facility_name: string;
  };
  items: CompletionItem[];
}

export default function CompleteChecklistPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const checklistId = searchParams.get("checklistId");
  const facilityId = searchParams.get("facilityId");
  const dueDate = searchParams.get("dueDate");

  const [detail, setDetail] = useState<CompletionDetail | null>(null);
  const [items, setItems] = useState<
    { id: number; completed: boolean; note: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function start() {
      if (!checklistId || !facilityId || !dueDate) {
        setError("Missing checklist information");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/completions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklistId: Number(checklistId),
          facilityId: Number(facilityId),
          dueDate,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not load checklist");
        setLoading(false);
        return;
      }

      const data: CompletionDetail = await res.json();
      setDetail(data);
      setItems(
        data.items.map((item) => ({
          id: item.id,
          completed: item.completed === 1,
          note: item.note || "",
        }))
      );
      setLoading(false);
    }

    start();
  }, [checklistId, facilityId, dueDate]);

  async function save(submit: boolean) {
    if (!detail) return;
    setSaving(true);
    setError("");

    const res = await fetch(`/api/completions/${detail.completion.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, submit }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save");
      setSaving(false);
      return;
    }

    if (submit) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-forest/70">Preparing tonight&apos;s house checks...</p>;
  }

  if (error && !detail) {
    return <p className="text-red-800">{error}</p>;
  }

  if (!detail) return null;

  const isSubmitted = detail.completion.status === "completed";

  return (
    <div>
      <div className="mb-6 overflow-hidden rounded-2xl">
        <div className="relative h-40">
          <img
            src={getPropertyImage(
              detail.completion.facility_name,
              Number(facilityId) || undefined
            )}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-forest/80 to-forest/10" />
          <div className="absolute bottom-4 left-5">
            <p className="text-[11px] tracking-[0.22em] text-gold-soft uppercase">
              {getPropertyKind(detail.completion.facility_name)}
            </p>
            <p className="font-serif text-3xl text-ivory">
              {detail.completion.facility_name}
            </p>
          </div>
        </div>
      </div>
      <PageHeader
        title={detail.completion.checklist_name}
        description={`${detail.completion.facility_name} · Due ${detail.completion.due_date}`}
        action={
          isSubmitted ? (
            <Badge tone="success">Submitted</Badge>
          ) : (
            <Badge tone="warning">In progress</Badge>
          )
        }
      />

      <Card>
        <div className="space-y-4">
          {detail.items.map((item, index) => {
            const state = items.find((i) => i.id === item.id);
            if (!state) return null;

            return (
              <div
                key={item.id}
                className="rounded-xl border border-forest/10 bg-cream/50 p-4"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={state.completed}
                    disabled={isSubmitted}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((i) =>
                          i.id === item.id
                            ? { ...i, completed: e.target.checked }
                            : i
                        )
                      )
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-forest">
                      {index + 1}. {item.description}
                    </p>
                    <textarea
                      placeholder="Add a note if not done or if there is an issue..."
                      value={state.note}
                      disabled={isSubmitted}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((i) =>
                            i.id === item.id ? { ...i, note: e.target.value } : i
                          )
                        )
                      }
                    className="mt-2 w-full rounded-xl border border-forest/15 bg-white px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:bg-cream"
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {!isSubmitted && (
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => save(false)}
            >
              Save progress
            </Button>
            <Button disabled={saving} onClick={() => save(true)}>
              Submit checklist
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
