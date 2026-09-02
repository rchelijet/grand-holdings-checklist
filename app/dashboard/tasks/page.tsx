"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { TaskNavigation } from "@/components/TaskNavigation";
import type { TaskStatus } from "@/lib/types";

interface TaskRow {
  id: number;
  title: string;
  description: string;
  expected_date: string;
  created_at: string;
  progress: number;
  status: TaskStatus;
  facility_name: string;
  created_by_name: string;
  assigned_user_name: string | null;
}

export default function TasksPage() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get("propertyId") || "";
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | TaskStatus>("pending");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [loading, setLoading] = useState(true);

  const years = useMemo(
    () => Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - index),
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams();
      if (propertyId) params.set("propertyId", propertyId);
      if (search.trim()) params.set("search", search.trim());
      if (status !== "all") params.set("status", status);
      if (month) params.set("month", month);
      if (year) params.set("year", year);

      const response = await fetch(`/api/tasks?${params}`, {
        signal: controller.signal,
      });
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
      setLoading(false);
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [propertyId, search, status, month, year]);

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Keep every property moving, from guest experience to behind-the-scenes operations."
      />
      <TaskNavigation active="tasks" propertyId={propertyId} />

      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Input
              label="Search tasks"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by task name or description"
            />
          </div>
          <Select
            label="Status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as "all" | TaskStatus)
            }
          >
            <option value="all">Pending & closed</option>
            <option value="pending">Pending only</option>
            <option value="closed">Closed only</option>
          </Select>
          <Select
            label="Month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          >
            <option value="">All months</option>
            {Array.from({ length: 12 }, (_, index) => (
              <option key={index + 1} value={index + 1}>
                {new Date(2024, index, 1).toLocaleString("en", {
                  month: "long",
                })}
              </option>
            ))}
          </Select>
          <Select
            label="Year"
            value={year}
            onChange={(event) => setYear(event.target.value)}
          >
            <option value="">All years</option>
            {years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {loading ? (
        <p className="text-forest/70">Loading property tasks...</p>
      ) : tasks.length === 0 ? (
        <EmptyState message="No tasks match these filters." />
      ) : (
        <div className="grid gap-4">
          {tasks.map((task) => (
            <Link key={task.id} href={`/dashboard/tasks/${task.id}`}>
              <Card className="transition hover:-translate-y-0.5 hover:border-gold/50">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-serif text-2xl text-forest">
                        {task.title}
                      </h3>
                      <Badge tone={task.status === "closed" ? "success" : "warning"}>
                        {task.status}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-forest/65">
                      {task.description || "No description added."}
                    </p>
                    <p className="mt-3 text-xs tracking-wide text-forest/55">
                      {task.facility_name} · Added {task.created_at.slice(0, 10)} by{" "}
                      {task.created_by_name} · Due {task.expected_date}
                    </p>
                  </div>
                  <div className="w-full lg:w-48">
                    <div className="mb-1 flex justify-between text-xs text-forest/65">
                      <span>Completion</span>
                      <span className="font-semibold text-forest">{task.progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-cream">
                      <div
                        className="h-full rounded-full bg-gold transition-all"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    <p className="mt-2 text-right text-xs text-gold">View task →</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
