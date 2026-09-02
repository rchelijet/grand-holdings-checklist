import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { accessibleFacilityIds } from "@/lib/tasks";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const ids = await accessibleFacilityIds(user);
  const placeholders = ids.map(() => "?").join(",") || "NULL";
  const facilities = await db
    .prepare(
      `SELECT id, name, address, contact_name, contact_phone, contact_email, created_at
       FROM facilities WHERE id IN (${placeholders}) ORDER BY name`
    )
    .all(...ids);

  return NextResponse.json({ facilities });
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    requireAdmin(user);

    const body = await request.json();
    const { name, address, contact_name, contact_phone, contact_email } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const db = await getDb();
    const result = await db
      .prepare(
        `INSERT INTO facilities (name, address, contact_name, contact_phone, contact_email)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        name.trim(),
        address?.trim() || "",
        contact_name?.trim() || "",
        contact_phone?.trim() || "",
        contact_email?.trim() || ""
      );

    const facility = await db
      .prepare(`SELECT * FROM facilities WHERE id = ?`)
      .get(result.lastInsertRowid);

    return NextResponse.json({ facility }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}
