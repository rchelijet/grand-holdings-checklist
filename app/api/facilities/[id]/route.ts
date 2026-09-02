import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    requireAdmin(user);

    const { id } = await params;
    const body = await request.json();
    const { name, address, contact_name, contact_phone, contact_email } = body;

    const db = getDb();
    db.prepare(
      `UPDATE facilities SET name = ?, address = ?, contact_name = ?, contact_phone = ?, contact_email = ?
       WHERE id = ?`
    ).run(
      name?.trim() || "",
      address?.trim() || "",
      contact_name?.trim() || "",
      contact_phone?.trim() || "",
      contact_email?.trim() || "",
      id
    );

    const facility = db.prepare(`SELECT * FROM facilities WHERE id = ?`).get(id);
    return NextResponse.json({ facility });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    requireAdmin(user);

    const { id } = await params;
    const db = getDb();
    db.prepare(`DELETE FROM facilities WHERE id = ?`).run(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}
