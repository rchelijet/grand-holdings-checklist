import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { requireManager } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canAssignChecklistFacilities, canManageChecklist } from "@/lib/checklists";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await canManageChecklist(user, Number(id)))) {
    return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
  }
  const db = await getDb();
  const checklist = await db
    .prepare(`SELECT * FROM checklists WHERE id = ?`)
    .get(id);

  if (!checklist) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const facilities = await db
    .prepare(
      `
    SELECT f.id, f.name FROM facilities f
    JOIN checklist_facilities cf ON cf.facility_id = f.id
    WHERE cf.checklist_id = ?
  `
    )
    .all(id);

  const items = await db
    .prepare(
      `SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY sort_order`
    )
    .all(id);

  return NextResponse.json({ checklist, facilities, items });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireManager(await getSessionUser());

    const { id } = await params;
    if (!(await canManageChecklist(user, Number(id)))) {
      return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    }
    const body = await request.json();
    const { name, frequency, facilityIds } = body;
    const normalizedFacilityIds = Array.isArray(facilityIds)
      ? [...new Set(facilityIds.map(Number).filter((facilityId: number) => facilityId > 0))]
      : [];

    if (!name?.trim() || !["daily", "weekly", "monthly", "quarterly", "yearly"].includes(frequency) ||
        normalizedFacilityIds.length === 0) {
      return NextResponse.json({ error: "Name, frequency, and at least one property are required" }, { status: 400 });
    }
    if (!(await canAssignChecklistFacilities(user, normalizedFacilityIds))) {
      return NextResponse.json({ error: "You cannot assign a checklist to one or more properties" }, { status: 403 });
    }
    const db = await getDb();
    await db
      .prepare(`UPDATE checklists SET name = ?, frequency = ? WHERE id = ?`)
      .run(name?.trim(), frequency, id);

    if (Array.isArray(facilityIds)) {
      await db.prepare(`DELETE FROM checklist_facilities WHERE checklist_id = ?`).run(id);
      const assign = db.prepare(
        `INSERT INTO checklist_facilities (checklist_id, facility_id) VALUES (?, ?)`
      );
      for (const fid of normalizedFacilityIds) {
        await assign.run(id, fid);
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireManager(await getSessionUser());

    const { id } = await params;
    if (!(await canManageChecklist(user, Number(id)))) {
      return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    }
    const db = await getDb();
    await db.prepare(`DELETE FROM checklists WHERE id = ?`).run(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}
