"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import type { FormDefinition } from "@/lib/forms";
import { formPath } from "@/lib/forms";

export default function FormsPage() {
  const [forms, setForms] = useState<FormDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/forms")
      .then((r) => r.json())
      .then((data) => setForms(data.forms || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Forms"
        description="Electronic forms for guest services and property operations."
      />

      {loading ? (
        <p className="text-forest/70">Loading...</p>
      ) : forms.length === 0 ? (
        <EmptyState message="No forms are available yet." />
      ) : (
        <div className="grid gap-4">
          {forms.map((form) => (
            <Card key={form.slug}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-serif text-2xl text-forest">{form.name}</h3>
                    <Badge tone="success">Electronic</Badge>
                  </div>
                  <p className="mt-1 text-sm text-forest/65">{form.description}</p>
                </div>
                <Link href={formPath(form.slug)}>
                  <Button variant="secondary">Open hub</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
