import { getDb } from "./db";
import { accessibleFacilityIds } from "./tasks";
import type { SessionUser } from "./types";

export function canManageChecklist(
  user: SessionUser,
  checklistId?: number
): boolean {
  if (user.role === "admin") return true;
  if (user.role !== "manager" || !checklistId) return false;

  const ids = accessibleFacilityIds(user);
  if (ids.length === 0) return false;
  const placeholders = ids.map(() => "?").join(",");
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN facility_id IN (${placeholders}) THEN 1 ELSE 0 END) AS allowed
       FROM checklist_facilities
       WHERE checklist_id = ?`
    )
    .get(...ids, checklistId) as { total: number; allowed: number };
  return row.total > 0 && row.total === row.allowed;
}

export function canAssignChecklistFacilities(
  user: SessionUser,
  facilityIds: number[]
): boolean {
  if (user.role === "admin") return true;
  if (user.role !== "manager" || facilityIds.length === 0) return false;
  const allowed = new Set(accessibleFacilityIds(user));
  return facilityIds.every((id) => allowed.has(id));
}
