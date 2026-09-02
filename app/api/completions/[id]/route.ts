import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import {
  assertCompletableCurrentPeriod,
  canAccessCompletion,
  getCompletionDetail,
} from "@/lib/completions";
import type { Frequency } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const detail = await getCompletionDetail(Number(id));
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await canAccessCompletion(user, Number(id)))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json();
  const { items, submit } = body;

  const db = await getDb();
  const completion = (await db
    .prepare(
      `SELECT cc.*, c.frequency
       FROM checklist_completions cc
       JOIN checklists c ON c.id = cc.checklist_id
       WHERE cc.id = ?`
    )
    .get(id)) as { status: string; due_date: string; frequency: string } | undefined;

  if (!completion) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await canAccessCompletion(user, Number(id)))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    assertCompletableCurrentPeriod(
      completion.frequency as Frequency,
      completion.due_date
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "This checklist period has ended.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (completion.status === "completed" && !submit) {
    return NextResponse.json(
      { error: "Checklist already submitted" },
      { status: 400 }
    );
  }

  if (Array.isArray(items)) {
    const update = db.prepare(
      `UPDATE checklist_completion_items SET completed = ?, note = ? WHERE id = ? AND completion_id = ?`
    );
    for (const item of items) {
      await update.run(item.completed ? 1 : 0, item.note || null, item.id, id);
    }
  }

  if (submit) {
    await db
      .prepare(
        `UPDATE checklist_completions SET status = 'completed', submitted_at = datetime('now'), user_id = ? WHERE id = ?`
      )
      .run(user.id, id);
  }

  const detail = await getCompletionDetail(Number(id));
  return NextResponse.json(detail);
}
