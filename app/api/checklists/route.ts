import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { canAssignChecklistFacilities } from "@/lib/checklists";
import { accessibleFacilityIds } from "@/lib/tasks";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role === "basic") {
    return NextResponse.json({ error: "Manager or administrator access required" }, { status: 403 });
  }

  const db = await getDb();
  const facilityIds = await accessibleFacilityIds(user);
  const placeholders = facilityIds.map(() => "?").join(",") || "NULL";
  const checklists = (await db
    .prepare(
      user.role === "admin"
        ? `SELECT c.* FROM checklists c ORDER BY c.name`
        : `SELECT c.* FROM checklists c
         WHERE EXISTS (
           SELECT 1 FROM checklist_facilities visible_cf
           WHERE visible_cf.checklist_id = c.id
             AND visible_cf.facility_id IN (${placeholders})
         )
         AND NOT EXISTS (
           SELECT 1 FROM checklist_facilities hidden_cf
           WHERE hidden_cf.checklist_id = c.id
             AND hidden_cf.facility_id NOT IN (${placeholders})
         )
         ORDER BY c.name`
    )
    .all(...(user.role === "admin" ? [] : [...facilityIds, ...facilityIds]))) as {
    id: number;
    name: string;
    frequency: string;
  }[];

  const result = await Promise.all(
    checklists.map(async (c) => {
      const facilities = await db
        .prepare(
          `
      SELECT f.id, f.name FROM facilities f
      JOIN checklist_facilities cf ON cf.facility_id = f.id
      WHERE cf.checklist_id = ?
    `
        )
        .all(c.id);

      const items = await db
        .prepare(
          `SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY sort_order`
        )
        .all(c.id);

      return { ...c, facilities, items, itemCount: items.length };
    })
  );

  return NextResponse.json({ checklists: result });
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      throw new Error("Unauthorized");
    }

    const body = await request.json();
    const { name, frequency, facilityIds } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const validFrequencies = ["daily", "weekly", "monthly", "quarterly", "yearly"];
    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json({ error: "Invalid frequency" }, { status: 400 });
    }

    const normalizedFacilityIds = Array.isArray(facilityIds)
      ? [...new Set(facilityIds.map(Number).filter((id: number) => id > 0))]
      : [];
    if (normalizedFacilityIds.length === 0) {
      return NextResponse.json(
        { error: "At least one facility must be selected" },
        { status: 400 }
      );
    }
    if (!(await canAssignChecklistFacilities(user, normalizedFacilityIds))) {
      return NextResponse.json({ error: "You cannot assign a checklist to one or more properties" }, { status: 403 });
    }

    const db = await getDb();
    const result = await db
      .prepare(`INSERT INTO checklists (name, frequency) VALUES (?, ?)`)
      .run(name.trim(), frequency);

    const checklistId = Number(result.lastInsertRowid);
    const assign = db.prepare(
      `INSERT INTO checklist_facilities (checklist_id, facility_id) VALUES (?, ?)`
    );
    for (const fid of normalizedFacilityIds) {
      await assign.run(checklistId, fid);
    }

    const checklist = await db
      .prepare(`SELECT * FROM checklists WHERE id = ?`)
      .get(checklistId);

    return NextResponse.json({ checklist }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}
