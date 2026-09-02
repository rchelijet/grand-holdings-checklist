import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import {
  accessibleFacilityIds,
  canManageTask,
  getTask,
  listTasks,
} from "@/lib/tasks";
import { sendTaskCreatedNotifications } from "@/lib/task-notifications";
import {
  classifyTaskFile,
  MAX_UPLOAD_BYTES,
  validateCreateTaskFiles,
} from "@/lib/task-attachments";

export const runtime = "nodejs";

async function fileToData(file: File) {
  if (file.size <= 0) return null;
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Each file must be smaller than 8 MB");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = file.type || "application/octet-stream";
  return {
    name: file.name,
    type,
    data: `data:${type};base64,${bytes.toString("base64")}`,
  };
}

function collectCreateTaskFiles(form: FormData): File[] {
  const images = form.getAll("images").filter((entry): entry is File => entry instanceof File);
  const documents = form
    .getAll("documents")
    .filter((entry): entry is File => entry instanceof File);
  const legacy = form.get("file");
  const legacyFiles = legacy instanceof File ? [legacy] : [];
  return [...images, ...documents, ...legacyFiles].filter((file) => file.size > 0);
}

async function createTaskFilesToData(form: FormData) {
  const uploads = collectCreateTaskFiles(form);
  const validationError = validateCreateTaskFiles(uploads);
  if (validationError) {
    throw new Error(validationError);
  }

  const files = [];
  for (const upload of uploads) {
    const kind = classifyTaskFile(upload.name, upload.type || "");
    if (!kind) {
      throw new Error(`"${upload.name}" is not a supported file type`);
    }
    const file = await fileToData(upload);
    if (file) files.push(file);
  }
  return files;
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const propertyId = url.searchParams.get("propertyId");
  const status = url.searchParams.get("status") as "pending" | "closed" | "all" | null;
  const month = url.searchParams.get("month");
  const year = url.searchParams.get("year");

  return NextResponse.json({
    tasks: await listTasks(user, {
      facilityId: propertyId ? Number(propertyId) : null,
      status: status || "all",
      search: url.searchParams.get("search") || "",
      month: month ? Number(month) : null,
      year: year ? Number(year) : null,
    }),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageTask(user)) {
    return NextResponse.json({ error: "Manager or administrator access required" }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    const expectedDate = String(form.get("expectedDate") || "").trim();
    const facilityId = Number(form.get("facilityId"));
    const assignedUserIdValue = String(form.get("assignedUserId") || "");
    const assignedUserId = assignedUserIdValue ? Number(assignedUserIdValue) : null;

    if (!title || !expectedDate || !facilityId) {
      return NextResponse.json(
        { error: "Property, task name, and expected completion date are required" },
        { status: 400 }
      );
    }

    if (!(await accessibleFacilityIds(user)).includes(facilityId)) {
      return NextResponse.json({ error: "You cannot create a task for this property" }, { status: 403 });
    }

    const db = await getDb();
    if (assignedUserId) {
      const assignee = (await db
        .prepare(
          `SELECT u.id, u.role, u.facility_id, u.access_all,
                  EXISTS(SELECT 1 FROM user_facilities uf
                         WHERE uf.user_id = u.id AND uf.facility_id = ?) AS assigned_access
           FROM users u WHERE u.id = ? AND u.active = 1`
        )
        .get(facilityId, assignedUserId)) as
        | { id: number; role: string; facility_id: number | null; access_all: number; assigned_access: number }
        | undefined;
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

    const taskResult = await db
      .prepare(
        `INSERT INTO tasks (facility_id, title, description, expected_date, created_by, assigned_user_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(facilityId, title, description, expectedDate, user.id, assignedUserId);
    const taskId = Number(taskResult.lastInsertRowid);

    const files = await createTaskFilesToData(form);
    for (const file of files) {
      await db
        .prepare(
          `INSERT INTO task_attachments (task_id, uploaded_by, file_name, mime_type, data)
         VALUES (?, ?, ?, ?, ?)`
        )
        .run(taskId, user.id, file.name, file.type, file.data);
    }

    let notificationWarning: string | undefined;
    try {
      const facility = (await db
        .prepare("SELECT name FROM facilities WHERE id = ?")
        .get(facilityId)) as { name: string } | undefined;
      if (!facility) throw new Error("Property not found");

      const sentTo = await sendTaskCreatedNotifications(db, facilityId, {
        id: taskId,
        facilityName: facility.name,
        title,
        description,
        expectedDate,
        creatorName: user.name,
        creatorEmail: user.email,
      });
      if (sentTo > 0) {
        console.info(`Task ${taskId} notification sent to ${sentTo} manager(s).`);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "delivery failed";
      console.warn(`Task ${taskId} was created, but manager email notification failed: ${reason}`);
      notificationWarning = "Task created, but manager email notifications could not be sent.";
    }

    return NextResponse.json({ taskId, warning: notificationWarning }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create task";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({ ok: true });
}
