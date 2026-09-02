"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge, Button, Card, PageHeader } from "@/components/ui";

interface AttachmentRow {
  id: number;
  file_name: string;
  mime_type: string;
  data: string;
  created_at: string;
  uploaded_by_name: string;
}

interface UpdateRow {
  id: number;
  note: string;
  progress: number;
  created_at: string;
  user_name: string;
  is_creation?: boolean;
  attachments: AttachmentRow[];
}

interface TaskDetail {
  task: {
    id: number;
    facility_id: number;
    title: string;
    description: string;
    expected_date: string;
    created_at: string;
    progress: number;
    status: "pending" | "closed";
    closed_at: string | null;
    facility_name: string;
    facility_address: string;
    created_by_name: string;
    created_by_email: string;
    assigned_user_id: number | null;
    assigned_user_name: string | null;
    assigned_user_email: string | null;
  };
  updates: UpdateRow[];
}

function normalizeTaskDetail(data: TaskDetail): TaskDetail {
  return {
    task: data.task,
    updates: (data.updates ?? []).map((update) => ({
      ...update,
      attachments: update.attachments ?? [],
    })),
  };
}

interface UserOption {
  id: number;
  name: string;
  email: string;
  role: string;
  facility_id: number | null;
}

interface LightboxImage {
  src: string;
  alt: string;
}

function TimelineAttachments({
  attachments = [],
  onImageClick,
}: {
  attachments?: AttachmentRow[];
  onImageClick: (image: LightboxImage) => void;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {attachments.map((attachment) =>
        attachment.mime_type.startsWith("image/") ? (
          <button
            key={attachment.id}
            type="button"
            onClick={() =>
              onImageClick({ src: attachment.data, alt: attachment.file_name })
            }
            className="overflow-hidden rounded-xl border border-forest/10 bg-cream/60 text-left hover:border-gold focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
          >
            <img
              src={attachment.data}
              alt={attachment.file_name}
              className="h-32 w-full object-cover"
            />
            <div className="p-2.5">
              <p className="truncate text-xs font-medium text-forest">
                {attachment.file_name}
              </p>
            </div>
          </button>
        ) : (
          <a
            key={attachment.id}
            href={attachment.data}
            download={attachment.file_name}
            target="_blank"
            rel="noreferrer"
            className="flex h-32 flex-col items-center justify-center rounded-xl border border-forest/10 bg-cream/60 p-3 hover:border-gold"
          >
            <span className="text-xs font-medium tracking-[0.12em] text-forest/60 uppercase">
              Document
            </span>
            <p className="mt-2 truncate text-xs font-medium text-forest">
              {attachment.file_name}
            </p>
          </a>
        )
      )}
    </div>
  );
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [role, setRole] = useState("basic");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<LightboxImage | null>(null);

  const load = useCallback(async () => {
    const [response, metaResponse] = await Promise.all([
      fetch(`/api/tasks/${id}`),
      fetch("/api/tasks/meta"),
    ]);
    if (!response.ok) {
      setError("This task could not be found.");
      return;
    }
    const data = await response.json();
    const meta = metaResponse.ok ? await metaResponse.json() : { users: [] };
    setDetail(normalizeTaskDetail(data));
    setProgress(data.task.progress);
    setAssignedUserId(
      data.task.assigned_user_id ? String(data.task.assigned_user_id) : ""
    );
    setUsers(meta.users || []);
    setRole(meta.role || "basic");
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!lightbox) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setLightbox(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox]);

  async function addUpdate(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData();
    form.set("progress", String(progress));
    form.set("note", note);
    form.set("assignedUserId", assignedUserId);
    files.forEach((file) => form.append("files", file));

    const response = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      body: form,
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not save progress");
      setSaving(false);
      return;
    }

    setDetail(normalizeTaskDetail(data));
    setNote("");
    setFiles([]);
    setSaving(false);
    const picker = document.getElementById("task-files") as HTMLInputElement | null;
    if (picker) picker.value = "";
  }

  if (error && !detail) return <p className="text-red-800">{error}</p>;
  if (!detail) return <p className="text-forest/70">Loading task details...</p>;

  const { task } = detail;
  const canManage = role === "admin" || role === "manager";
  const isAdmin = role === "admin";

  async function deleteTask() {
    if (!isAdmin || !confirm("Delete this task permanently?")) return;
    const response = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (response.ok) router.push("/dashboard/tasks");
  }

  return (
    <div>
      <PageHeader
        title={task.title}
        description={`${task.facility_name} · Expected ${task.expected_date}`}
        action={
          <div className="flex gap-2">
            <Link href="/dashboard/tasks">
              <Button variant="secondary">Back to Tasks</Button>
            </Link>
            {isAdmin && <Button variant="danger" onClick={deleteTask}>Delete task</Button>}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] tracking-[0.16em] text-gold uppercase">
                  Original brief
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-forest/80">
                  {task.description || "No description was added."}
                </p>
              </div>
              <Badge tone={task.status === "closed" ? "success" : "warning"}>
                {task.status}
              </Badge>
            </div>
            <div className="gold-rule my-5" />
            <div className="grid gap-3 text-sm text-forest/65 sm:grid-cols-2">
              <p>Added {task.created_at.slice(0, 10)} by {task.created_by_name}</p>
              <p>Assigned to {task.assigned_user_name || "Unassigned"}</p>
              <p>{task.facility_address}</p>
              {task.closed_at && <p>Closed {task.closed_at.slice(0, 10)}</p>}
            </div>
          </Card>

          <Card>
            <h3 className="font-serif text-2xl text-forest">Progress history</h3>
            {detail.updates.length === 0 ? (
              <p className="mt-3 text-sm text-forest/60">
                No progress updates yet. Add the first one on the right.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                {detail.updates.map((update) => (
                  <div
                    key={`${update.id}-${update.created_at}`}
                    className="border-l-2 border-gold/40 pl-4"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="text-sm font-medium text-forest">
                        {update.user_name}
                      </p>
                      <p className="text-xs text-forest/55">
                        {update.created_at.slice(0, 16)}
                      </p>
                    </div>
                    {update.is_creation ? (
                      <p className="mt-1 text-sm text-gold">Task created</p>
                    ) : (
                      <p className="mt-1 text-sm text-gold">
                        {update.progress}% complete
                      </p>
                    )}
                    {update.note && (
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-forest/70">
                        {update.note}
                      </p>
                    )}
                    <TimelineAttachments
                      attachments={update.attachments}
                      onImageClick={setLightbox}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="h-fit lg:sticky lg:top-5">
          <p className="text-[11px] tracking-[0.16em] text-gold uppercase">
            Add progress update
          </p>
          <h3 className="mt-1 font-serif text-2xl text-forest">
            How is the task going?
          </h3>
          <form onSubmit={addUpdate} className="mt-6 space-y-5">
            {canManage && (
              <>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[11px] font-medium tracking-[0.16em] text-forest/70 uppercase">
                    Assigned user
                  </span>
                  <select
                    value={assignedUserId}
                    onChange={(event) => setAssignedUserId(event.target.value)}
                    className="w-full rounded-xl border border-forest/15 bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  >
                    <option value="">Unassigned</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} · {user.role}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-forest/50">
                    Save the update to reassign this task.
                  </span>
                </label>

                <label className="block">
                  <div className="flex items-center justify-between text-sm font-medium text-forest">
                    <span>Percentage complete</span>
                    <span className="font-serif text-2xl text-gold">{progress}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={progress}
                    onChange={(event) => setProgress(Number(event.target.value))}
                    className="mt-4 w-full accent-[#b8924a]"
                  />
                  <div className="mt-1 flex justify-between text-[11px] text-forest/50">
                    <span>Started</span>
                    <span>Closed at 100%</span>
                  </div>
                </label>
              </>
            )}
            {!canManage && (
              <p className="rounded-xl bg-cream px-3 py-2 text-xs text-forest/65">
                Basic users can add notes and files. Managers update progress and assignments.
              </p>
            )}

            <label className="block text-sm">
              <span className="mb-1.5 block text-[11px] font-medium tracking-[0.16em] text-forest/70 uppercase">
                Notes
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Share the latest progress, blockers, or handover details..."
                rows={6}
                className="w-full rounded-xl border border-forest/15 bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block text-[11px] font-medium tracking-[0.16em] text-forest/70 uppercase">
                Add images or documents
              </span>
              <input
                id="task-files"
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                onChange={(event) =>
                  setFiles(Array.from(event.target.files || []))
                }
                className="block w-full rounded-xl border border-dashed border-gold/40 bg-cream/50 px-3 py-3 text-sm text-forest/70"
              />
            </label>

            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            )}

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Saving update..." : "Save progress update"}
            </Button>
          </form>
        </Card>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.alt}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20"
          >
            Close
          </button>
          <img
            src={lightbox.src}
            alt={lightbox.alt}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
