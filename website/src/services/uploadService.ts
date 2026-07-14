const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL;

export type ChatUploadKind =
  | "image"
  | "file";

export type ChatUploadResponse = {
  success: boolean;
  message?: string;
  data: {
    url: string;
    path: string;
    fileName: string;
    mimeType: string;
    size: number;
    type?: "IMAGE" | "FILE";
    caption?: string | null;
  };
};

type UploadOptions = {
  callSessionId: string;
  file: File;
  caption?: string;
  onProgress?: (
    progress: number,
  ) => void;
  signal?: AbortSignal;
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

function getApiBaseUrl(): string {
  const baseUrl =
    API_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not configured.",
    );
  }

  return baseUrl.replace(/\/+$/, "");
}

function getAccessToken(): string {
  if (
    typeof window === "undefined"
  ) {
    throw new Error(
      "Upload is only available in the browser.",
    );
  }

  const token =
    window.localStorage
      .getItem(
        "asp_access_token",
      )
      ?.trim();

  if (!token) {
    throw new Error(
      "LOGIN_REQUIRED",
    );
  }

  return token;
}

function normalizeCallSessionId(
  callSessionId: string,
): string {
  const normalized =
    callSessionId?.trim();

  if (!normalized) {
    throw new Error(
      "Call session ID is required.",
    );
  }

  return normalized;
}

function normalizeCaption(
  caption?: string,
): string | null {
  const normalized =
    caption?.trim();

  if (!normalized) {
    return null;
  }

  if (
    normalized.length > 500
  ) {
    throw new Error(
      "Caption cannot exceed 500 characters.",
    );
  }

  return normalized;
}

function getErrorMessage(
  value: unknown,
  fallback: string,
): string {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return fallback;
  }

  const record =
    value as Record<
      string,
      unknown
    >;

  const message =
    record.message;

  if (
    Array.isArray(message)
  ) {
    return message
      .map(String)
      .join(", ");
  }

  if (
    typeof message ===
      "string" &&
    message.trim()
  ) {
    return message.trim();
  }

  const error =
    record.error;

  if (
    typeof error ===
      "string" &&
    error.trim()
  ) {
    return error.trim();
  }

  return fallback;
}

function validateFile(
  file: File,
  kind: ChatUploadKind,
): void {
  if (!file) {
    throw new Error(
      kind === "image"
        ? "Please select an image."
        : "Please select a file.",
    );
  }

  if (
    !Number.isFinite(file.size) ||
    file.size <= 0
  ) {
    throw new Error(
      "Selected file is empty or invalid.",
    );
  }

  const mimeType =
    file.type
      ?.trim()
      .toLowerCase();

  if (kind === "image") {
    if (
      file.size >
      MAX_IMAGE_SIZE
    ) {
      throw new Error(
        "Image cannot exceed 10 MB.",
      );
    }

    if (
      !mimeType ||
      !ALLOWED_IMAGE_TYPES.has(
        mimeType,
      )
    ) {
      throw new Error(
        "Unsupported image type. Use JPG, PNG, WEBP or GIF.",
      );
    }

    return;
  }

  if (
    file.size >
    MAX_FILE_SIZE
  ) {
    throw new Error(
      "File cannot exceed 20 MB.",
    );
  }

  if (
    !mimeType ||
    !ALLOWED_FILE_TYPES.has(
      mimeType,
    )
  ) {
    throw new Error(
      "Unsupported file type. Use PDF, ZIP, DOC, DOCX, XLS, XLSX, TXT or supported audio files.",
    );
  }
}

async function parseResponse(
  response: Response,
): Promise<unknown> {
  return response
    .json()
    .catch(() => null);
}

function buildFormData(
  options: UploadOptions,
): FormData {
  const callSessionId =
    normalizeCallSessionId(
      options.callSessionId,
    );

  const caption =
    normalizeCaption(
      options.caption,
    );

  const formData =
    new FormData();

  formData.append(
    "callSessionId",
    callSessionId,
  );

  formData.append(
    "file",
    options.file,
  );

  if (caption) {
    formData.append(
      "caption",
      caption,
    );
  }

  return formData;
}

function normalizeUploadResponse(
  data: unknown,
  kind: ChatUploadKind,
): ChatUploadResponse {
  if (
    !data ||
    typeof data !== "object"
  ) {
    throw new Error(
      kind === "image"
        ? "Invalid image upload response."
        : "Invalid file upload response.",
    );
  }

  const response =
    data as ChatUploadResponse;

  if (
    !response.success ||
    !response.data?.url ||
    !response.data?.fileName ||
    !response.data?.mimeType ||
    !Number.isFinite(
      response.data?.size,
    )
  ) {
    throw new Error(
      kind === "image"
        ? "Backend returned an invalid image upload response."
        : "Backend returned an invalid file upload response.",
    );
  }

  return {
    ...response,

    data: {
      ...response.data,

      type:
        response.data.type ??
        (kind === "image"
          ? "IMAGE"
          : "FILE"),
    },
  };
}

async function uploadWithFetch(
  kind: ChatUploadKind,
  options: UploadOptions,
): Promise<ChatUploadResponse> {
  const token =
    getAccessToken();

  validateFile(
    options.file,
    kind,
  );

  const formData =
    buildFormData(options);

  options.onProgress?.(10);

  const response =
    await fetch(
      `${getApiBaseUrl()}/chat/upload/${kind}`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${token}`,
        },

        body:
          formData,

        signal:
          options.signal,
      },
    );

  options.onProgress?.(90);

  const data =
    await parseResponse(
      response,
    );

  if (!response.ok) {
    if (
      response.status === 401
    ) {
      throw new Error(
        "LOGIN_REQUIRED",
      );
    }

    if (
      response.status === 413
    ) {
      throw new Error(
        kind === "image"
          ? "Image cannot exceed 10 MB."
          : "File cannot exceed 20 MB.",
      );
    }

    throw new Error(
      getErrorMessage(
        data,
        kind === "image"
          ? "Unable to upload image."
          : "Unable to upload file.",
      ),
    );
  }

  options.onProgress?.(100);

  return normalizeUploadResponse(
    data,
    kind,
  );
}

function uploadWithProgress(
  kind: ChatUploadKind,
  options: UploadOptions,
): Promise<ChatUploadResponse> {
  return new Promise(
    (resolve, reject) => {
      let token: string;
      let formData: FormData;

      try {
        token =
          getAccessToken();

        validateFile(
          options.file,
          kind,
        );

        formData =
          buildFormData(
            options,
          );
      } catch (error) {
        reject(error);
        return;
      }

      const request =
        new XMLHttpRequest();

      let abortHandler:
        | (() => void)
        | null = null;

      request.open(
        "POST",
        `${getApiBaseUrl()}/chat/upload/${kind}`,
      );

      request.setRequestHeader(
        "Authorization",
        `Bearer ${token}`,
      );

      request.timeout =
        120_000;

      request.upload.onprogress = (
        event,
      ) => {
        if (
          !event.lengthComputable
        ) {
          return;
        }

        const progress =
          Math.min(
            100,
            Math.max(
              0,
              Math.round(
                (event.loaded /
                  event.total) *
                  100,
              ),
            ),
          );

        options.onProgress?.(
          progress,
        );
      };

      request.onload = () => {
        cleanupAbortListener();

        let data:
          | unknown
          | null = null;

        try {
          data =
            request.responseText
              ? JSON.parse(
                  request.responseText,
                )
              : null;
        } catch {
          data = null;
        }

        if (
          request.status >= 200 &&
          request.status < 300
        ) {
          try {
            const response =
              normalizeUploadResponse(
                data,
                kind,
              );

            options.onProgress?.(
              100,
            );

            resolve(response);
          } catch (error) {
            reject(error);
          }

          return;
        }

        if (
          request.status === 401
        ) {
          reject(
            new Error(
              "LOGIN_REQUIRED",
            ),
          );

          return;
        }

        if (
          request.status === 413
        ) {
          reject(
            new Error(
              kind === "image"
                ? "Image cannot exceed 10 MB."
                : "File cannot exceed 20 MB.",
            ),
          );

          return;
        }

        reject(
          new Error(
            getErrorMessage(
              data,
              kind === "image"
                ? "Unable to upload image."
                : "Unable to upload file.",
            ),
          ),
        );
      };

      request.onerror = () => {
        cleanupAbortListener();

        reject(
          new Error(
            "Network error while uploading.",
          ),
        );
      };

      request.ontimeout = () => {
        cleanupAbortListener();

        reject(
          new Error(
            "Upload timed out. Please try again.",
          ),
        );
      };

      request.onabort = () => {
        cleanupAbortListener();

        reject(
          new Error(
            "Upload was cancelled.",
          ),
        );
      };

      function cleanupAbortListener() {
        if (
          options.signal &&
          abortHandler
        ) {
          options.signal
            .removeEventListener(
              "abort",
              abortHandler,
            );
        }

        abortHandler = null;
      }

      if (options.signal) {
        abortHandler = () => {
          request.abort();
        };

        if (
          options.signal.aborted
        ) {
          request.abort();
          return;
        }

        options.signal
          .addEventListener(
            "abort",
            abortHandler,
            {
              once: true,
            },
          );
      }

      request.send(
        formData,
      );
    },
  );
}

export async function uploadChatImage(
  options: UploadOptions,
): Promise<ChatUploadResponse> {
  return options.onProgress
    ? uploadWithProgress(
        "image",
        options,
      )
    : uploadWithFetch(
        "image",
        options,
      );
}

export async function uploadChatFile(
  options: UploadOptions,
): Promise<ChatUploadResponse> {
  return options.onProgress
    ? uploadWithProgress(
        "file",
        options,
      )
    : uploadWithFetch(
        "file",
        options,
      );
}