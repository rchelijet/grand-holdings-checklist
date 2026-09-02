import { NextResponse } from "next/server";
import { listPendingGuestRegistrations } from "@/lib/form-submissions";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const facilityId = searchParams.get("facilityId");

  const submissions = listPendingGuestRegistrations(user, {
    facilityId: facilityId ? Number(facilityId) : undefined,
  });

  return NextResponse.json({ submissions });
}
