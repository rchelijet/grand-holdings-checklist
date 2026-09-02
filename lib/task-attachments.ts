export const MAX_TASK_IMAGE_COUNT = 4;
export const MAX_TASK_DOCUMENT_COUNT = 2;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"] as const;
export const DOCUMENT_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "txt"] as const;

export type TaskFileKind = "image" | "document";

export interface TaskFileInput {
  name: string;
  type?: string;
  size: number;
}

function fileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() || "";
}

export function classifyTaskFile(name: string, mimeType = ""): TaskFileKind | null {
  const extension = fileExtension(name);
  if (mimeType.startsWith("image/") || IMAGE_EXTENSIONS.includes(extension as (typeof IMAGE_EXTENSIONS)[number])) {
    return "image";
  }
  if (DOCUMENT_EXTENSIONS.includes(extension as (typeof DOCUMENT_EXTENSIONS)[number])) {
    return "document";
  }
  return null;
}

export function validateCreateTaskFiles(files: TaskFileInput[]): string | null {
  let imageCount = 0;
  let documentCount = 0;

  for (const file of files) {
    if (file.size <= 0) continue;
    if (file.size > MAX_UPLOAD_BYTES) {
      return "Each file must be smaller than 8 MB";
    }

    const kind = classifyTaskFile(file.name, file.type || "");
    if (!kind) {
      return `"${file.name}" is not a supported file type`;
    }
    if (kind === "image") {
      imageCount += 1;
      if (imageCount > MAX_TASK_IMAGE_COUNT) {
        return `You can upload up to ${MAX_TASK_IMAGE_COUNT} images`;
      }
      continue;
    }

    documentCount += 1;
    if (documentCount > MAX_TASK_DOCUMENT_COUNT) {
      return `You can upload up to ${MAX_TASK_DOCUMENT_COUNT} documents`;
    }
  }

  return null;
}
