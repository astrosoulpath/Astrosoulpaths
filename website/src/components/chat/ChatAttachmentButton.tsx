"use client";

import { useRef, useState } from "react";

import {
  uploadChatFile,
  uploadChatImage,
} from "@/services/uploadService";

type UploadedAttachment = {
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  type: "IMAGE" | "FILE";
};

type ChatAttachmentButtonProps = {
  callSessionId: string;
  onUploaded: (
    data: UploadedAttachment,
  ) => void;
};

const MAX_IMAGE_SIZE =
  10 * 1024 * 1024;

const MAX_FILE_SIZE =
  20 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES =
  new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
  ]);

const ALLOWED_FILE_TYPES =
  new Set([
    "application/pdf",
    "application/zip",
    "application/x-zip-compressed",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/ogg",
    "audio/webm",
  ]);

export function ChatAttachmentButton({
  callSessionId,
  onUploaded,
}: ChatAttachmentButtonProps) {
  const imageInputRef =
    useRef<HTMLInputElement>(null);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [uploading, setUploading] =
    useState(false);

  const [progress, setProgress] =
    useState(0);

  const [error, setError] =
    useState("");

  function validateCallSessionId():
    string | null {
    const normalized =
      callSessionId.trim();

    if (!normalized) {
      setError(
        "Consultation ID is missing.",
      );

      return null;
    }

    return normalized;
  }

  async function uploadImage(
    file: File,
  ) {
    const normalizedCallSessionId =
      validateCallSessionId();

    if (!normalizedCallSessionId) {
      return;
    }

    if (
      file.size <= 0
    ) {
      setError(
        "Selected image is empty or invalid.",
      );

      return;
    }

    if (
      file.size >
      MAX_IMAGE_SIZE
    ) {
      setError(
        "Maximum image size is 10 MB.",
      );

      return;
    }

    if (
      !ALLOWED_IMAGE_TYPES.has(
        file.type,
      )
    ) {
      setError(
        "Unsupported image type. Use JPG, PNG, WEBP or GIF.",
      );

      return;
    }

    try {
      setUploading(true);
      setProgress(0);
      setError("");

      const result =
        await uploadChatImage({
          callSessionId:
            normalizedCallSessionId,

          file,

          onProgress:
            setProgress,
        });

      onUploaded({
        ...result.data,
        type: "IMAGE",
      });
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Image upload failed.",
      );
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function uploadFile(
    file: File,
  ) {
    const normalizedCallSessionId =
      validateCallSessionId();

    if (!normalizedCallSessionId) {
      return;
    }

    if (
      file.size <= 0
    ) {
      setError(
        "Selected file is empty or invalid.",
      );

      return;
    }

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      setError(
        "Maximum file size is 20 MB.",
      );

      return;
    }

    if (
      !ALLOWED_FILE_TYPES.has(
        file.type,
      )
    ) {
      setError(
        "Unsupported file type. Use PDF, ZIP, DOC, DOCX, XLS, XLSX, TXT or supported audio files.",
      );

      return;
    }

    try {
      setUploading(true);
      setProgress(0);
      setError("");

      const result =
        await uploadChatFile({
          callSessionId:
            normalizedCallSessionId,

          file,

          onProgress:
            setProgress,
        });

      onUploaded({
        ...result.data,
        type: "FILE",
      });
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "File upload failed.",
      );
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={imageInputRef}
        hidden
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif"
        disabled={uploading}
        onChange={(event) => {
          const file =
            event.target.files?.[0];

          if (file) {
            void uploadImage(file);
          }

          event.target.value = "";
        }}
      />

      <input
        ref={fileInputRef}
        hidden
        type="file"
        accept=".pdf,.zip,.doc,.docx,.xls,.xlsx,.txt,.mp3,.wav,.ogg,.webm"
        disabled={uploading}
        onChange={(event) => {
          const file =
            event.target.files?.[0];

          if (file) {
            void uploadFile(file);
          }

          event.target.value = "";
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={uploading}
          onClick={() => {
            setError("");
            imageInputRef.current?.click();
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          🖼 Image
        </button>

        <button
          type="button"
          disabled={uploading}
          onClick={() => {
            setError("");
            fileInputRef.current?.click();
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          📎 File
        </button>

        {uploading && (
          <div className="min-w-[120px]">
            <p className="text-xs text-gray-600">
              Uploading {progress}%
            </p>

            <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-[#D4AF37] transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      0,
                      progress,
                    ),
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="text-sm text-red-600"
        >
          {error}
        </p>
      )}
    </div>
  );
}