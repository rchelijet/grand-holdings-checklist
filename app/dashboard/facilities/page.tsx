"use client";

import { useEffect, useState } from "react";
import { Button, Card, EmptyState, Input, PageHeader } from "@/components/ui";
import { getPropertyImage, getPropertyKind } from "@/lib/properties";

interface Facility {
  id: number;
  name: string;
  address: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
}

const emptyForm = {
  name: "",
  address: "",
  contact_name: "",
  contact_phone: "",
  contact_email: "",
};

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/facilities");
    const data = await res.json();
    setFacilities(data.facilities || []);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editingId ? `/api/facilities/${editingId}` : "/api/facilities";
    const method = editingId ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setForm(emptyForm);
    setEditingId(null);
    load();
  }

  function startEdit(facility: Facility) {
    setEditingId(facility.id);
    setForm({
      name: facility.name,
      address: facility.address,
      contact_name: facility.contact_name,
      contact_phone: facility.contact_phone,
      contact_email: facility.contact_email,
    });
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this facility?")) return;
    await fetch(`/api/facilities/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <PageHeader
        title="Properties"
        description="Game lodges, Cape Winelands hotels, and the Robertson valley estate."
      />

      <Card className="mb-8">
        <h3 className="mb-1 font-serif text-2xl text-forest">
          {editingId ? "Edit property" : "Add a property"}
        </h3>
        <p className="mb-5 text-sm text-forest/65">
          Name, address, and the general manager details for this house.
        </p>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Property name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <Input
            label="General manager"
            value={form.contact_name}
            onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
          />
          <Input
            label="Contact phone"
            value={form.contact_phone}
            onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
          />
          <Input
            label="Contact email"
            type="email"
            value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
          />
          <div className="flex items-end gap-2 sm:col-span-2">
            <Button type="submit">
              {editingId ? "Update property" : "Add property"}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>

      {loading ? (
        <p className="text-forest/70">Loading properties...</p>
      ) : facilities.length === 0 ? (
        <EmptyState message="No properties added yet." />
      ) : (
        <div className="grid gap-5 md:grid-cols-3">
          {facilities.map((f) => (
            <article
              key={f.id}
              className="overflow-hidden rounded-2xl border border-forest/10 bg-ivory shadow-[0_12px_40px_rgba(26,46,36,0.06)]"
            >
              <div className="relative h-44">
                <img
                  src={getPropertyImage(f.name, f.id, f.address)}
                  alt={f.name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-forest/75 to-transparent" />
                <p className="absolute bottom-3 left-4 text-[11px] tracking-[0.22em] text-gold-soft uppercase">
                  {getPropertyKind(f.name, f.address)}
                </p>
              </div>
              <div className="p-5">
                <h3 className="font-serif text-2xl text-forest">{f.name}</h3>
                <p className="mt-1 text-sm text-forest/65">{f.address}</p>
                <div className="gold-rule my-4" />
                <p className="text-sm text-forest/80">
                  {f.contact_name || "General manager"}
                </p>
                <p className="text-sm text-forest/60">
                  {f.contact_phone}
                  {f.contact_email && ` · ${f.contact_email}`}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button variant="secondary" onClick={() => startEdit(f)}>
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => handleDelete(f.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
