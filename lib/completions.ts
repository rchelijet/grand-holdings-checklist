import { getDb } from "./db";
import {
  addCalendarDays,
  formatDateKey,
  getCurrentPeriodDueDateKey,
  getDueDatesInRange,
  getPendingPeriods,
  isCurrentPeriodDueDate,
  isPastPeriodDueDate,
  parseDateKey,
} from "./schedule";
import type { Frequency, SessionUser } from "./types";
import { accessibleFacilityIds } from "./tasks";

const HISTORY_DEFAULT_DAYS = 90;

export interface PendingChecklist {
  checklistId: number;
  checklistName: string;
  frequency: Frequency;
  facilityId: number;
  facilityName: string;
  facilityAddress: string;
  dueDate: string;
  completionId: number | null;
  itemCount: number;
}

export interface CompletionSearchResult {
  id: number | null;
  checklist_name: string;
  frequency: Frequency;
  facility_name: string;
  due_date: string;
  submitted_at: string | null;
  status: string;
  completed_by: string | null;
}

function getFacilityIdsForUser(user: SessionUser): number[] {
  return accessibleFacilityIds(user);
}

export function getPendingChecklists(
  user: SessionUser,
  referenceDate: Date = new Date()
): PendingChecklist[] {
  const db = getDb();
  const facilityIds = getFacilityIdsForUser(user);
  if (facilityIds.length === 0) return [];

  const placeholders = facilityIds.map(() => "?").join(",");
  const assignments = db
    .prepare(
      `
    SELECT c.id as checklist_id, c.name as checklist_name, c.frequency,
           f.id as facility_id, f.name as facility_name, f.address as facility_address
    FROM checklists c
    JOIN checklist_facilities cf ON cf.checklist_id = c.id
    JOIN facilities f ON f.id = cf.facility_id
    WHERE f.id IN (${placeholders})
    ORDER BY c.name, f.name
  `
    )
    .all(...facilityIds) as {
    checklist_id: number;
    checklist_name: string;
    frequency: Frequency;
    facility_id: number;
    facility_name: string;
    facility_address: string;
  }[];

  const pending: PendingChecklist[] = [];

  for (const row of assignments) {
    const completions = db
      .prepare(
        `SELECT id, due_date as dueDate, status FROM checklist_completions
         WHERE checklist_id = ? AND facility_id = ?`
      )
      .all(row.checklist_id, row.facility_id) as {
      id: number;
      dueDate: string;
      status: string;
    }[];

    const itemCount = db
      .prepare(
        `SELECT COUNT(*) as count FROM checklist_items WHERE checklist_id = ?`
      )
      .get(row.checklist_id) as { count: number };

    for (const period of getPendingPeriods(
      row.frequency,
      referenceDate,
      completions
    )) {
      pending.push({
        checklistId: row.checklist_id,
        checklistName: row.checklist_name,
        frequency: row.frequency,
        facilityId: row.facility_id,
        facilityName: row.facility_name,
        facilityAddress: row.facility_address,
        dueDate: period.dueDate,
        completionId: period.completionId,
        itemCount: itemCount.count,
      });
    }
  }

  return pending.sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) ||
      a.facilityName.localeCompare(b.facilityName) ||
      a.checklistName.localeCompare(b.checklistName)
  );
}

export function canAccessCompletion(
  user: SessionUser,
  completionId: number
): boolean {
  const row = getDb()
    .prepare("SELECT facility_id FROM checklist_completions WHERE id = ?")
    .get(completionId) as { facility_id: number } | undefined;
  return Boolean(row && accessibleFacilityIds(user).includes(row.facility_id));
}

function syncCompletionItems(completionId: number, checklistId: number) {
  const db = getDb();
  const templateItems = db
    .prepare(
      `SELECT id FROM checklist_items WHERE checklist_id = ? ORDER BY sort_order`
    )
    .all(checklistId) as { id: number }[];

  const existingItems = db
    .prepare(
      `SELECT item_id FROM checklist_completion_items WHERE completion_id = ?`
    )
    .all(completionId) as { item_id: number }[];

  const existingIds = new Set(existingItems.map((item) => item.item_id));
  const templateIds = new Set(templateItems.map((item) => item.id));

  const insertItem = db.prepare(
    `INSERT OR IGNORE INTO checklist_completion_items (completion_id, item_id, completed) VALUES (?, ?, 0)`
  );
  for (const item of templateItems) {
    if (!existingIds.has(item.id)) {
      insertItem.run(completionId, item.id);
    }
  }

  const completion = db
    .prepare(`SELECT status FROM checklist_completions WHERE id = ?`)
    .get(completionId) as { status: string } | undefined;

  if (completion?.status === "pending") {
    const remove = db.prepare(
      `DELETE FROM checklist_completion_items WHERE completion_id = ? AND item_id = ?`
    );
    for (const item of existingItems) {
      if (!templateIds.has(item.item_id)) {
        remove.run(completionId, item.item_id);
      }
    }
  }
}

export function assertCompletableCurrentPeriod(
  frequency: Frequency,
  dueDate: string,
  referenceDate: Date = new Date()
): void {
  if (!isCurrentPeriodDueDate(frequency, dueDate, referenceDate)) {
    throw new Error("This checklist period is no longer available to complete.");
  }
}

export function getOrCreateCompletion(
  checklistId: number,
  facilityId: number,
  dueDate: string,
  userId: number,
  referenceDate: Date = new Date()
): number {
  const db = getDb();
  const checklist = db
    .prepare(`SELECT frequency FROM checklists WHERE id = ?`)
    .get(checklistId) as { frequency: Frequency } | undefined;

  if (!checklist) {
    throw new Error("Checklist not found.");
  }

  assertCompletableCurrentPeriod(
    checklist.frequency,
    dueDate,
    referenceDate
  );
  const existing = db
    .prepare(
      `SELECT id FROM checklist_completions
       WHERE checklist_id = ? AND facility_id = ? AND due_date = ?`
    )
    .get(checklistId, facilityId, dueDate) as { id: number } | undefined;

  if (existing) {
    const row = db
      .prepare(`SELECT status FROM checklist_completions WHERE id = ?`)
      .get(existing.id) as { status: string };

    if (row.status === "completed") {
      db.prepare(
        `UPDATE checklist_completions SET status = 'pending', submitted_at = NULL, user_id = ? WHERE id = ?`
      ).run(userId, existing.id);
      db.prepare(
        `UPDATE checklist_completion_items SET completed = 0, note = NULL WHERE completion_id = ?`
      ).run(existing.id);
    }

    syncCompletionItems(existing.id, checklistId);
    return existing.id;
  }

  const result = db
    .prepare(
      `INSERT INTO checklist_completions (checklist_id, facility_id, user_id, due_date, status)
       VALUES (?, ?, ?, ?, 'pending')`
    )
    .run(checklistId, facilityId, userId, dueDate);

  const completionId = Number(result.lastInsertRowid);
  syncCompletionItems(completionId, checklistId);
  return completionId;
}

export function searchCompletions(
  user: SessionUser,
  dateFrom: string | null,
  dateTo: string | null,
  facilityId: number | null,
  referenceDate: Date = new Date()
): CompletionSearchResult[] {
  const db = getDb();
  const facilityIds = getFacilityIdsForUser(user);
  if (facilityIds.length === 0) return [];

  const scopedFacilityIds = facilityId
    ? facilityIds.filter((id) => id === facilityId)
    : facilityIds;
  if (scopedFacilityIds.length === 0) return [];

  const effectiveTo = dateTo || getCurrentPeriodDueDateKey("daily", referenceDate);
  const effectiveFrom =
    dateFrom || addCalendarDays(effectiveTo, -(HISTORY_DEFAULT_DAYS - 1));

  const placeholders = scopedFacilityIds.map(() => "?").join(",");
  const assignments = db
    .prepare(
      `
    SELECT c.id as checklist_id, c.name as checklist_name, c.frequency,
           f.id as facility_id, f.name as facility_name
    FROM checklists c
    JOIN checklist_facilities cf ON cf.checklist_id = c.id
    JOIN facilities f ON f.id = cf.facility_id
    WHERE f.id IN (${placeholders})
    ORDER BY c.name, f.name
  `
    )
    .all(...scopedFacilityIds) as {
    checklist_id: number;
    checklist_name: string;
    frequency: Frequency;
    facility_id: number;
    facility_name: string;
  }[];

  const dbRecords = db
    .prepare(
      `
    SELECT cc.id, c.name as checklist_name, c.frequency, f.name as facility_name,
           cc.checklist_id, cc.facility_id,
           cc.due_date, cc.submitted_at, cc.status, u.name as completed_by
    FROM checklist_completions cc
    JOIN checklists c ON c.id = cc.checklist_id
    JOIN facilities f ON f.id = cc.facility_id
    LEFT JOIN users u ON u.id = cc.user_id
    WHERE cc.facility_id IN (${placeholders})
      AND cc.due_date >= ?
      AND cc.due_date <= ?
    ORDER BY cc.due_date DESC, f.name, c.name
  `
    )
    .all(...scopedFacilityIds, effectiveFrom, effectiveTo) as {
    id: number;
    checklist_id: number;
    checklist_name: string;
    frequency: Frequency;
    facility_id: number;
    facility_name: string;
    due_date: string;
    submitted_at: string | null;
    status: string;
    completed_by: string | null;
  }[];

  const rangeStart = parseDateKey(effectiveFrom);
  const rangeEnd = parseDateKey(effectiveTo);
  const results = new Map<string, CompletionSearchResult>();

  for (const record of dbRecords) {
    const displayStatus =
      record.status === "completed"
        ? "completed"
        : isPastPeriodDueDate(record.frequency, record.due_date, referenceDate)
          ? "missed"
          : null;

    if (!displayStatus) continue;

    const key = `${record.checklist_id}:${record.facility_id}:${record.due_date}`;
    results.set(key, {
      id: record.id,
      checklist_name: record.checklist_name,
      frequency: record.frequency,
      facility_name: record.facility_name,
      due_date: record.due_date,
      submitted_at: record.submitted_at,
      status: displayStatus,
      completed_by: record.completed_by,
    });
  }

  for (const assignment of assignments) {
    const dueDates = getDueDatesInRange(
      assignment.frequency,
      rangeStart,
      rangeEnd
    );

    for (const dueDate of dueDates) {
      const dueDateKey = formatDateKey(dueDate);
      if (
        !isPastPeriodDueDate(
          assignment.frequency,
          dueDateKey,
          referenceDate
        )
      ) {
        continue;
      }

      const key = `${assignment.checklist_id}:${assignment.facility_id}:${dueDateKey}`;
      if (results.has(key)) continue;

      results.set(key, {
        id: null,
        checklist_name: assignment.checklist_name,
        frequency: assignment.frequency,
        facility_name: assignment.facility_name,
        due_date: dueDateKey,
        submitted_at: null,
        status: "missed",
        completed_by: null,
      });
    }
  }

  return Array.from(results.values()).sort(
    (a, b) =>
      b.due_date.localeCompare(a.due_date) ||
      a.facility_name.localeCompare(b.facility_name) ||
      a.checklist_name.localeCompare(b.checklist_name)
  );
}

export function getCompletionDetail(completionId: number) {
  const db = getDb();
  const completion = db
    .prepare(
      `
    SELECT cc.*, c.name as checklist_name, c.frequency, f.name as facility_name, u.name as user_name
    FROM checklist_completions cc
    JOIN checklists c ON c.id = cc.checklist_id
    JOIN facilities f ON f.id = cc.facility_id
    LEFT JOIN users u ON u.id = cc.user_id
    WHERE cc.id = ?
  `
    )
    .get(completionId);

  if (!completion) return null;

  const items = db
    .prepare(
      `
    SELECT cci.*, ci.description, ci.sort_order
    FROM checklist_completion_items cci
    JOIN checklist_items ci ON ci.id = cci.item_id
    WHERE cci.completion_id = ?
    ORDER BY ci.sort_order
  `
    )
    .all(completionId);

  return { completion, items };
}
