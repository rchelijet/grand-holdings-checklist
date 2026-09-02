"use client";

const FOREST = "#1a2e24";
const GOLD = "#b8924a";
const CREAM = "#f7f1e8";
const OVERDUE = "#a84b3f";

export interface StatusBreakdown {
  pending: number;
  closed: number;
  overdue: number;
}

export interface PropertyChartRow {
  id: number;
  name: string;
  average_progress: number;
  on_time_rate: number;
  total: number;
  closed: number;
  pending: number;
}

function pct(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export function StatusDonutChart({ pending, closed, overdue }: StatusBreakdown) {
  const onTrack = Math.max(pending - overdue, 0);
  const total = closed + onTrack + overdue;
  const closedPct = pct(closed, total);
  const onTrackPct = pct(onTrack, total);
  const overduePct = pct(overdue, total);

  const gradient =
    total === 0
      ? CREAM
      : `conic-gradient(
          ${FOREST} 0 ${closedPct}%,
          ${GOLD} ${closedPct}% ${closedPct + onTrackPct}%,
          ${OVERDUE} ${closedPct + onTrackPct}% 100%
        )`;

  const segments = [
    { label: "Closed", value: closed, color: FOREST, pct: closedPct },
    { label: "On track", value: onTrack, color: GOLD, pct: onTrackPct },
    { label: "Overdue", value: overdue, color: OVERDUE, pct: overduePct },
  ];

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative h-44 w-44 shrink-0">
        <div
          className="h-full w-full rounded-full shadow-inner"
          style={{ background: gradient }}
          role="img"
          aria-label={`Task status: ${closed} closed, ${onTrack} on track, ${overdue} overdue`}
        />
        <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-ivory text-center">
          <span className="font-serif text-3xl text-forest">{total}</span>
          <span className="text-[10px] tracking-[0.14em] text-forest/55 uppercase">
            Tasks
          </span>
        </div>
      </div>
      <ul className="grid w-full max-w-xs gap-3 sm:max-w-none">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-3">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            <span className="flex-1 text-sm text-forest/75">{segment.label}</span>
            <span className="font-medium text-forest">{segment.value}</span>
            <span className="w-10 text-right text-xs text-forest/50">
              {segment.pct}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StatusBarChart({ pending, closed, overdue }: StatusBreakdown) {
  const onTrack = Math.max(pending - overdue, 0);
  const max = Math.max(closed, onTrack, overdue, 1);

  const bars = [
    { label: "Closed", value: closed, color: FOREST },
    { label: "On track", value: onTrack, color: GOLD },
    { label: "Overdue", value: overdue, color: OVERDUE },
  ];

  return (
    <div className="space-y-5">
      {bars.map((bar) => (
        <div key={bar.label}>
          <div className="mb-1.5 flex justify-between text-xs text-forest/65">
            <span>{bar.label}</span>
            <span className="font-medium text-forest">{bar.value}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-cream">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(bar.value / max) * 100}%`,
                backgroundColor: bar.color,
                minWidth: bar.value > 0 ? "6px" : undefined,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PropertyComparisonChart({
  properties,
}: {
  properties: PropertyChartRow[];
}) {
  if (properties.length === 0) {
    return (
      <p className="text-sm text-forest/60">No property data available yet.</p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-4 text-[11px] tracking-wide text-forest/60 uppercase">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-forest" />
          Avg. progress
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-gold" />
          On-time rate
        </span>
      </div>
      {properties.map((property) => (
        <div key={property.id}>
          <div className="mb-2 flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
            <p className="font-serif text-lg text-forest">{property.name}</p>
            <p className="text-xs text-forest/55">
              {property.total} tasks · {property.closed} closed · {property.pending}{" "}
              pending
            </p>
          </div>
          <div className="space-y-2">
            <div className="h-2.5 overflow-hidden rounded-full bg-cream">
              <div
                className="h-full rounded-full bg-forest"
                style={{ width: `${property.average_progress}%` }}
              />
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-cream">
              <div
                className="h-full rounded-full bg-gold"
                style={{ width: `${property.on_time_rate}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CompletionGauge({ value }: { value: number }) {
  const clamped = Math.min(Math.max(value, 0), 100);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex h-24 w-24 items-center justify-center">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 88 88" aria-hidden>
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke={CREAM}
          strokeWidth="8"
        />
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke={GOLD}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute font-serif text-2xl text-forest">{clamped}%</span>
    </div>
  );
}
