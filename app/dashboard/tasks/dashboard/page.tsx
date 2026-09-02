"use client";

import { useEffect, useState } from "react";
import { Card, PageHeader } from "@/components/ui";
import { TaskNavigation } from "@/components/TaskNavigation";
import {
  CompletionGauge,
  PropertyComparisonChart,
  StatusBarChart,
  StatusDonutChart,
} from "@/components/TaskDashboardCharts";

interface Summary {
  total: number;
  pending: number;
  closed: number;
  overdue: number;
  average_progress: number;
}

interface PropertyInsight {
  id: number;
  name: string;
  total: number;
  pending: number;
  closed: number;
  average_progress: number;
  on_time: number;
  closed_with_date: number;
}

const SUMMARY_CARDS = [
  {
    key: "total",
    label: "Total tasks",
    detail: "Across all properties",
    accent: "border-l-forest",
  },
  {
    key: "pending",
    label: "Pending",
    detail: "Still in progress",
    accent: "border-l-gold",
  },
  {
    key: "closed",
    label: "Closed",
    detail: "Successfully completed",
    accent: "border-l-emerald-700",
  },
  {
    key: "overdue",
    label: "Overdue",
    detail: "Need attention today",
    accent: "border-l-red-700/80",
  },
] as const;

export default function TasksDashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [properties, setProperties] = useState<PropertyInsight[]>([]);

  useEffect(() => {
    fetch("/api/tasks/dashboard")
      .then((response) => response.json())
      .then((data) => {
        setSummary(data.summary);
        setProperties(data.properties || []);
      });
  }, []);

  const propertyChartRows = properties.map((property) => {
    const onTimeRate = property.closed_with_date
      ? Math.round((property.on_time / property.closed_with_date) * 100)
      : 0;
    return {
      id: property.id,
      name: property.name,
      average_progress: property.average_progress,
      on_time_rate: onTimeRate,
      total: property.total,
      closed: property.closed,
      pending: property.pending,
    };
  });

  return (
    <div>
      <PageHeader
        title="Task Dashboard"
        description="A clear view of delivery, attention, and property performance."
      />
      <TaskNavigation active="dashboard" />

      {!summary ? (
        <p className="text-forest/70">Preparing your estate overview...</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {SUMMARY_CARDS.map(({ key, label, detail, accent }) => (
              <Card
                key={key}
                className={`border-l-4 p-5 ${accent} bg-gradient-to-br from-ivory to-cream/40`}
              >
                <p className="text-[11px] tracking-[0.16em] text-gold uppercase">
                  {label}
                </p>
                <p className="mt-2 font-serif text-4xl text-forest">
                  {summary[key]}
                </p>
                <p className="mt-1 text-xs text-forest/60">{detail}</p>
              </Card>
            ))}
            <Card className="flex items-center justify-between gap-3 border-l-4 border-l-gold-soft bg-gradient-to-br from-ivory to-cream/40 p-5 sm:col-span-2 lg:col-span-1">
              <div>
                <p className="text-[11px] tracking-[0.16em] text-gold uppercase">
                  Avg. progress
                </p>
                <p className="mt-2 text-xs text-forest/60">Across every task</p>
              </div>
              <CompletionGauge value={summary.average_progress} />
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="font-serif text-2xl text-forest">Task status mix</h3>
              <p className="mt-1 text-sm text-forest/65">
                Closed, on-track pending, and overdue work at a glance.
              </p>
              <div className="mt-6">
                <StatusDonutChart
                  pending={summary.pending}
                  closed={summary.closed}
                  overdue={summary.overdue}
                />
              </div>
            </Card>

            <Card>
              <h3 className="font-serif text-2xl text-forest">Volume by status</h3>
              <p className="mt-1 text-sm text-forest/65">
                Relative counts help spot where attention is needed.
              </p>
              <div className="mt-8">
                <StatusBarChart
                  pending={summary.pending}
                  closed={summary.closed}
                  overdue={summary.overdue}
                />
              </div>
            </Card>
          </div>

          <Card className="mt-6">
            <h3 className="font-serif text-2xl text-forest">
              Property comparison
            </h3>
            <p className="mt-1 text-sm text-forest/65">
              Progress and on-time closure rates side by side for each estate.
            </p>
            <div className="mt-6">
              <PropertyComparisonChart properties={propertyChartRows} />
            </div>
          </Card>

          <Card className="mt-6">
            <h3 className="font-serif text-2xl text-forest">
              Property performance
            </h3>
            <p className="mt-1 text-sm text-forest/65">
              On-time rate is measured against the expected completion date.
            </p>
            <div className="mt-6 space-y-6">
              {properties.map((property) => {
                const onTimeRate = property.closed_with_date
                  ? Math.round(
                      (property.on_time / property.closed_with_date) * 100
                    )
                  : 0;
                return (
                  <div
                    key={property.id}
                    className="rounded-xl border border-forest/8 bg-cream/30 p-4"
                  >
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                      <div>
                        <p className="font-serif text-xl text-forest">
                          {property.name}
                        </p>
                        <p className="text-xs text-forest/60">
                          {property.total} tasks · {property.closed} closed ·{" "}
                          {property.pending} pending
                        </p>
                      </div>
                      <p className="text-sm font-medium text-gold">
                        {onTimeRate}% on time
                      </p>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div>
                        <div className="mb-1 flex justify-between text-[11px] text-forest/60">
                          <span>Progress</span>
                          <span>{property.average_progress}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-cream">
                          <div
                            className="h-2 rounded-full bg-forest"
                            style={{ width: `${property.average_progress}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-[11px] text-forest/60">
                          <span>On-time closures</span>
                          <span>
                            {property.on_time}/{property.closed_with_date}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-cream">
                          <div
                            className="h-2 rounded-full bg-gold"
                            style={{ width: `${onTimeRate}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
