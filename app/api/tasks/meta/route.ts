import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { accessibleFacilityIds, canManageTask } from "@/lib/tasks";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const facilityIds = await accessibleFacilityIds(user);
  const placeholders = facilityIds.map(() => "?").join(",") || "NULL";
  const facilities = await db
    .prepare(`SELECT id, name, address FROM facilities WHERE id IN (${placeholders}) ORDER BY name`)
    .all(...facilityIds);

  const users = canManageTask(user)
    ? await db
        .prepare(
          `SELECT id, name, email, role, facility_id FROM users
       WHERE active = 1
         AND (role = 'admin' OR facility_id IN (${placeholders}))
       ORDER BY name`
        )
        .all(...facilityIds)
    : [];

  return NextResponse.json({ facilities, users, role: user.role });
}
