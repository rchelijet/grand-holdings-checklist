import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { getPendingChecklists } from "@/lib/completions";
import { frequencyLabel } from "@/lib/schedule";
import { getPropertyImage, getPropertyKind } from "@/lib/properties";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

export default async function DashboardPage() {
  const user = await getSessionUser();
  const pending = user ? await getPendingChecklists(user) : [];

  return (
    <div>
      <PageHeader
        title="Pending Checklists"
        description="Every checklist assigned to your properties is ready to complete."
      />

      {pending.length === 0 ? (
        <EmptyState message="All caught up — no checklists are due right now." />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {pending.map((item) => (
            <article
              key={`${item.checklistId}-${item.facilityId}-${item.dueDate}`}
              className="overflow-hidden rounded-2xl border border-forest/10 bg-ivory shadow-[0_12px_40px_rgba(26,46,36,0.06)]"
            >
              <div className="relative h-36">
                <img
                  src={getPropertyImage(
                    item.facilityName,
                    item.facilityId,
                    item.facilityAddress
                  )}
                  alt={item.facilityName}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-forest/80 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4">
                  <p className="text-[11px] tracking-[0.2em] text-gold-soft uppercase">
                    {getPropertyKind(item.facilityName, item.facilityAddress)}
                  </p>
                  <h3 className="font-serif text-2xl text-ivory">
                    {item.facilityName}
                  </h3>
                </div>
              </div>
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-forest">{item.checklistName}</p>
                    <Badge tone="warning">{frequencyLabel(item.frequency)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-forest/65">
                    Due {item.dueDate} · {item.itemCount} items
                  </p>
                </div>
                <Link
                  href={`/dashboard/complete?checklistId=${item.checklistId}&facilityId=${item.facilityId}&dueDate=${item.dueDate}`}
                  className="inline-flex rounded-xl bg-forest px-4 py-2.5 text-sm font-medium tracking-[0.12em] text-cream uppercase hover:bg-forest-deep"
                >
                  Complete
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
