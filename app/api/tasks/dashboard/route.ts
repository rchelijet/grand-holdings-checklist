import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getTaskDashboard } from "@/lib/tasks";
import { canManageTask } from "@/lib/tasks";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageTask(user)) {
    return NextResponse.json({ error: "Manager or administrator access required" }, { status: 403 });
  }
  return NextResponse.json(await getTaskDashboard(user));
}
