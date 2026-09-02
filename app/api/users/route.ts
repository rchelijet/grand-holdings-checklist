import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionUser } from "@/lib/session";
import { assertCanAssignRole, requireManager } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const user = await getSessionUser();
    const actor = requireManager(user);

    const db = getDb();
    const users = db
      .prepare(
        `
      SELECT u.id, u.email, u.name, u.role, u.facility_id, u.access_all, u.created_at,
             GROUP_CONCAT(DISTINCT f.name) AS facility_names,
             GROUP_CONCAT(DISTINCT uf.facility_id) AS facility_id_list
      FROM users u
      LEFT JOIN user_facilities uf ON uf.user_id = u.id
      LEFT JOIN facilities f ON f.id = uf.facility_id
      WHERE u.active = 1
      GROUP BY u.id
      ORDER BY u.name
    `
      )
      .all() as Array<Record<string, unknown>>;

    const usersWithFacilities = users.map((user) => {
      const facilityIdList = user.facility_id_list as string | null;
      const facility_ids = facilityIdList
        ? facilityIdList.split(",").map((id) => Number(id)).filter((id) => id > 0)
        : user.facility_id
          ? [Number(user.facility_id)]
          : [];
      const { facility_id_list: _facilityIdList, ...rest } = user;
      return { ...rest, facility_ids };
    });

    return NextResponse.json({
      users: usersWithFacilities,
      currentUserId: actor.id,
      currentUserRole: actor.role,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    const actor = requireManager(user);

    const body = await request.json();
    const { email, password, name, role } = body;
    const accessAll = role !== "admin" && body.access_all === true;
    const rawFacilityIds: unknown[] = Array.isArray(body.facility_ids)
      ? body.facility_ids
      : [];
    const facilityIds: number[] = [
      ...new Set(
        rawFacilityIds
          .map((id) => Number(id))
          .filter((id): id is number => id > 0)
      ),
    ];

    if (!email?.trim() || !password || !name?.trim()) {
      return NextResponse.json(
        { error: "Email, password, and name are required" },
        { status: 400 }
      );
    }

    if (!["admin", "manager", "basic"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    try {
      assertCanAssignRole(actor, role);
    } catch {
      return NextResponse.json(
        { error: "Only administrators can create administrator accounts" },
        { status: 403 }
      );
    }

    if (role !== "admin" && !accessAll && facilityIds.length === 0) {
      return NextResponse.json(
        { error: "Managers and basic users need one or more properties, or All properties" },
        { status: 400 }
      );
    }

    const db = getDb();
    const existingFacilityIds = new Set(
      (db
        .prepare(
          `SELECT id FROM facilities WHERE id IN (${facilityIds.map(() => "?").join(",") || "NULL"})`
        )
        .all(...facilityIds) as { id: number }[]).map((facility) => facility.id)
    );
    if (facilityIds.some((facilityId) => !existingFacilityIds.has(facilityId))) {
      return NextResponse.json({ error: "One or more selected properties do not exist" }, { status: 400 });
    }
    const passwordHash = bcrypt.hashSync(password, 10);

    try {
      const result = db
        .prepare(
          `INSERT INTO users (email, password_hash, name, role, facility_id, access_all)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          email.trim().toLowerCase(),
          passwordHash,
          name.trim(),
          role,
          facilityIds[0] || null,
          accessAll || role === "admin" ? 1 : 0
        );

      const newUser = db
        .prepare(
          `SELECT id, email, name, role, facility_id, access_all, created_at FROM users WHERE id = ?`
        )
        .get(result.lastInsertRowid);
      if (facilityIds.length > 0) {
        const assign = db.prepare(
          "INSERT INTO user_facilities (user_id, facility_id) VALUES (?, ?)"
        );
        for (const facilityId of facilityIds) {
          assign.run(result.lastInsertRowid, facilityId);
        }
      }

      return NextResponse.json({ user: newUser }, { status: 201 });
    } catch {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 409 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}
