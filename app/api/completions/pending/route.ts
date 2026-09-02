import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getPendingChecklists } from "@/lib/completions";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await getPendingChecklists(user);
  return NextResponse.json({ pending });
}
