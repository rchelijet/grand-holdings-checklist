"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PropertyField } from "@/components/PropertyField";
import { Button, Card, Input, PageHeader, Select } from "@/components/ui";
import { TaskNavigation } from "@/components/TaskNavigation";
import { useAccessibleFacilities } from "@/hooks/useAccessibleFacilities";
import {
  MAX_TASK_DOCUMENT_COUNT,
  MAX_TASK_IMAGE_COUNT,
  MAX_UPLOAD_BYTES,
  validateCreateTaskFiles,
} from "@/lib/task-attachments";

interface UserOption {
  id: number;
  name: string;
  email: string;
  role: string;
  facility_id: number | null;
}

function readSelectedFiles(input: HTMLInputElement | null): File[] {
  return input?.files ? Array.from(input.files) : [];
}

export default function CreateTaskPage() {
  const router = useRouter();
  const {
    facilities,
    facilityId,
    setFacilityId,
    loading: facilitiesLoading,
    requiresSelection,
  } = useAccessibleFacilities("/api/tasks/meta");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [assignedUserId, setAssignedUserId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/tasks/meta")
      .then((response) => response.json())
      .then((data) => {
        setUsers(data.users || []);
      });
  }, []);

  function handleImagesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = readSelectedFiles(event.target);
    const validationError = validateCreateTaskFiles([
      ...selected,
      ...documents.map((file) => ({
        name: file.name,
        type: file.type,
        size: file.size,
      })),
    ]);
    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }
    setError("");
    setImages(selected);
  }

  function handleDocumentsChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = readSelectedFiles(event.target);
    const validationError = validateCreateTaskFiles([
      ...images.map((file) => ({
        name: file.name,
        type: file.type,
        size: file.size,
      })),
      ...selected,
    ]);
    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }
    setError("");
    setDocuments(selected);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setWarning("");

    const validationError = validateCreateTaskFiles([...images, ...documents]);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!facilityId) {
      setError(
        requiresSelection
          ? "Please select a property."
          : "Your assigned property could not be determined."
      );
      return;
    }

    setSaving(true);
    const form = new FormData();
    form.set("facilityId", facilityId);
    form.set("title", title);
    form.set("description", description);
    form.set("expectedDate", expectedDate);
    if (assignedUserId) form.set("assignedUserId", assignedUserId);
    images.forEach((file) => form.append("images", file));
    documents.forEach((file) => form.append("documents", file));

    const response = await fetch("/api/tasks", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not create task");
      setSaving(false);
      return;
    }
    if (data.warning) {
      setWarning(data.warning);
      setSaving(false);
      return;
    }
    router.push(`/dashboard/tasks/${data.taskId}`);
  }

  return (
    <div>
      <PageHeader
        title="Create Task"
        description="Give the team a clear brief, an owner, and a date to work towards."
      />
      <TaskNavigation active="create" />

      <Card className="max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <PropertyField
            facilities={facilities}
            value={facilityId}
            onChange={setFacilityId}
            loading={facilitiesLoading}
            placeholder="Select a property"
          />

          <Input
            label="Task name"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Replace dining room light fittings"
          />

          <label className="block text-sm">
            <span className="mb-1.5 block text-[11px] font-medium tracking-[0.16em] text-forest/70 uppercase">
              Task description
            </span>
            <textarea
              required
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add the context, standard, or outcome expected..."
              rows={5}
              className="w-full rounded-xl border border-forest/15 bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Expected completion"
              required
              type="date"
              value={expectedDate}
              onChange={(event) => setExpectedDate(event.target.value)}
            />
            <Select
              label="Assign to user (optional)"
              value={assignedUserId}
              onChange={(event) => setAssignedUserId(event.target.value)}
            >
              <option value="">Leave unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {user.role}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1.5 block text-[11px] font-medium tracking-[0.16em] text-forest/70 uppercase">
                Reference images (optional)
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImagesChange}
                className="block w-full rounded-xl border border-dashed border-gold/40 bg-cream/50 px-3.5 py-3 text-sm text-forest/70"
              />
              <span className="mt-1 block text-xs text-forest/50">
                Up to {MAX_TASK_IMAGE_COUNT} images. Maximum {MAX_UPLOAD_BYTES / (1024 * 1024)} MB each.
              </span>
              {images.length > 0 && (
                <span className="mt-1 block text-xs text-forest/70">
                  {images.length} image{images.length === 1 ? "" : "s"} selected
                </span>
              )}
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block text-[11px] font-medium tracking-[0.16em] text-forest/70 uppercase">
                Reference documents (optional)
              </span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
                multiple
                onChange={handleDocumentsChange}
                className="block w-full rounded-xl border border-dashed border-gold/40 bg-cream/50 px-3.5 py-3 text-sm text-forest/70"
              />
              <span className="mt-1 block text-xs text-forest/50">
                Up to {MAX_TASK_DOCUMENT_COUNT} documents (PDF, Word, Excel, or text). Maximum{" "}
                {MAX_UPLOAD_BYTES / (1024 * 1024)} MB each.
              </span>
              {documents.length > 0 && (
                <span className="mt-1 block text-xs text-forest/70">
                  {documents.length} document{documents.length === 1 ? "" : "s"} selected
                </span>
              )}
            </label>
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
          {warning && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {warning} You can review the created task from the task list.
            </p>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? "Creating task..." : "Create task"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
