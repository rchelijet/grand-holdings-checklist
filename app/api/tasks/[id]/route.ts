import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { canManageTask, getTask } from "@/lib/tasks";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

async function fileToData(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Files must be smaller than 8 MB");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  return {
    name: file.name,
    type: file.type || "application/octet-stream",
    data: `data:${file.type || "application/octet-stream"};base64,${bytes.toString("base64")}`,
  };
}

async function filesToData(form: FormData) {
  const entries = form.getAll("files");
  const fallback = form.get("file");
  const values = entries.length > 0 ? entries : fallback ? [fallback] : [];
  const files = [];
  for (const value of values) {
    const file = await fileToData(value);
    if (file) files.push(file);
  }
  return files;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const detail = await getTask(user, Number(id));
  if (!detail) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json(detail);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const taskId = Number(id);
    const detail = await getTask(user, taskId);
    if (!detail) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const form = await request.formData();
    const currentProgress = Number(
      (detail.task as { progress?: number }).progress ?? 0
    );
    const requestedProgress = Math.min(
      100,
      Math.max(0, Number(form.get("progress") ?? currentProgress))
    );
    const progress = canManageTask(user) ? requestedProgress : currentProgress;
    const note = String(form.get("note") || "").trim();
    const files = await filesToData(form);
    const hasAssignment = form.has("assignedUserId");
    const assignedUserValue = String(form.get("assignedUserId") || "");
    const assignedUserId = assignedUserValue ? Number(assignedUserValue) : null;
    const status = progress >= 100 ? "closed" : "pending";
    const closedAt = progress >= 100 ? "datetime('now')" : "NULL";
    const db = await getDb();

    if (hasAssignment && assignedUserId && canManageTask(user)) {
      const assignee = (await db
        .prepare(
          `SELECT u.id, u.role, u.facility_id, u.access_all,
                  EXISTS(SELECT 1 FROM user_facilities uf
                         WHERE uf.user_id = u.id AND uf.facility_id = ?) AS assigned_access
           FROM users u WHERE u.id = ? AND u.active = 1`
        )
        .get(
          Number((detail.task as { facility_id?: number }).facility_id),
          assignedUserId
        )) as
        | {
            id: number;
            role: string;
            facility_id: number | null;
            access_all: number;
            assigned_access: number;
          }
        | undefined;
      const facilityId = Number(
        (detail.task as { facility_id?: number }).facility_id
      );
      if (
        !assignee ||
        (user.role !== "admin" &&
          assignee.role !== "admin" &&
          assignee.access_all !== 1 &&
          assignee.assigned_access !== 1 &&
          assignee.facility_id !== facilityId)
      ) {
        return NextResponse.json({ error: "Invalid task assignee" }, { status: 400 });
      }
    }

    if (canManageTask(user) && hasAssignment) {
      await db
        .prepare(
          `UPDATE tasks SET progress = ?, status = ?, closed_at = ${closedAt}, assigned_user_id = ? WHERE id = ?`
        )
        .run(progress, status, assignedUserId, taskId);
    } else if (canManageTask(user)) {
      await db
        .prepare(
          `UPDATE tasks SET progress = ?, status = ?, closed_at = ${closedAt} WHERE id = ?`
        )
        .run(progress, status, taskId);
    }

    let updateId: number | null = null;
    if (note || progress !== currentProgress || files.length > 0) {
      const update = await db
        .prepare(
          `INSERT INTO task_updates (task_id, user_id, note, progress)
           VALUES (?, ?, ?, ?)`
        )
        .run(taskId, user.id, note, progress);
      updateId = Number(update.lastInsertRowid);
    }

    for (const file of files) {
      await db
        .prepare(
          `INSERT INTO task_attachments (task_id, update_id, uploaded_by, file_name, mime_type, data)
         VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(taskId, updateId, user.id, file.name, file.type, file.data);
    }

    return NextResponse.json(await getTask(user, taskId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update task";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAdmin(await getSessionUser());
    const { id } = await params;
    if (!(await getTask(user, Number(id)))) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    await (await getDb()).prepare("DELETE FROM tasks WHERE id = ?").run(Number(id));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}
