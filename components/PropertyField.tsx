"use client";

import { Select } from "@/components/ui";
import type { AccessibleFacility } from "@/lib/facility-access";

interface PropertyFieldProps {
  facilities: AccessibleFacility[];
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
  placeholder?: string;
}

export function PropertyField({
  facilities,
  value,
  onChange,
  loading = false,
  placeholder = "Select property…",
}: PropertyFieldProps) {
  if (loading) {
    return (
      <p className="text-sm text-forest/60" aria-live="polite">
        Loading properties…
      </p>
    );
  }

  if (facilities.length === 1) {
    return (
      <div className="text-sm">
        <span className="mb-1.5 block text-[11px] font-medium tracking-[0.16em] text-forest/70 uppercase">
          Property
        </span>
        <p className="rounded-xl border border-forest/10 bg-cream/40 px-3.5 py-2.5 text-ink">
          {facilities[0].name}
        </p>
      </div>
    );
  }

  return (
    <Select
      label="Property"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required
    >
      <option value="">{placeholder}</option>
      {facilities.map((facility) => (
        <option key={facility.id} value={facility.id}>
          {facility.name}
        </option>
      ))}
    </Select>
  );
}
