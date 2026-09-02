import { NextResponse } from "next/server";
import { AVAILABLE_FORMS } from "@/lib/forms";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ forms: AVAILABLE_FORMS });
}
