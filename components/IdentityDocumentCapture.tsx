"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { MAX_IDENTITY_DOCUMENT_COUNT } from "@/lib/form-attachment-constants";

interface IdentityDocumentCaptureProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

export function IdentityDocumentCapture({
  files,
  onChange,
  disabled = false,
}: IdentityDocumentCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [files]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    if (selected.length === 0) return;

    const combined = [...files, ...selected].slice(0, MAX_IDENTITY_DOCUMENT_COUNT);
    onChange(combined);
    event.target.value = "";
  }

  function removeFile(index: number) {
    onChange(files.filter((_, fileIndex) => fileIndex !== index));
  }

  const atLimit = files.length >= MAX_IDENTITY_DOCUMENT_COUNT;

  return (
    <div>
      <p className="text-sm font-medium text-forest">
        Capture Client Identity Documentation
      </p>
      <p className="mt-1 text-sm text-forest/70">
        Optional: photograph the guest&apos;s ID or passport if available.
        You can capture up to {MAX_IDENTITY_DOCUMENT_COUNT} images.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        onChange={handleFileChange}
        disabled={disabled || atLimit}
      />

      <Button
        type="button"
        variant="secondary"
        className="mt-4"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || atLimit}
      >
        {files.length === 0 ? "Capture or upload" : "Add another image"}
      </Button>

      {files.length > 0 && (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.lastModified}-${index}`}
              className="overflow-hidden rounded-lg border border-forest/10 bg-white"
            >
              {previewUrls[index] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrls[index]}
                  alt={file.name}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : null}
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <p className="truncate text-sm text-forest/80">{file.name}</p>
                <button
                  type="button"
                  className="shrink-0 text-sm text-red-800 underline"
                  onClick={() => removeFile(index)}
                  disabled={disabled}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
