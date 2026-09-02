export const MAX_IDENTITY_DOCUMENT_COUNT = 4;
export const MAX_IDENTITY_UPLOAD_BYTES = 8 * 1024 * 1024;

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"] as const;

export interface IdentityDocumentInput {
  name: string;
  type?: string;
  size: number;
}

export interface StoredIdentityDocument {
  fileName: string;
  mimeType: string;
  data: string;
}

export interface IdentityDocumentAttachment extends StoredIdentityDocument {
  id: number;
}

function fileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() || "";
}

export function isIdentityImageFile(name: string, mimeType = ""): boolean {
  const extension = fileExtension(name);
  return (
    mimeType.startsWith("image/") ||
    IMAGE_EXTENSIONS.includes(extension as (typeof IMAGE_EXTENSIONS)[number])
  );
}

export function validateIdentityDocuments(
  files: IdentityDocumentInput[]
): string | null {
  const nonEmpty = files.filter((file) => file.size > 0);
  if (nonEmpty.length === 0) {
    return null;
  }
  if (nonEmpty.length > MAX_IDENTITY_DOCUMENT_COUNT) {
    return `You can upload up to ${MAX_IDENTITY_DOCUMENT_COUNT} identity document images.`;
  }

  for (const file of nonEmpty) {
    if (file.size > MAX_IDENTITY_UPLOAD_BYTES) {
      return "Each identity document must be smaller than 8 MB.";
    }
    if (!isIdentityImageFile(file.name, file.type || "")) {
      return `"${file.name}" is not a supported image type.`;
    }
  }

  return null;
}
