"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Facility {
  id: number;
  name: string;
}

export function TaskNavigation({
  active,
  propertyId,
}: {
  active: "tasks" | "create" | "dashboard";
  propertyId?: string;
}) {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    fetch("/api/tasks/meta")
      .then((response) => response.json())
      .then((data) => {
        setFacilities(data.facilities || []);
        setCanManage(data.role === "admin" || data.role === "manager");
      });
  }, []);

  function selectProperty(value: string) {
    window.location.href = value
      ? `/dashboard/tasks?propertyId=${value}`
      : "/dashboard/tasks";
  }

  return (
    <div className="mb-7 flex flex-wrap items-center gap-2 rounded-2xl border border-gold/20 bg-ivory p-2">
      <div className="min-w-[210px] flex-1">
        <select
          aria-label="Filter tasks by property"
          value={propertyId || ""}
          onChange={(event) => selectProperty(event.target.value)}
          className="w-full rounded-xl border border-forest/15 bg-white px-3.5 py-2.5 text-sm text-forest outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        >
          <option value="">All properties</option>
          {facilities.map((facility) => (
            <option key={facility.id} value={facility.id}>
              {facility.name}
            </option>
          ))}
        </select>
      </div>
      {canManage && (
        <>
          <Link
            href="/dashboard/tasks/create"
            className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
              active === "create"
                ? "bg-forest text-cream"
                : "text-forest hover:bg-cream"
            }`}
          >
            Create Task
          </Link>
          <Link
            href="/dashboard/tasks/dashboard"
            className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
              active === "dashboard"
                ? "bg-forest text-cream"
                : "text-forest hover:bg-cream"
            }`}
          >
            Dashboard
          </Link>
        </>
      )}
    </div>
  );
}
