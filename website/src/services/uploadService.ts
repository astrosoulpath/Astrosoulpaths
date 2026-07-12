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

function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not configured.",
    );
  }

  return API_BASE_URL.replace(/\/+$/, "");
}

function getAccessToken(): string {
  if (typeof window === "undefined") {
    throw new Error(
      "Upload is only available in the browser.",
    );
  }

  const token = localStorage.getItem(
    "asp_access_token",
  );

  if (!token) {
    throw new Error("LOGIN_REQUIRED");
  }

  return token;
}

function normalizeCallSessionId(
  callSessionId: string,
): string {
  const normalized =
    callSessionId.trim();

  if (!normalized) {
    throw new Error(
      "Call session ID is required.",
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
    value as Record<string, unknown>;

  const message = record.message;

  if (Array.isArray(message)) {
    return message
      .map(String)
      .join(", ");
  }

  if (typeof message === "string") {
    return message;
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

  const maxSize =
    kind === "image"
      ? 10 * 1024 * 1024
      : 20 * 1024 * 1024;

  if (file.size <= 0) {
    throw new Error(
      "Selected file is empty.",
    );
  }

  if (file.size > maxSize) {
    throw new Error(
      kind === "image"
        ? "Image cannot exceed 10 MB."
        : "File cannot exceed 20 MB.",
    );
  }

  if (
    kind === "image" &&
    !file.type.startsWith("image/")
  ) {
    throw new Error(
      "Please select a valid image.",
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

async function uploadWithFetch(
  kind: ChatUploadKind,
  options: UploadOptions,
): Promise<ChatUploadResponse> {
  const token = getAccessToken();

  const callSessionId =
    normalizeCallSessionId(
      options.callSessionId,
    );

  validateFile(options.file, kind);

  const formData = new FormData();

  formData.append(
    "callSessionId",
    callSessionId,
  );

  formData.append(
    "file",
    options.file,
  );

  if (options.caption?.trim()) {
    formData.append(
      "caption",
      options.caption.trim(),
    );
  }

  options.onProgress?.(10);

  const response = await fetch(
    `${getApiBaseUrl()}/chat/upload/${kind}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
      signal: options.signal,
    },
  );

  options.onProgress?.(90);

  const data =
    await parseResponse(response);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "LOGIN_REQUIRED",
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

  return data as ChatUploadResponse;
}

/**
 * Fetch does not expose reliable upload-progress events.
 * This XMLHttpRequest version is used when the UI needs
 * actual byte-level upload progress.
 */
function uploadWithProgress(
  kind: ChatUploadKind,
  options: UploadOptions,
): Promise<ChatUploadResponse> {
  return new Promise(
    (resolve, reject) => {
      let token: string;
      let callSessionId: string;

      try {
        token = getAccessToken();

        callSessionId =
          normalizeCallSessionId(
            options.callSessionId,
          );

        validateFile(
          options.file,
          kind,
        );
      } catch (error) {
        reject(error);
        return;
      }

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

      if (
        options.caption?.trim()
      ) {
        formData.append(
          "caption",
          options.caption.trim(),
        );
      }

      const request =
        new XMLHttpRequest();

      request.open(
        "POST",
        `${getApiBaseUrl()}/chat/upload/${kind}`,
      );

      request.setRequestHeader(
        "Authorization",
        `Bearer ${token}`,
      );

      request.upload.onprogress = (
        event,
      ) => {
        if (!event.lengthComputable) {
          return;
        }

        const progress = Math.min(
          100,
          Math.round(
            (event.loaded /
              event.total) *
              100,
          ),
        );

        options.onProgress?.(
          progress,
        );
      };

      request.onload = () => {
        let data: unknown = null;

        try {
          data = request.responseText
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
          options.onProgress?.(
            100,
          );

          resolve(
            data as ChatUploadResponse,
          );

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
        reject(
          new Error(
            "Network error while uploading.",
          ),
        );
      };

      request.onabort = () => {
        reject(
          new Error(
            "Upload was cancelled.",
          ),
        );
      };

      if (options.signal) {
        if (
          options.signal.aborted
        ) {
          request.abort();
          return;
        }

        options.signal.addEventListener(
          "abort",
          () => {
            request.abort();
          },
          {
            once: true,
          },
        );
      }

      request.send(formData);
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