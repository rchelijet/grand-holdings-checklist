import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { searchFormSubmissions } from "@/lib/form-submissions";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? undefined;
  const formSlug = searchParams.get("formSlug") ?? undefined;
  const facilityId = searchParams.get("facilityId");

  const submissions = searchFormSubmissions(user, {
    query,
    formSlug,
    facilityId: facilityId ? Number(facilityId) : undefined,
  });

  return NextResponse.json({ submissions });
}
