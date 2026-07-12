"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ChatAttachmentButton } from "@/components/chat/ChatAttachmentButton";
import AudioCall from "@/components/call/AudioCall";
import { useCallToken } from "@/hooks/useCallToken";

import {
  endConsultation,
  getCurrentConsultation,
  type ConsultationSession,
} from "@/services/consultationService";

import {
  getChatHistory,
  joinChat,
  markAllChatMessagesAsRead,
  sendChatMessage,
  type ChatMessage,
  type JoinChatResponse,
} from "@/services/chatService";

import {
  connectChatSocket,
  disconnectChatSocket,
  joinChatRoom,
  leaveChatRoom,
  markRealtimeRead,
  onChatConnected,
  onChatError,
  onChatJoined,
  onNewMessage,
  onPresence,
  onReadReceipt,
  onTyping,
  removeAllChatListeners,
  sendRealtimeMessage,
  sendTypingStatus,
} from "@/lib/chatSocket";

type ChatPresencePayload = {
  callSessionId: string;
  status: "online" | "offline";
  socketId?: string;
};

type ChatTypingPayload = {
  callSessionId: string;
  isTyping: boolean;
  socketId?: string;
};

type ChatReadPayload = {
  callSessionId: string;
  messageIds?: string[];
  readAt?: string;
  updatedCount?: number;
};

type ChatErrorPayload = {
  success?: boolean;
  message?: string;
};

type UploadedChatAttachment = {
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  type: "IMAGE" | "FILE";
};

function formatClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    seconds,
  ).padStart(2, "0")}`;
}

function getElapsedSeconds(
  startedAt: string,
  endedAt?: string | null,
): number {
  const startedTime = new Date(startedAt).getTime();

  if (!Number.isFinite(startedTime)) {
    return 0;
  }

  const endedTime = endedAt
    ? new Date(endedAt).getTime()
    : Date.now();

  if (!Number.isFinite(endedTime)) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor((endedTime - startedTime) / 1000),
  );
}

function getRemainingSeconds(expiresAt: string): number {
  const expiryTime = new Date(expiresAt).getTime();

  if (!Number.isFinite(expiryTime)) {
    return 0;
  }

  return Math.max(
    0,
    Math.ceil((expiryTime - Date.now()) / 1000),
  );
}

function formatMessageTime(createdAt: string): string {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(size?: number | null): string {
  if (!size || size <= 0) {
    return "";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function appendUniqueMessage(
  currentMessages: ChatMessage[],
  newMessage: ChatMessage,
): ChatMessage[] {
  if (
    currentMessages.some(
      (existingMessage) =>
        existingMessage.id === newMessage.id,
    )
  ) {
    return currentMessages;
  }

  return [...currentMessages, newMessage].sort(
    (first, second) =>
      new Date(first.createdAt).getTime() -
      new Date(second.createdAt).getTime(),
  );
}

export default function ChatConsultationPage() {
  const params = useParams<{
    bookingId: string;
  }>();

  const router = useRouter();

  const bookingId = String(
    params.bookingId ?? "",
  ).trim();

  const [consultation, setConsultation] =
    useState<ConsultationSession | null>(null);

  const [chatRoom, setChatRoom] =
    useState<JoinChatResponse["data"] | null>(
      null,
    );

  const [messages, setMessages] =
    useState<ChatMessage[]>([]);

  const [message, setMessage] = useState("");

  const [elapsedSeconds, setElapsedSeconds] =
    useState(0);

  const [remainingSeconds, setRemainingSeconds] =
    useState(0);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);

  const [socketConnected, setSocketConnected] =
    useState(false);

  const [
    otherParticipantOnline,
    setOtherParticipantOnline,
  ] = useState(false);

  const [
    otherParticipantTyping,
    setOtherParticipantTyping,
  ] = useState(false);

  const [error, setError] = useState("");
  const {
  tokenData,
  loadToken,
  loading: tokenLoading,
} = useCallToken();

const [showAudioCall, setShowAudioCall] =
  useState(false);

  const endProcessedRef = useRef(false);

  const typingTimeoutRef =
    useRef<number | null>(null);

  const messagesContainerRef =
    useRef<HTMLDivElement | null>(null);

  const currentUserId =
    chatRoom?.currentUser.id ?? "";

  const isActive =
    consultation?.status === "ACTIVE" &&
    !consultation.endedAt &&
    remainingSeconds > 0;

  const otherParticipantName = useMemo(() => {
    if (!chatRoom) {
      return (
        consultation?.astrologerName ||
        "Astro Soul Path Astrologer"
      );
    }

    if (
      chatRoom.currentUser.id ===
      chatRoom.customer.id
    ) {
      return (
        chatRoom.astrologer.name ||
        consultation?.astrologerName ||
        "Astrologer"
      );
    }

    return chatRoom.customer.name || "Customer";
  }, [chatRoom, consultation]);

  const markIncomingMessagesAsRead = useCallback(
    async (incomingMessages: ChatMessage[]) => {
      if (!bookingId || !currentUserId) {
        return;
      }

      const unreadMessageIds = incomingMessages
        .filter(
          (chatMessage) =>
            chatMessage.senderId !==
              currentUserId &&
            !chatMessage.isRead,
        )
        .map((chatMessage) => chatMessage.id);

      if (unreadMessageIds.length === 0) {
        return;
      }

      markRealtimeRead(
        bookingId,
        unreadMessageIds,
      );

      try {
        await markAllChatMessagesAsRead(
          bookingId,
        );

        const readAt =
          new Date().toISOString();

        setMessages((current) =>
          current.map((chatMessage) =>
            unreadMessageIds.includes(
              chatMessage.id,
            )
              ? {
                  ...chatMessage,
                  isRead: true,
                  readAt,
                }
              : chatMessage,
          ),
        );
      } catch {
        // Socket read receipt can still complete.
      }
    },
    [bookingId, currentUserId],
  );

  const loadChatData = useCallback(async () => {
    if (!bookingId) {
      setError(
        "Consultation ID is missing.",
      );
      setLoading(false);
      return;
    }

    const token = localStorage.getItem(
      "asp_access_token",
    );

    if (!token) {
      router.replace(
        `/login?redirect=${encodeURIComponent(
          `/chat/${bookingId}`,
        )}`,
      );

      return;
    }

    try {
      setLoading(true);
      setError("");

      const consultationResponse =
        await getCurrentConsultation();

      const currentConsultation =
        consultationResponse.data?.call ?? null;

      if (!currentConsultation) {
        setError(
          "No active consultation was found.",
        );
        return;
      }

      if (
        currentConsultation.id !== bookingId
      ) {
        setError(
          "This is not your currently active consultation.",
        );
        return;
      }

      setConsultation(
        currentConsultation,
      );

      setElapsedSeconds(
        getElapsedSeconds(
          currentConsultation.startedAt,
          currentConsultation.endedAt,
        ),
      );

      setRemainingSeconds(
        getRemainingSeconds(
          currentConsultation.expiresAt,
        ),
      );

      const [
        joinResponse,
        historyResponse,
      ] = await Promise.all([
        joinChat(bookingId),
        getChatHistory(bookingId),
      ]);

      setChatRoom(joinResponse.data);

      setMessages(
        historyResponse.data.messages ?? [],
      );

      const unreadIds =
        historyResponse.data.messages
          .filter(
            (chatMessage) =>
              chatMessage.senderId !==
                joinResponse.data.currentUser
                  .id &&
              !chatMessage.isRead,
          )
          .map(
            (chatMessage) =>
              chatMessage.id,
          );

      if (unreadIds.length > 0) {
        try {
          await markAllChatMessagesAsRead(
            bookingId,
          );

          const readAt =
            new Date().toISOString();

          setMessages((current) =>
            current.map((chatMessage) =>
              unreadIds.includes(
                chatMessage.id,
              )
                ? {
                    ...chatMessage,
                    isRead: true,
                    readAt,
                  }
                : chatMessage,
            ),
          );
        } catch {
          // Chat can open even if read update fails.
        }
      }
    } catch (err: unknown) {
      const messageText =
        err instanceof Error
          ? err.message
          : "Unable to load chat consultation.";

      if (
        messageText === "LOGIN_REQUIRED"
      ) {
        localStorage.removeItem(
          "asp_access_token",
        );

        localStorage.removeItem(
          "asp_refresh_token",
        );

        router.replace(
          `/login?redirect=${encodeURIComponent(
            `/chat/${bookingId}`,
          )}`,
        );

        return;
      }

      setError(messageText);
    } finally {
      setLoading(false);
    }
  }, [bookingId, router]);

  useEffect(() => {
    void loadChatData();
  }, [loadChatData]);

  useEffect(() => {
    if (!bookingId || !chatRoom) {
      return;
    }

    const socket = connectChatSocket();

    const handleConnect = () => {
      setSocketConnected(true);
      setError("");
      joinChatRoom(bookingId);
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
      setOtherParticipantOnline(false);
      setOtherParticipantTyping(false);
    };

    const handleConnectedEvent = () => {
      setSocketConnected(true);
      joinChatRoom(bookingId);
    };

    const handleJoinedEvent = () => {
      setSocketConnected(true);
    };

    const handleNewMessage = (
      payload: unknown,
    ) => {
      const incomingMessage =
        payload as ChatMessage;

      if (
        !incomingMessage?.id ||
        incomingMessage.callSessionId !==
          bookingId
      ) {
        return;
      }

      setMessages((current) =>
        appendUniqueMessage(
          current,
          incomingMessage,
        ),
      );

      if (
        incomingMessage.senderId !==
        chatRoom.currentUser.id
      ) {
        void markIncomingMessagesAsRead([
          incomingMessage,
        ]);
      }
    };

    const handleTypingEvent = (
      payload: unknown,
    ) => {
      const typingPayload =
        payload as ChatTypingPayload;

      if (
        typingPayload.callSessionId !==
        bookingId
      ) {
        return;
      }

      setOtherParticipantTyping(
        Boolean(
          typingPayload.isTyping,
        ),
      );
    };

    const handlePresenceEvent = (
      payload: unknown,
    ) => {
      const presencePayload =
        payload as ChatPresencePayload;

      if (
        presencePayload.callSessionId !==
        bookingId
      ) {
        return;
      }

      setOtherParticipantOnline(
        presencePayload.status ===
          "online",
      );
    };

    const handleReadEvent = (
      payload: unknown,
    ) => {
      const readPayload =
        payload as ChatReadPayload;

      if (
        readPayload.callSessionId !==
        bookingId
      ) {
        return;
      }

      const readAt =
        readPayload.readAt ||
        new Date().toISOString();

      setMessages((current) =>
        current.map((chatMessage) => {
          const explicitlyIncluded =
            readPayload.messageIds?.includes(
              chatMessage.id,
            );

          const markAllOutgoing =
            !readPayload.messageIds &&
            chatMessage.senderId ===
              chatRoom.currentUser.id;

          if (
            explicitlyIncluded ||
            markAllOutgoing
          ) {
            return {
              ...chatMessage,
              isRead: true,
              readAt,
            };
          }

          return chatMessage;
        }),
      );
    };

    const handleSocketError = (
      payload: unknown,
    ) => {
      const errorPayload =
        payload as ChatErrorPayload;

      setError(
        errorPayload.message ||
          "Realtime chat connection failed.",
      );
    };

    socket.on("connect", handleConnect);
    socket.on(
      "disconnect",
      handleDisconnect,
    );

    onChatConnected(
      handleConnectedEvent,
    );

    onChatJoined(
      handleJoinedEvent,
    );

    onNewMessage(handleNewMessage);
    onTyping(handleTypingEvent);
    onPresence(handlePresenceEvent);
    onReadReceipt(handleReadEvent);
    onChatError(handleSocketError);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      if (
        typingTimeoutRef.current
      ) {
        window.clearTimeout(
          typingTimeoutRef.current,
        );
      }

      sendTypingStatus(
        bookingId,
        false,
      );

      leaveChatRoom(bookingId);

      socket.off(
        "connect",
        handleConnect,
      );

      socket.off(
        "disconnect",
        handleDisconnect,
      );

      removeAllChatListeners();
      disconnectChatSocket();
    };
  }, [
    bookingId,
    chatRoom,
    markIncomingMessagesAsRead,
  ]);

  useEffect(() => {
    if (
      !consultation ||
      consultation.status !== "ACTIVE" ||
      consultation.endedAt
    ) {
      return;
    }

    const timer =
      window.setInterval(() => {
        setElapsedSeconds(
          getElapsedSeconds(
            consultation.startedAt,
          ),
        );

        setRemainingSeconds(
          getRemainingSeconds(
            consultation.expiresAt,
          ),
        );
      }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [consultation]);

  useEffect(() => {
    if (
      !consultation ||
      consultation.status !== "ACTIVE" ||
      consultation.endedAt ||
      remainingSeconds > 0 ||
      endProcessedRef.current
    ) {
      return;
    }

    endProcessedRef.current = true;

    void endConsultation(
      consultation.id,
      "Purchased consultation time completed",
    )
      .then((response) => {
        setConsultation(
          response.data.call,
        );

        leaveChatRoom(
          consultation.id,
        );

        window.setTimeout(() => {
          router.replace(
            "/consultations",
          );
        }, 1500);
      })
      .catch((err: unknown) => {
        endProcessedRef.current = false;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to end expired consultation.",
        );
      });
  }, [
    consultation,
    remainingSeconds,
    router,
  ]);

  useEffect(() => {
    const container =
      messagesContainerRef.current;

    if (container) {
      container.scrollTop =
        container.scrollHeight;
    }
  }, [
    messages,
    otherParticipantTyping,
  ]);

  function handleMessageInputChange(
    value: string,
  ) {
    setMessage(value);

    if (
      !bookingId ||
      !socketConnected
    ) {
      return;
    }

    sendTypingStatus(
      bookingId,
      Boolean(value.trim()),
    );

    if (
      typingTimeoutRef.current
    ) {
      window.clearTimeout(
        typingTimeoutRef.current,
      );
    }

    typingTimeoutRef.current =
      window.setTimeout(() => {
        sendTypingStatus(
          bookingId,
          false,
        );
      }, 1200);
  }

  async function handleSendMessage(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalizedMessage =
      message.trim();

    if (
      !normalizedMessage ||
      !consultation ||
      !isActive ||
      sending
    ) {
      return;
    }

    try {
      setSending(true);
      setError("");
      setMessage("");

      sendTypingStatus(
        bookingId,
        false,
      );

      if (socketConnected) {
        sendRealtimeMessage({
          callSessionId: bookingId,
          messageType: "TEXT",
          content: normalizedMessage,
        });

        return;
      }

      const response =
        await sendChatMessage({
          callSessionId: bookingId,
          messageType: "TEXT",
          content: normalizedMessage,
        });

      setMessages((current) =>
        appendUniqueMessage(
          current,
          response.data.message,
        ),
      );
    } catch (err: unknown) {
      setMessage(normalizedMessage);

      const messageText =
        err instanceof Error
          ? err.message
          : "Unable to send message.";

      if (
        messageText === "LOGIN_REQUIRED"
      ) {
        localStorage.removeItem(
          "asp_access_token",
        );

        router.replace(
          `/login?redirect=${encodeURIComponent(
            `/chat/${bookingId}`,
          )}`,
        );

        return;
      }

      setError(messageText);
    } finally {
      setSending(false);
    }
  }

  async function handleAttachmentUploaded(
    attachment: UploadedChatAttachment,
  ) {
    if (
      !isActive ||
      !bookingId ||
      sending
    ) {
      return;
    }

    try {
      setSending(true);
      setError("");

      const payload = {
        callSessionId: bookingId,
        messageType: attachment.type,
        attachmentUrl: attachment.url,
        attachmentName:
          attachment.fileName,
        attachmentMimeType:
          attachment.mimeType,
        attachmentSize:
          attachment.size,
      } as const;

      if (socketConnected) {
        sendRealtimeMessage(payload);
        return;
      }

      const response =
        await sendChatMessage(payload);

      setMessages((current) =>
        appendUniqueMessage(
          current,
          response.data.message,
        ),
      );
    } catch (err: unknown) {
      const messageText =
        err instanceof Error
          ? err.message
          : "Unable to send attachment.";

      if (
        messageText === "LOGIN_REQUIRED"
      ) {
        localStorage.removeItem(
          "asp_access_token",
        );

        router.replace(
          `/login?redirect=${encodeURIComponent(
            `/chat/${bookingId}`,
          )}`,
        );

        return;
      }

      setError(messageText);
    } finally {
      setSending(false);
    }
  }

  async function handleStartAudioCall() {
  try {
    await loadToken(bookingId);
    setShowAudioCall(true);
  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : "Unable to start audio call.",
    );
  }
}

  async function handleEndConsultation() {
    if (
      !consultation ||
      !isActive ||
      ending ||
      endProcessedRef.current
    ) {
      return;
    }

    const shouldEnd = window.confirm(
      [
        "End this chat consultation?",
        "",
        `Elapsed time: ${formatClock(
          elapsedSeconds,
        )}`,
        `Purchased time: ${consultation.totalMinutes} minute(s)`,
        `Amount already charged: ₹${consultation.amountCharged.toFixed(
          2,
        )}`,
      ].join("\n"),
    );

    if (!shouldEnd) {
      return;
    }

    try {
      setEnding(true);
      endProcessedRef.current = true;
      setError("");

      sendTypingStatus(
        consultation.id,
        false,
      );

      leaveChatRoom(
        consultation.id,
      );

      const response =
        await endConsultation(
          consultation.id,
          "Ended by user",
        );

      setConsultation(
        response.data.call,
      );

      localStorage.removeItem(
        "asp_active_call",
      );

      localStorage.removeItem(
        "asp_pending_consultation",
      );

      router.replace(
        "/consultations",
      );
    } catch (err: unknown) {
      endProcessedRef.current = false;

      const messageText =
        err instanceof Error
          ? err.message
          : "Unable to end consultation.";

      if (
        messageText === "LOGIN_REQUIRED"
      ) {
        localStorage.removeItem(
          "asp_access_token",
        );

        router.replace(
          `/login?redirect=${encodeURIComponent(
            `/chat/${bookingId}`,
          )}`,
        );

        return;
      }

      setError(messageText);
    } finally {
      setEnding(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#FAF7F0] px-6 py-20">
        <div className="mx-auto max-w-5xl rounded-3xl bg-white p-10 text-center shadow-lg">
          Loading realtime consultation...
        </div>
      </main>
    );
  }

  if (!consultation || !chatRoom) {
    return (
      <main className="min-h-screen bg-[#FAF7F0] px-6 py-20">
        <div className="mx-auto max-w-4xl rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700 shadow-lg">
          <h1 className="text-2xl font-bold">
            Unable to open consultation
          </h1>

          <p className="mt-3">
            {error ||
              "Consultation was not found."}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                void loadChatData()
              }
              className="rounded-xl border border-red-300 px-5 py-3 font-semibold"
            >
              Try Again
            </button>

            <Link
              href="/consultations"
              className="rounded-xl border border-red-300 px-5 py-3 font-semibold"
            >
              My Consultations
            </Link>

            <Link
              href="/astrologers"
              className="rounded-xl bg-[#D4AF37] px-5 py-3 font-semibold text-[#0B1026]"
            >
              Browse Astrologers
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF7F0] px-6 py-12">
      <div className="mx-auto max-w-5xl">
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-3xl bg-white shadow-xl">
          <header className="flex flex-col gap-5 bg-[#0B1026] p-6 text-white lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#D4AF37]">
                Live Chat Consultation
              </p>

              <h1 className="mt-1 text-2xl font-bold">
                {otherParticipantName}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                <span
                  className={`inline-flex items-center gap-2 ${
                    otherParticipantOnline
                      ? "text-green-300"
                      : "text-gray-400"
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      otherParticipantOnline
                        ? "bg-green-400"
                        : "bg-gray-500"
                    }`}
                  />

                  {otherParticipantOnline
                    ? "Online"
                    : "Offline"}
                </span>

                <span
                  className={`inline-flex items-center gap-2 ${
                    socketConnected
                      ? "text-green-300"
                      : "text-orange-300"
                  }`}
                >
                  {socketConnected
                    ? "Realtime connected"
                    : "Reconnecting..."}
                </span>
              </div>

              <p className="mt-2 text-sm text-gray-300">
                ₹
                {consultation.ratePerMinute.toFixed(
                  2,
                )}
                /minute
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
              <div className="rounded-xl bg-white/10 px-4 py-2">
                <p className="text-xs text-gray-300">
                  Elapsed
                </p>

                <p className="font-bold">
                  {formatClock(
                    elapsedSeconds,
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-white/10 px-4 py-2">
                <p className="text-xs text-gray-300">
                  Remaining
                </p>

                <p
                  className={`font-bold ${
                    remainingSeconds <= 60
                      ? "text-red-300"
                      : ""
                  }`}
                >
                  {formatClock(
                    remainingSeconds,
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-white/10 px-4 py-2">
                <p className="text-xs text-gray-300">
                  Purchased
                </p>

                <p className="font-bold">
                  {consultation.totalMinutes} min
                </p>
              </div>

              <div className="rounded-xl bg-white/10 px-4 py-2">
                <p className="text-xs text-gray-300">
                  Charged
                </p>

                <p className="font-bold text-[#D4AF37]">
                  ₹
                  {consultation.amountCharged.toFixed(
                    2,
                  )}
                </p>
              </div>

              <button
  type="button"
  onClick={() =>
    void handleStartAudioCall()
  }
  disabled={
    tokenLoading || !isActive
  }
  className="rounded-xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
>
  {tokenLoading
    ? "Loading..."
    : "Start Audio"}
</button>

<button
  type="button"
  onClick={() =>
    void handleEndConsultation()
  }
  disabled={
    ending || !isActive
  }
  className="rounded-xl bg-red-600 px-5 py-3 font-semibold transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
>
  {ending
    ? "Ending..."
    : "End Chat"}
</button>
          {!isActive && (
            <div className="border-b bg-green-50 p-4 text-center font-semibold text-green-700">
              This consultation has ended.
            </div>
          )}

          {remainingSeconds > 0 &&
            remainingSeconds <= 60 &&
            isActive && (
              <div className="border-b bg-red-50 p-4 text-center font-semibold text-red-700">
                Less than one minute remains in
                this consultation.
              </div>
            )}

          <div
            ref={messagesContainerRef}
            className="h-[500px] overflow-y-auto bg-[#FAF7F0] p-6"
          >
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <h2 className="text-xl font-bold text-[#0B1026]">
                    Consultation started
                  </h2>

                  <p className="mt-2 text-gray-600">
                    Send your first message.
                  </p>

                  <p className="mt-3 text-sm text-gray-500">
                    Messages and attachments are
                    stored in your consultation
                    history.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map(
                  (chatMessage) => {
                    const isOwnMessage =
                      chatMessage.senderId ===
                      currentUserId;

                    const attachment =
                      chatMessage.attachment;

                    const isImage =
                      chatMessage.messageType ===
                        "IMAGE" &&
                      attachment;

                    return (
                      <div
                        key={chatMessage.id}
                        className={`flex ${
                          isOwnMessage
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[82%] rounded-2xl px-5 py-3 ${
                            isOwnMessage
                              ? "bg-[#D4AF37] text-[#0B1026]"
                              : "bg-white text-[#0B1026] shadow"
                          }`}
                        >
                          {!isOwnMessage && (
                            <p className="mb-1 text-xs font-bold opacity-70">
                              {
                                chatMessage
                                  .sender.name
                              }
                            </p>
                          )}

                          {chatMessage.content && (
                            <p className="whitespace-pre-wrap break-words">
                              {
                                chatMessage.content
                              }
                            </p>
                          )}

                          {isImage && (
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 block"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={attachment.url}
                                alt={
                                  attachment.name ||
                                  "Chat image"
                                }
                                className="max-h-72 w-auto max-w-full rounded-xl object-contain"
                              />
                            </a>
                          )}

                          {attachment &&
                            !isImage && (
                              <a
                                href={
                                  attachment.url
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 flex items-center gap-3 rounded-xl border border-current/20 p-3 no-underline"
                              >
                                <span className="text-2xl">
                                  📎
                                </span>

                                <span className="min-w-0">
                                  <span className="block truncate font-semibold underline">
                                    {attachment.name ||
                                      "Open attachment"}
                                  </span>

                                  <span className="block text-xs opacity-60">
                                    {attachment.mimeType ||
                                      "File"}

                                    {attachment.size
                                      ? ` · ${formatFileSize(
                                          attachment.size,
                                        )}`
                                      : ""}
                                  </span>
                                </span>
                              </a>
                            )}

                          <div className="mt-1 flex items-center justify-end gap-2 text-xs opacity-60">
                            <span>
                              {formatMessageTime(
                                chatMessage.createdAt,
                              )}
                            </span>

                            {isOwnMessage && (
                              <span>
                                {chatMessage.isRead
                                  ? "✓✓ Read"
                                  : "✓ Sent"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  },
                )}

                {otherParticipantTyping && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl bg-white px-5 py-3 text-sm text-gray-500 shadow">
                      {otherParticipantName} is
                      typing...
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t p-5">
            {isActive && (
              <div className="mb-4">
                <ChatAttachmentButton
                  callSessionId={bookingId}
                  onUploaded={(attachment) =>
                    void handleAttachmentUploaded(
                      attachment,
                    )
                  }
                />
              </div>
            )}

            <form
              onSubmit={handleSendMessage}
              className="flex gap-3"
            >
              <input
                type="text"
                value={message}
                disabled={
                  !isActive || sending
                }
                onChange={(event) =>
                  handleMessageInputChange(
                    event.target.value,
                  )
                }
                placeholder={
                  isActive
                    ? "Type your message..."
                    : "Consultation has ended"
                }
                className="min-w-0 flex-1 rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#D4AF37] disabled:bg-gray-100"
              />

              <button
                type="submit"
                disabled={
                  !message.trim() ||
                  !isActive ||
                  sending
                }
                className="rounded-xl bg-[#D4AF37] px-7 py-3 font-semibold text-[#0B1026] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending
                  ? "Sending..."
                  : "Send"}
              </button>
            </form>

            {showAudioCall &&
  tokenData && (
    <div className="mt-6">
      <AudioCall
        appId={tokenData.appId}
        channelName={tokenData.channelName}
        token={tokenData.token}
        uid={tokenData.uid}
        onEnd={() =>
          setShowAudioCall(false)
        }
      />
    </div>
   )}
          </div>
        </section>

        <p className="mt-4 text-center text-xs text-gray-500">
          Live messages, images, files, history,
          typing status and read receipts are
          connected to the Astro Soul Path
          backend.
        </p>
      </div>
    </main>
  );
}