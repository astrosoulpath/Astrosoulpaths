const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL;

export type ChatMessageType =
  | "TEXT"
  | "IMAGE"
  | "FILE"
  | "SYSTEM";

export type ChatParticipant = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  isAstrologer?: boolean;
};

export type ChatAttachment = {
  url: string;
  name: string | null;
  mimeType: string | null;
  size: number | null;
};

export type ChatMessage = {
  id: string;
  callSessionId: string;
  senderId: string;

  sender: {
    id: string;
    name: string;
    avatarUrl: string | null;
    isAstrologer: boolean;
  };

  messageType: ChatMessageType;
  content: string | null;
  attachment: ChatAttachment | null;

  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JoinChatResponse = {
  success: boolean;
  message?: string;
  data: {
    roomId: string;
    channelName: string;
    status: string;
    startedAt: string;
    expiresAt: string;
    endedAt: string | null;
    unreadCount: number;

    currentUser: {
      id: string;
      name: string;
      avatarUrl: string | null;
    };

    customer: ChatParticipant;
    astrologer: ChatParticipant;
  };
};

export type ChatHistoryResponse = {
  success: boolean;
  data: {
    callSession: {
      id: string;
      channelName: string;
      status: string;
      startedAt: string;
      expiresAt: string;
      endedAt: string | null;
      customer: ChatParticipant;
      astrologer: ChatParticipant;
    };

    messages: ChatMessage[];
    total: number;
    unreadCount: number;
  };
};

export type SendMessagePayload = {
  callSessionId: string;
  messageType?: ChatMessageType;
  content?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
};

export type SendMessageResponse = {
  success: boolean;
  message?: string;
  data: {
    message: ChatMessage;
  };
};

export type MarkMessagesReadResponse = {
  success: boolean;
  message?: string;
  data: {
    callSessionId: string;
    messageIds: string[];
    updatedCount: number;
    readAt: string;
  };
};

export type MarkAllMessagesReadResponse = {
  success: boolean;
  message?: string;
  data: {
    callSessionId: string;
    updatedCount: number;
    readAt: string;
  };
};

export type UnreadCountResponse = {
  success: boolean;
  data: {
    callSessionId: string;
    unreadCount: number;
  };
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
      "Chat actions are only available in the browser.",
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

async function readJson(
  response: Response,
): Promise<unknown> {
  return response.json().catch(() => null);
}

function getErrorMessage(
  data: unknown,
  fallback: string,
): string {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return fallback;
  }

  const record =
    data as Record<string, unknown>;

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

async function authenticatedRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();

  const response = await fetch(
    `${getApiBaseUrl()}${path}`,
    {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
      cache: "no-store",
    },
  );

  const data = await readJson(response);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("LOGIN_REQUIRED");
    }

    throw new Error(
      getErrorMessage(
        data,
        "Chat request failed.",
      ),
    );
  }

  return data as T;
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

export async function joinChat(
  callSessionId: string,
): Promise<JoinChatResponse> {
  const normalizedCallSessionId =
    normalizeCallSessionId(
      callSessionId,
    );

  return authenticatedRequest<JoinChatResponse>(
    "/chat/join",
    {
      method: "POST",
      body: JSON.stringify({
        callSessionId:
          normalizedCallSessionId,
      }),
    },
  );
}

export async function getChatHistory(
  callSessionId: string,
): Promise<ChatHistoryResponse> {
  const normalizedCallSessionId =
    normalizeCallSessionId(
      callSessionId,
    );

  return authenticatedRequest<ChatHistoryResponse>(
    `/chat/${encodeURIComponent(
      normalizedCallSessionId,
    )}/history`,
  );
}

export async function sendChatMessage(
  payload: SendMessagePayload,
): Promise<SendMessageResponse> {
  const callSessionId =
    normalizeCallSessionId(
      payload.callSessionId,
    );

  const messageType =
    payload.messageType ?? "TEXT";

  if (
    (messageType === "TEXT" ||
      messageType === "SYSTEM") &&
    !payload.content?.trim()
  ) {
    throw new Error(
      "Message content is required.",
    );
  }

  if (
    (messageType === "IMAGE" ||
      messageType === "FILE") &&
    !payload.attachmentUrl?.trim()
  ) {
    throw new Error(
      "Attachment URL is required.",
    );
  }

  return authenticatedRequest<SendMessageResponse>(
    "/chat/message",
    {
      method: "POST",
      body: JSON.stringify({
        callSessionId,
        messageType,
        content:
          payload.content?.trim(),
        attachmentUrl:
          payload.attachmentUrl?.trim(),
        attachmentName:
          payload.attachmentName?.trim(),
        attachmentMimeType:
          payload.attachmentMimeType?.trim(),
        attachmentSize:
          payload.attachmentSize,
      }),
    },
  );
}

export async function markChatMessagesAsRead(
  callSessionId: string,
  messageIds: string[],
): Promise<MarkMessagesReadResponse> {
  const normalizedCallSessionId =
    normalizeCallSessionId(
      callSessionId,
    );

  const normalizedMessageIds = [
    ...new Set(
      messageIds
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];

  if (
    normalizedMessageIds.length === 0
  ) {
    throw new Error(
      "At least one message ID is required.",
    );
  }

  return authenticatedRequest<MarkMessagesReadResponse>(
    "/chat/messages/read",
    {
      method: "PATCH",
      body: JSON.stringify({
        callSessionId:
          normalizedCallSessionId,
        messageIds:
          normalizedMessageIds,
      }),
    },
  );
}

export async function markAllChatMessagesAsRead(
  callSessionId: string,
): Promise<MarkAllMessagesReadResponse> {
  const normalizedCallSessionId =
    normalizeCallSessionId(
      callSessionId,
    );

  return authenticatedRequest<MarkAllMessagesReadResponse>(
    `/chat/${encodeURIComponent(
      normalizedCallSessionId,
    )}/read-all`,
    {
      method: "PATCH",
    },
  );
}

export async function getChatUnreadCount(
  callSessionId: string,
): Promise<UnreadCountResponse> {
  const normalizedCallSessionId =
    normalizeCallSessionId(
      callSessionId,
    );

  return authenticatedRequest<UnreadCountResponse>(
    `/chat/${encodeURIComponent(
      normalizedCallSessionId,
    )}/unread-count`,
  );
}