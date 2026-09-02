"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/types";
import { Logo } from "./Logo";

const navItems = [
  { href: "/dashboard", label: "Pending", roles: ["admin", "manager", "basic"] },
  { href: "/dashboard/tasks", label: "Tasks", roles: ["admin", "manager", "basic"] },
  { href: "/dashboard/history", label: "History", roles: ["admin", "manager", "basic"] },
  { href: "/dashboard/forms", label: "Forms", roles: ["admin", "manager", "basic"] },
  { href: "/dashboard/facilities", label: "Properties", roles: ["admin"] },
  { href: "/dashboard/checklists", label: "Checklists", roles: ["admin", "manager"] },
  { href: "/dashboard/users", label: "Team", roles: ["admin", "manager"] },
];

export function NavBar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="border-b border-gold/20 bg-forest text-cream">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/dashboard">
          <Logo size="sm" light />
        </Link>
        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-cream">{user.name}</p>
            <p className="text-[11px] tracking-[0.18em] text-gold-soft uppercase">
              {user.role === "admin"
                ? "Estate Director"
                : user.role === "manager"
                  ? "Property Manager"
                  : "Basic User"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-full border border-gold/40 px-4 py-1.5 text-xs tracking-[0.16em] text-cream uppercase hover:bg-white/5"
          >
            Log out
          </button>
        </div>
      </div>
      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3">
        {navItems
          .filter((item) => item.roles.includes(user.role))
          .map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm ${
                  active
                    ? "bg-gold/20 text-gold-soft"
                    : "text-cream/70 hover:bg-white/5 hover:text-cream"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
      </nav>
    </header>
  );
}
