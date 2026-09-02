import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { requireManager } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canManageChecklist } from "@/lib/checklists";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireManager(await getSessionUser());

    const { id } = await params;
    if (!canManageChecklist(user, Number(id))) {
      return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    }
    const body = await request.json();
    const { description } = body;

    if (!description?.trim()) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const maxOrder = db
      .prepare(
        `SELECT COALESCE(MAX(sort_order), -1) as max_order FROM checklist_items WHERE checklist_id = ?`
      )
      .get(id) as { max_order: number };

    const result = db
      .prepare(
        `INSERT INTO checklist_items (checklist_id, description, sort_order) VALUES (?, ?, ?)`
      )
      .run(id, description.trim(), maxOrder.max_order + 1);

    const item = db
      .prepare(`SELECT * FROM checklist_items WHERE id = ?`)
      .get(result.lastInsertRowid);

    return NextResponse.json({ item }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireManager(await getSessionUser());

    const { id: checklistId } = await params;
    if (!canManageChecklist(user, Number(checklistId))) {
      return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    }
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");

    if (!itemId) {
      return NextResponse.json({ error: "itemId required" }, { status: 400 });
    }

    const db = getDb();
    db.prepare(
      `DELETE FROM checklist_items WHERE id = ? AND checklist_id = ?`
    ).run(itemId, checklistId);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}
