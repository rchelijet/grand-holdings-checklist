import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, verifySession } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const user = token ? await verifySession(token) : null;

  if (pathname === "/login") {
    if (user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/dashboard")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const adminOnly =
      pathname.startsWith("/dashboard/facilities");
    const managerOnly =
      pathname.startsWith("/dashboard/checklists") ||
      pathname.startsWith("/dashboard/tasks/create") ||
      pathname.startsWith("/dashboard/tasks/dashboard");
    const teamOnly = pathname.startsWith("/dashboard/users");
    if (
      (adminOnly && user.role !== "admin") ||
      (teamOnly && !["admin", "manager"].includes(user.role)) ||
      (managerOnly && !["admin", "manager"].includes(user.role))
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(user ? "/dashboard" : "/login", request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*"],
};
