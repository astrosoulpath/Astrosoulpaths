"use client";

import { useRef, useState } from "react";

import {
  uploadChatFile,
  uploadChatImage,
} from "@/services/uploadService";

type ChatAttachmentButtonProps = {
  callSessionId: string;

  onUploaded: (data: {
    url: string;
    fileName: string;
    mimeType: string;
    size: number;
    type: "IMAGE" | "FILE";
  }) => void;
};

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

  async function uploadImage(
    file: File,
  ) {
    try {
      setUploading(true);

      const result =
        await uploadChatImage({
          callSessionId,
          file,
          onProgress: setProgress,
        });

      onUploaded({
        ...result.data,
        type: "IMAGE",
      });
    } catch (error) {
      alert(
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
    try {
      setUploading(true);

      const result =
        await uploadChatFile({
          callSessionId,
          file,
          onProgress: setProgress,
        });

      onUploaded({
        ...result.data,
        type: "FILE",
      });
    } catch (error) {
      alert(
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
    <div className="flex items-center gap-3">
      <input
        ref={imageInputRef}
        hidden
        type="file"
        accept="image/*"
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
        onChange={(event) => {
          const file =
            event.target.files?.[0];

          if (file) {
            void uploadFile(file);
          }

          event.target.value = "";
        }}
      />

      <button
        type="button"
        disabled={uploading}
        onClick={() =>
          imageInputRef.current?.click()
        }
        className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
      >
        🖼 Image
      </button>

      <button
        type="button"
        disabled={uploading}
        onClick={() =>
          fileInputRef.current?.click()
        }
        className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
      >
        📎 File
      </button>

      {uploading && (
        <div className="min-w-[90px] text-xs text-gray-600">
          Uploading {progress}%
        </div>
      )}
    </div>
  );
}