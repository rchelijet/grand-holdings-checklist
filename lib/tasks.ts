import { getDb } from "./db";
import type { SessionUser, TaskStatus } from "./types";

export async function accessibleFacilityIds(user: SessionUser): Promise<number[]> {
  const db = await getDb();
  if (user.role === "admin" || user.accessAll) {
    return (
      (await db.prepare("SELECT id FROM facilities").all()) as { id: number }[]
    ).map((row) => row.id);
  }
  const ids = new Set(user.facilityIds);
  if (user.facilityId) ids.add(user.facilityId);
  return [...ids];
}

export async function canAccessFacility(
  user: SessionUser,
  facilityId: number
): Promise<boolean> {
  return (await accessibleFacilityIds(user)).includes(facilityId);
}

export function canManageTask(user: SessionUser): boolean {
  return user.role === "admin" || user.role === "manager";
}

async function taskScope(user: SessionUser) {
  const facilityIds = await accessibleFacilityIds(user);
  return {
    clause:
      facilityIds.length > 0
        ? `t.facility_id IN (${facilityIds.map(() => "?").join(",")})`
        : "1 = 0",
    params: facilityIds as (string | number)[],
  };
}

export async function listTasks(
  user: SessionUser,
  filters: {
    facilityId?: number | null;
    status?: TaskStatus | "all";
    search?: string;
    month?: number | null;
    year?: number | null;
  } = {}
) {
  const db = await getDb();
  const scope = await taskScope(user);
  let query = `
    SELECT t.*, f.name AS facility_name, creator.name AS created_by_name,
           assignee.name AS assigned_user_name
    FROM tasks t
    JOIN facilities f ON f.id = t.facility_id
    JOIN users creator ON creator.id = t.created_by
    LEFT JOIN users assignee ON assignee.id = t.assigned_user_id
    WHERE ${scope.clause}
  `;
  const params = [...scope.params];

  if (filters.facilityId) {
    query += " AND t.facility_id = ?";
    params.push(filters.facilityId);
  }
  if (filters.status && filters.status !== "all") {
    query += " AND t.status = ?";
    params.push(filters.status);
  }
  if (filters.search?.trim()) {
    query += " AND (LOWER(t.title) LIKE LOWER(?) OR LOWER(t.description) LIKE LOWER(?))";
    const search = `%${filters.search.trim()}%`;
    params.push(search, search);
  }
  if (filters.month) {
    query += " AND CAST(strftime('%m', t.expected_date) AS INTEGER) = ?";
    params.push(filters.month);
  }
  if (filters.year) {
    query += " AND CAST(strftime('%Y', t.expected_date) AS INTEGER) = ?";
    params.push(filters.year);
  }

  query +=
    " ORDER BY CASE WHEN t.status = 'pending' THEN 0 ELSE 1 END, t.expected_date ASC, t.created_at DESC";
  return db.prepare(query).all(...params);
}

export type TaskAttachment = {
  id: number;
  file_name: string;
  mime_type: string;
  data: string;
  created_at: string;
  uploaded_by_name: string;
};

export type TaskUpdate = {
  id: number;
  note: string;
  progress: number;
  created_at: string;
  user_name: string;
  is_creation?: boolean;
  attachments: TaskAttachment[];
};

export type TaskDetail = {
  task: Record<string, unknown>;
  updates: TaskUpdate[];
};

export async function getTask(
  user: SessionUser,
  taskId: number
): Promise<TaskDetail | null> {
  const db = await getDb();
  const scope = await taskScope(user);
  const task = await db
    .prepare(
      `SELECT t.*, f.name AS facility_name, f.address AS facility_address,
              creator.name AS created_by_name, creator.email AS created_by_email,
              assignee.name AS assigned_user_name, assignee.email AS assigned_user_email
       FROM tasks t
       JOIN facilities f ON f.id = t.facility_id
       JOIN users creator ON creator.id = t.created_by
       LEFT JOIN users assignee ON assignee.id = t.assigned_user_id
       WHERE t.id = ? AND ${scope.clause}`
    )
    .get(taskId, ...scope.params);

  if (!task) return null;

  type RawUpdate = {
    id: number;
    note: string;
    progress: number;
    created_at: string;
    user_name: string;
  };
  type RawAttachment = {
    id: number;
    update_id: number | null;
    file_name: string;
    mime_type: string;
    data: string;
    created_at: string;
    uploaded_by_name: string;
  };

  const rawUpdates = (await db
    .prepare(
      `SELECT tu.*, u.name AS user_name
       FROM task_updates tu JOIN users u ON u.id = tu.user_id
       WHERE tu.task_id = ? ORDER BY tu.created_at DESC, tu.id DESC`
    )
    .all(taskId)) as RawUpdate[];

  const rawAttachments = (await db
    .prepare(
      `SELECT ta.id, ta.update_id, ta.file_name, ta.mime_type, ta.data,
              ta.created_at, u.name AS uploaded_by_name
       FROM task_attachments ta JOIN users u ON u.id = ta.uploaded_by
       WHERE ta.task_id = ? ORDER BY ta.created_at ASC, ta.id ASC`
    )
    .all(taskId)) as RawAttachment[];

  const attachmentsByUpdate = new Map<number, RawAttachment[]>();
  const creationAttachments: RawAttachment[] = [];

  for (const attachment of rawAttachments) {
    if (attachment.update_id == null) {
      creationAttachments.push(attachment);
      continue;
    }
    const group = attachmentsByUpdate.get(attachment.update_id) ?? [];
    group.push(attachment);
    attachmentsByUpdate.set(attachment.update_id, group);
  }

  const updates: TaskUpdate[] = rawUpdates.map((update) => ({
    ...update,
    attachments: (attachmentsByUpdate.get(update.id) ?? []).map(
      ({ update_id: _updateId, ...attachment }) => attachment
    ),
  }));

  if (creationAttachments.length > 0) {
    const taskRow = task as {
      created_at: string;
      created_by_name: string;
    };
    updates.push({
      id: 0,
      note: "",
      progress: 0,
      created_at: taskRow.created_at,
      user_name: taskRow.created_by_name,
      is_creation: true,
      attachments: creationAttachments.map(
        ({ update_id: _updateId, ...attachment }) => attachment
      ),
    });
  }

  updates.sort((a, b) => {
    const timeDiff =
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.id - a.id;
  });

  return { task: task as TaskDetail["task"], updates };
}

export async function getTaskDashboard(user: SessionUser) {
  const db = await getDb();
  const scope = await taskScope(user);
  const today = new Date().toISOString().slice(0, 10);
  const facilityIds = await accessibleFacilityIds(user);

  const summary = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
              COALESCE(SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END), 0) AS closed,
              COALESCE(SUM(CASE WHEN t.status = 'pending' AND t.expected_date < ? THEN 1 ELSE 0 END), 0) AS overdue,
              ROUND(COALESCE(AVG(t.progress), 0)) AS average_progress
       FROM tasks t WHERE ${scope.clause}`
    )
    .get(today, ...scope.params);

  const properties = await db
    .prepare(
      `SELECT f.id, f.name,
              COUNT(t.id) AS total,
              COALESCE(SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
              COALESCE(SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END), 0) AS closed,
              ROUND(COALESCE(AVG(t.progress), 0)) AS average_progress,
              COALESCE(SUM(CASE WHEN t.status = 'closed' AND date(t.closed_at) <= date(t.expected_date) THEN 1 ELSE 0 END), 0) AS on_time,
              COALESCE(SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END), 0) AS closed_with_date
       FROM facilities f
       LEFT JOIN tasks t ON t.facility_id = f.id
       WHERE f.id IN (${facilityIds.map(() => "?").join(",") || "NULL"})
       GROUP BY f.id, f.name ORDER BY f.name`
    )
    .all(...facilityIds);

  return { summary, properties };
}
