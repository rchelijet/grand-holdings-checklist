"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { getPropertyImage } from "@/lib/properties";

interface CompletionItem {
  id: number;
  description: string;
  completed: number;
  note: string | null;
}

export default function HistoryDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [detail, setDetail] = useState<{
    completion: {
      checklist_name: string;
      facility_name: string;
      due_date: string;
      submitted_at: string | null;
      status: string;
      user_name: string | null;
    };
    items: CompletionItem[];
  } | null>(null);

  useEffect(() => {
    fetch(`/api/completions/${id}`)
      .then((r) => r.json())
      .then(setDetail);
  }, [id]);

  if (!detail) return <p className="text-forest/70">Loading house record...</p>;

  return (
    <div>
      <div className="mb-6 overflow-hidden rounded-2xl">
        <div className="relative h-36">
          <img
            src={getPropertyImage(detail.completion.facility_name)}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-forest/75 to-transparent" />
        </div>
      </div>
      <PageHeader
        title={detail.completion.checklist_name}
        description={`${detail.completion.facility_name} · Due ${detail.completion.due_date}`}
        action={
          <Link href="/dashboard/history">
            <Button variant="secondary">Back to search</Button>
          </Link>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap gap-4 text-sm text-forest/70">
          <Badge tone={detail.completion.status === "completed" ? "success" : "warning"}>
            {detail.completion.status}
          </Badge>
          {detail.completion.submitted_at && (
            <span>Submitted: {detail.completion.submitted_at}</span>
          )}
          {detail.completion.user_name && (
            <span>By: {detail.completion.user_name}</span>
          )}
        </div>
      </Card>

      <Card>
        <ol className="space-y-3">
          {detail.items.map((item, index) => (
            <li
              key={item.id}
              className="rounded-xl border border-forest/10 px-4 py-3"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded text-xs ${
                    item.completed
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {item.completed ? "✓" : "✗"}
                </span>
                <div>
                  <p className="font-medium text-forest">
                    {index + 1}. {item.description}
                  </p>
                  {item.note && (
                    <p className="mt-1 text-sm text-forest/65">Note: {item.note}</p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
