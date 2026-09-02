import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { NavBar } from "@/components/NavBar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-full bg-cream">
      <NavBar user={user} />
      <div className="relative h-36 overflow-hidden sm:h-44">
        <img
          src="/brand/login-background.jpg"
          alt=""
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-forest/75 via-forest/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-5 mx-auto max-w-6xl px-4">
          <p className="text-[11px] tracking-[0.32em] text-gold-soft uppercase">
            Game lodges · Cape Winelands · Robertson
          </p>
          <p className="font-serif text-2xl text-ivory drop-shadow sm:text-3xl">
            Five-star operations, every property.
          </p>
        </div>
      </div>
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
