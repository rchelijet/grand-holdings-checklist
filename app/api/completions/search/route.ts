import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { searchCompletions } from "@/lib/completions";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const facilityId = searchParams.get("facilityId");

  const results = await searchCompletions(
    user,
    dateFrom,
    dateTo,
    facilityId ? Number(facilityId) : null
  );

  return NextResponse.json({ results });
}
