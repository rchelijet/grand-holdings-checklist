import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionUser } from "@/lib/session";
import { assertCanAssignRole, assertCanManageUser, requireAdmin, requireManager } from "@/lib/auth";
import { getDb } from "@/lib/db";

function parseFacilityIds(raw: unknown): number[] {
  const rawFacilityIds: unknown[] = Array.isArray(raw) ? raw : [];
  return [
    ...new Set(
      rawFacilityIds
        .map((id) => Number(id))
        .filter((id): id is number => id > 0)
    ),
  ];
}

function countActiveAdmins(db: ReturnType<typeof getDb>): number {
  const row = db
    .prepare(
      "SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND active = 1"
    )
    .get() as { count: number };
  return row.count;
}

async function updateUser(request: Request, params: Promise<{ id: string }>) {
  const actor = requireManager(await getSessionUser());
  const { id } = await params;
  const userId = Number(id);

  if (!userId) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const role = body.role as string;
  const password = body.password ? String(body.password) : "";
  const accessAll = role !== "admin" && body.access_all === true;
  const facilityIds =
    role === "admin" || accessAll ? [] : parseFacilityIds(body.facility_ids);

  if (!email || !name) {
    return NextResponse.json(
      { error: "Email and name are required" },
      { status: 400 }
    );
  }

  if (!["admin", "manager", "basic"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  try {
    assertCanAssignRole(actor, role as "admin" | "manager" | "basic");
  } catch {
    return NextResponse.json(
      { error: "Only administrators can assign administrator access" },
      { status: 403 }
    );
  }

  if (password && password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  if (role !== "admin" && !accessAll && facilityIds.length === 0) {
    return NextResponse.json(
      {
        error:
          "Managers and basic users need one or more properties, or All properties",
      },
      { status: 400 }
    );
  }

  const db = getDb();
  const target = db
    .prepare("SELECT id, email, role, active FROM users WHERE id = ?")
    .get(userId) as
    | { id: number; email: string; role: string; active: number }
    | undefined;

  if (!target || target.active !== 1) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    assertCanManageUser(actor, target.role as "admin" | "manager" | "basic");
  } catch {
    return NextResponse.json(
      { error: "Only administrators can modify administrator accounts" },
      { status: 403 }
    );
  }

  if (target.role === "admin" && role !== "admin" && countActiveAdmins(db) <= 1) {
    return NextResponse.json(
      { error: "Cannot remove administrator access from the last active administrator" },
      { status: 400 }
    );
  }

  if (userId === actor.id && target.role === "admin" && role !== "admin") {
    return NextResponse.json(
      { error: "You cannot remove your own administrator access" },
      { status: 400 }
    );
  }

  const emailTaken = db
    .prepare("SELECT id FROM users WHERE email = ? AND id != ?")
    .get(email, userId) as { id: number } | undefined;
  if (emailTaken) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }

  if (facilityIds.length > 0) {
    const existingFacilityIds = new Set(
      (
        db
          .prepare(
            `SELECT id FROM facilities WHERE id IN (${facilityIds.map(() => "?").join(",")})`
          )
          .all(...facilityIds) as { id: number }[]
      ).map((facility) => facility.id)
    );
    if (facilityIds.some((facilityId) => !existingFacilityIds.has(facilityId))) {
      return NextResponse.json(
        { error: "One or more selected properties do not exist" },
        { status: 400 }
      );
    }
  }

  const accessAllValue = accessAll || role === "admin" ? 1 : 0;
  const legacyFacilityId = facilityIds[0] ?? null;

  if (password) {
    const passwordHash = bcrypt.hashSync(password, 10);
    db.prepare(
      `UPDATE users
       SET email = ?, name = ?, role = ?, facility_id = ?, access_all = ?, password_hash = ?
       WHERE id = ?`
    ).run(email, name, role, legacyFacilityId, accessAllValue, passwordHash, userId);
  } else {
    db.prepare(
      `UPDATE users
       SET email = ?, name = ?, role = ?, facility_id = ?, access_all = ?
       WHERE id = ?`
    ).run(email, name, role, legacyFacilityId, accessAllValue, userId);
  }

  db.prepare("DELETE FROM user_facilities WHERE user_id = ?").run(userId);
  if (facilityIds.length > 0) {
    const assign = db.prepare(
      "INSERT INTO user_facilities (user_id, facility_id) VALUES (?, ?)"
    );
    for (const facilityId of facilityIds) {
      assign.run(userId, facilityId);
    }
  }

  const user = db
    .prepare(
      `SELECT id, email, name, role, facility_id, access_all, created_at FROM users WHERE id = ?`
    )
    .get(userId);

  return NextResponse.json({ user });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    return await updateUser(request, context.params);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    return await updateUser(request, context.params);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = requireAdmin(await getSessionUser());
    const { id } = await params;
    const userId = Number(id);

    if (!userId) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    if (userId === admin.id) {
      return NextResponse.json(
        { error: "You cannot deactivate your own account" },
        { status: 400 }
      );
    }

    const db = getDb();
    const target = db
      .prepare("SELECT id, role, active FROM users WHERE id = ?")
      .get(userId) as { id: number; role: string; active: number } | undefined;

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (target.active !== 1) {
      return NextResponse.json({ error: "User is already inactive" }, { status: 400 });
    }

    if (target.role === "admin") {
      if (countActiveAdmins(db) <= 1) {
        return NextResponse.json(
          { error: "Cannot deactivate the last active administrator" },
          { status: 400 }
        );
      }
    }

    db.prepare("UPDATE users SET active = 0 WHERE id = ?").run(userId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}
