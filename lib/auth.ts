import bcrypt from "bcryptjs";
import { getDb } from "./db";
import type { SessionUser, UserRole } from "./types";

async function getUserFacilityIds(userId: number): Promise<number[]> {
  const db = await getDb();
  return (
    (await db
      .prepare("SELECT facility_id FROM user_facilities WHERE user_id = ?")
      .all(userId)) as { facility_id: number }[]
  ).map((row) => row.facility_id);
}

export type AuthResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "invalid_credentials" | "inactive" };

export async function authenticateUser(
  email: string,
  password: string
): Promise<AuthResult> {
  const db = await getDb();
  const row = (await db
    .prepare(
      `SELECT id, email, password_hash, name, role, facility_id, access_all, active
       FROM users WHERE email = ?`
    )
    .get(email)) as
    | {
        id: number;
        email: string;
        password_hash: string;
        name: string;
        role: UserRole;
        facility_id: number | null;
        access_all: number;
        active: number;
      }
    | undefined;

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return { ok: false, reason: "invalid_credentials" };
  }

  if (row.active !== 1) {
    return { ok: false, reason: "inactive" };
  }

  return {
    ok: true,
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      facilityId: row.facility_id,
      facilityIds: await getUserFacilityIds(row.id),
      accessAll: row.access_all === 1 || row.role === "admin",
    },
  };
}

export function requireRole(
  user: SessionUser | null,
  roles: UserRole[]
): SessionUser {
  if (!user || !roles.includes(user.role)) {
    throw new Error("Unauthorized");
  }
  return user;
}

export function requireAdmin(user: SessionUser | null): SessionUser {
  return requireRole(user, ["admin"]);
}

export function requireManager(user: SessionUser | null): SessionUser {
  return requireRole(user, ["admin", "manager"]);
}

export function requireBasic(user: SessionUser | null): SessionUser {
  return requireRole(user, ["basic"]);
}

export function assertCanAssignRole(actor: SessionUser, role: UserRole): void {
  if (role === "admin" && actor.role !== "admin") {
    throw new Error("Forbidden");
  }
}

export function assertCanManageUser(
  actor: SessionUser,
  targetRole: UserRole
): void {
  if (targetRole === "admin" && actor.role !== "admin") {
    throw new Error("Forbidden");
  }
}
