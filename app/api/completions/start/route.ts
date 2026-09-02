import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { canAccessFacility } from "@/lib/tasks";
import {
  getCompletionDetail,
  getOrCreateCompletion,
} from "@/lib/completions";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const { checklistId, facilityId, dueDate } = body;

  if (!checklistId || !facilityId || !dueDate) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!canAccessFacility(user, Number(facilityId))) {
    return NextResponse.json({ error: "You cannot complete this property checklist" }, { status: 403 });
  }
  const assignment = getDb()
    .prepare(
      "SELECT 1 FROM checklist_facilities WHERE checklist_id = ? AND facility_id = ?"
    )
    .get(Number(checklistId), Number(facilityId));
  if (!assignment) {
    return NextResponse.json({ error: "Checklist is not assigned to this property" }, { status: 403 });
  }

  try {
    const completionId = getOrCreateCompletion(
      Number(checklistId),
      Number(facilityId),
      dueDate,
      user.id
    );
    const detail = getCompletionDetail(completionId);
    return NextResponse.json(detail);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start checklist";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
