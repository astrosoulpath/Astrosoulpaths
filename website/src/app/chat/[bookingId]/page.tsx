"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useParams,
  useRouter,
} from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ChatAttachmentButton } from "@/components/chat/ChatAttachmentButton";
import IncomingCallModal from "@/components/call/IncomingCallModal";

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
  sendRealtimeMessage,
  sendTypingStatus,
  type ChatErrorPayload,
  type ChatPresencePayload,
  type ChatReadPayload,
  type ChatTypingPayload,
} from "@/lib/chatSocket";

import {
  getCallToken,
} from "@/services/callService";

import {
  acceptCall,
  connectCallSocket,
  initiateCall,
  onCallAccepted,
  onCallCancelled,
  onCallMissed,
  onCallRejected,
  onCallRinging,
  onCallUnavailable,
  rejectCall,
  type IncomingCallPayload,
} from "@/services/callSocket";

import {
  getChatHistory,
  joinChat,
  markAllChatMessagesAsRead,
  sendChatMessage,
  type ChatMessage,
  type JoinChatResponse,
} from "@/services/chatService";

import {
  endConsultation,
  getCurrentConsultation,
  type ConsultationSession,
} from "@/services/consultationService";

const AudioCall = dynamic(
  () =>
    import(
      "@/components/call/AudioCall"
    ),
  {
    ssr: false,

    loading: () => (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-lg">
        Preparing audio consultation...
      </div>
    ),
  },
);

type UploadedChatAttachment = {
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  type: "IMAGE" | "FILE";
};

type CallStatus =
  | "IDLE"
  | "RINGING"
  | "ACCEPTED"
  | "REJECTED"
  | "MISSED"
  | "CANCELLED"
  | "UNAVAILABLE";

type CallTokenData = {
  appId: string;
  token: string;
  channelName: string;
  uid: number;
};

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallback;
}

function normalizeMessageList(
  messages: ChatMessage[],
): ChatMessage[] {
  const uniqueMessages =
    new Map<string, ChatMessage>();

  for (const message of messages) {
    if (!message?.id) {
      continue;
    }

    uniqueMessages.set(
      message.id,
      message,
    );
  }

  return Array.from(
    uniqueMessages.values(),
  ).sort(
    (first, second) =>
      new Date(
        first.createdAt,
      ).getTime() -
      new Date(
        second.createdAt,
      ).getTime(),
  );
}

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
    bookingId?: string | string[];
  }>();

  const router = useRouter();

  const bookingId = useMemo(() => {
    const rawBookingId =
      params?.bookingId;

    if (
      Array.isArray(rawBookingId)
    ) {
      return (
        rawBookingId[0]?.trim() ??
        ""
      );
    }

    return String(
      rawBookingId ?? "",
    ).trim();
  }, [params?.bookingId]);

  const [
    consultation,
    setConsultation,
  ] =
    useState<ConsultationSession | null>(
      null,
    );

  const [
    chatRoom,
    setChatRoom,
  ] =
    useState<
      JoinChatResponse["data"] | null
    >(null);

  const [
    messages,
    setMessages,
  ] = useState<ChatMessage[]>([]);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    elapsedSeconds,
    setElapsedSeconds,
  ] = useState(0);

  const [
    remainingSeconds,
    setRemainingSeconds,
  ] = useState(0);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    ending,
    setEnding,
  ] = useState(false);

  const [
    socketConnected,
    setSocketConnected,
  ] = useState(false);

  const [
    otherParticipantOnline,
    setOtherParticipantOnline,
  ] = useState(false);

  const [
    otherParticipantTyping,
    setOtherParticipantTyping,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    tokenLoading,
    setTokenLoading,
  ] = useState(false);

  const [
    showAudioCall,
    setShowAudioCall,
  ] = useState(false);

  const [
    callId,
    setCallId,
  ] = useState("");

  const [
    tokenData,
    setTokenData,
  ] =
    useState<CallTokenData | null>(
      null,
    );

  const [
    incomingCall,
    setIncomingCall,
  ] =
    useState<IncomingCallPayload | null>(
      null,
    );

  const [
    callStatus,
    setCallStatus,
  ] =
    useState<CallStatus>(
      "IDLE",
    );

  const endProcessedRef =
    useRef(false);

  const mountedRef =
    useRef(true);

  const typingTimeoutRef =
    useRef<number | null>(
      null,
    );

  const messagesContainerRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const currentUserId =
    chatRoom?.currentUser.id?.trim() ??
    "";

  const otherParticipantUserId =
    useMemo(() => {
      if (!chatRoom) {
        return "";
      }

      const currentId =
        chatRoom.currentUser.id;

      if (
        currentId ===
        chatRoom.customer.id
      ) {
        return (
          chatRoom.astrologer.id?.trim() ??
          ""
        );
      }

      return (
        chatRoom.customer.id?.trim() ??
        ""
      );
    }, [chatRoom]);

  const isActive =
    Boolean(
      consultation &&
        consultation.status ===
          "ACTIVE" &&
        !consultation.endedAt &&
        remainingSeconds > 0,
    );

  const otherParticipantName =
    useMemo(() => {
      if (!chatRoom) {
        return (
          consultation?.astrologerName?.trim() ||
          "Astro Soul Path Astrologer"
        );
      }

      const currentId =
        chatRoom.currentUser.id;

      if (
        currentId ===
        chatRoom.customer.id
      ) {
        return (
          chatRoom.astrologer.name?.trim() ||
          consultation?.astrologerName?.trim() ||
          "Astrologer"
        );
      }

      return (
        chatRoom.customer.name?.trim() ||
        "Customer"
      );
    }, [
      chatRoom,
      consultation,
    ]);

  const canStartAudioCall =
    Boolean(
      isActive &&
        currentUserId &&
        otherParticipantUserId &&
        !tokenLoading,
    );

  const callIsOpen =
    callStatus === "RINGING" ||
    callStatus === "ACCEPTED";

  const clearAudioCallState =
    useCallback(() => {
      setIncomingCall(null);
      setShowAudioCall(false);
      setTokenData(null);
      setCallId("");
      setTokenLoading(false);
    }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (
        typingTimeoutRef.current
      ) {
        window.clearTimeout(
          typingTimeoutRef.current,
        );

        typingTimeoutRef.current =
          null;
      }
    };
  }, []);

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
      normalizeMessageList(
      historyResponse.data.messages ?? [],
     ),
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

    const socket =
      connectChatSocket();

    const handleConnect = () => {
      setSocketConnected(true);
      setError("");

      joinChatRoom(
        bookingId,
      );
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
      setOtherParticipantOnline(false);
      setOtherParticipantTyping(false);
    };

    const cleanupConnected =
      onChatConnected(() => {
        setSocketConnected(true);

        joinChatRoom(
          bookingId,
        );
      });

    const cleanupJoined =
      onChatJoined((payload) => {
        if (
          payload.callSessionId !==
          bookingId
        ) {
          return;
        }

        setSocketConnected(true);
      });

    const cleanupMessage =
      onNewMessage(
        (incomingMessage) => {
          if (
            !incomingMessage?.id ||
            incomingMessage.callSessionId !==
              bookingId
          ) {
            return;
          }

          setMessages(
            (current) =>
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
        },
      );

    const cleanupTyping =
      onTyping(
        (
          payload: ChatTypingPayload,
        ) => {
          if (
            payload.callSessionId !==
              bookingId ||
            payload.userId ===
              chatRoom.currentUser.id
          ) {
            return;
          }

          setOtherParticipantTyping(
            Boolean(
              payload.isTyping,
            ),
          );
        },
      );

    const cleanupPresence =
      onPresence(
        (
          payload: ChatPresencePayload,
        ) => {
          if (
            payload.callSessionId !==
              bookingId ||
            payload.userId ===
              chatRoom.currentUser.id
          ) {
            return;
          }

          setOtherParticipantOnline(
            Boolean(
              payload.isOnline,
            ),
          );
        },
      );

    const cleanupReadReceipt =
      onReadReceipt(
        (
          payload:
            | ChatReadPayload
            | ChatReadAllPayload,
        ) => {
          if (
            payload.callSessionId !==
            bookingId
          ) {
            return;
          }

          const readAt =
            payload.readAt ||
            new Date().toISOString();

          setMessages((current) =>
            current.map(
              (chatMessage) => {
                if (
                  chatMessage.senderId !==
                  chatRoom.currentUser.id
                ) {
                  return chatMessage;
                }

                if (
                  "messageIds" in
                    payload &&
                  Array.isArray(
                    payload.messageIds,
                  ) &&
                  !payload.messageIds.includes(
                    chatMessage.id,
                  )
                ) {
                  return chatMessage;
                }

                return {
                  ...chatMessage,
                  isRead: true,
                  readAt,
                };
              },
            ),
          );
        },
      );

    const cleanupError =
      onChatError(
        (
          payload: ChatErrorPayload,
        ) => {
          setError(
            payload.message ||
              "Realtime chat connection failed.",
          );
        },
      );

    socket.on(
      "connect",
      handleConnect,
    );

    socket.on(
      "disconnect",
      handleDisconnect,
    );

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

        typingTimeoutRef.current =
          null;
      }

      sendTypingStatus(
        bookingId,
        false,
      );

      leaveChatRoom(
        bookingId,
      );

      socket.off(
        "connect",
        handleConnect,
      );

      socket.off(
        "disconnect",
        handleDisconnect,
      );

      cleanupConnected();
      cleanupJoined();
      cleanupMessage();
      cleanupTyping();
      cleanupPresence();
      cleanupReadReceipt();
      cleanupError();

      disconnectChatSocket();
    };
  }, [
    bookingId,
    chatRoom,
    markIncomingMessagesAsRead,
  ]);


    useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const socket =
      connectCallSocket(
        currentUserId,
      );

    const handleConnect = () => {
      setError("");
    };

    const handleConnectError = (
      connectError: Error,
    ) => {
      setError(
        connectError.message ||
          "Unable to connect to the call server.",
      );
    };

    const cleanupAccepted =
      onCallAccepted(
        (payload) => {
          if (
            payload.callId !==
            bookingId
          ) {
            return;
          }

          setIncomingCall(null);
          setCallStatus(
            "ACCEPTED",
          );
          setError("");

          setCallId(
            payload.callId,
          );
        },
      );

    const cleanupRejected =
      onCallRejected(
        (payload) => {
          if (
            payload.callId !==
            bookingId
          ) {
            return;
          }

          clearAudioCallState();

          setCallStatus(
            "REJECTED",
          );

          setError(
            payload.reason ||
              "The audio call was rejected.",
          );
        },
      );

    const cleanupMissed =
      onCallMissed(
        (payload) => {
          if (
            payload.callId !==
            bookingId
          ) {
            return;
          }

          clearAudioCallState();

          setCallStatus(
            "MISSED",
          );

          setError(
            payload.reason ||
              "The call was not answered.",
          );
        },
      );

    const cleanupCancelled =
      onCallCancelled(
        (payload) => {
          if (
            payload.callId !==
            bookingId
          ) {
            return;
          }

          clearAudioCallState();

          setCallStatus(
            "CANCELLED",
          );

          setError(
            payload.reason ||
              "The audio call was cancelled.",
          );
        },
      );

    const cleanupUnavailable =
      onCallUnavailable(
        (payload) => {
          if (
            payload.callId !==
            bookingId
          ) {
            return;
          }

          clearAudioCallState();

          setCallStatus(
            "UNAVAILABLE",
          );

          setError(
            payload.reason ||
              "The other participant is currently unavailable.",
          );
        },
      );

    const cleanupRinging =
      onCallRinging(
        (payload) => {
          if (
            payload.callId !==
            bookingId
          ) {
            return;
          }

          setCallId(
            payload.callId,
          );

          setCallStatus(
            "RINGING",
          );

          setError("");
        },
      );

    const handleIncomingCall = (
      payload: IncomingCallPayload,
    ) => {
      if (
        !payload?.callId ||
        payload.callId !==
          bookingId
      ) {
        return;
      }

      setIncomingCall(
        payload,
      );

      setCallId(
        payload.callId,
      );

      setCallStatus(
        "RINGING",
      );

      setError("");
    };

    socket.on(
      "connect",
      handleConnect,
    );

    socket.on(
      "connect_error",
      handleConnectError,
    );

    socket.on(
      "call:incoming",
      handleIncomingCall,
    );

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off(
        "connect",
        handleConnect,
      );

      socket.off(
        "connect_error",
        handleConnectError,
      );

      socket.off(
        "call:incoming",
        handleIncomingCall,
      );

      cleanupAccepted();
      cleanupRejected();
      cleanupMissed();
      cleanupCancelled();
      cleanupUnavailable();
      cleanupRinging();

      /*
       * Root AppProviders bhi call socket use karta hai,
       * isliye yahan disconnectCallSocket() nahi karna.
       */
    };
  }, [
    bookingId,
    clearAudioCallState,
    currentUserId,
  ]);

  useEffect(() => {
  if (
    !consultation ||
    consultation.status !== "ACTIVE" ||
    consultation.endedAt
  ) {
    return;
  }

  const timer = window.setInterval(() => {
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

    async function handleAcceptIncomingCall():
    Promise<void> {
    if (
      !incomingCall ||
      !currentUserId ||
      tokenLoading
    ) {
      return;
    }

    const incomingCallId =
      incomingCall.callId.trim();

    const callerUserId =
      incomingCall.callerUserId?.trim() ||
      incomingCall.callerId?.trim();

    if (
      !incomingCallId ||
      !callerUserId
    ) {
      setError(
        "Incoming call information is incomplete.",
      );

      return;
    }

    try {
      setTokenLoading(true);
      setError("");

      const accepted =
        acceptCall({
          callId:
            incomingCallId,

          callerUserId,

          receiverUserId:
            currentUserId,
        });

      if (!accepted) {
        throw new Error(
          "Call server is disconnected. Please try again.",
        );
      }

      const response =
        await getCallToken(
          incomingCallId,
        );

      if (
        !response?.data?.appId ||
        !response.data.token ||
        !response.data.channelName ||
        !Number.isInteger(
          response.data.uid,
        )
      ) {
        throw new Error(
          "Backend returned incomplete audio-call credentials.",
        );
      }

      if (!mountedRef.current) {
        return;
      }

      setCallId(
        incomingCallId,
      );

      setTokenData({
        appId:
          response.data.appId,

        token:
          response.data.token,

        channelName:
          response.data.channelName,

        uid:
          response.data.uid,
      });

      setIncomingCall(null);

      setCallStatus(
        "ACCEPTED",
      );

      setShowAudioCall(true);
    } catch (error: unknown) {
      if (!mountedRef.current) {
        return;
      }

      setError(
        getErrorMessage(
          error,
          "Unable to accept the audio call.",
        ),
      );
    } finally {
      if (mountedRef.current) {
        setTokenLoading(false);
      }
    }
  }

  function handleRejectIncomingCall():
    void {
    if (
      !incomingCall ||
      !currentUserId ||
      tokenLoading
    ) {
      return;
    }

    const incomingCallId =
      incomingCall.callId.trim();

    const callerUserId =
     incomingCall.callerId?.trim();

    if (
      !incomingCallId ||
      !callerUserId
    ) {
      setError(
        "Incoming call information is incomplete.",
      );

      return;
    }

    const rejected =
      rejectCall({
        callId:
          incomingCallId,

        callerUserId,

        receiverUserId:
          currentUserId,

        reason:
          "Call rejected by recipient.",
      });

    if (!rejected) {
      setError(
        "Call server is disconnected. Unable to reject the call.",
      );

      return;
    }

    clearAudioCallState();

    setCallStatus(
      "REJECTED",
    );
  }

  async function handleStartAudioCall():
    Promise<void> {
    if (
      !canStartAudioCall ||
      callIsOpen
    ) {
      return;
    }

    if (
      !bookingId ||
      !currentUserId ||
      !otherParticipantUserId
    ) {
      setError(
        "Call participant information is missing.",
      );

      return;
    }

    try {
      setTokenLoading(true);
      setError("");

      const emitted =
        initiateCall({
          callId:
            bookingId,

          recipientUserId:
            otherParticipantUserId,

          callerId:
            currentUserId,

          callerName:
            chatRoom?.currentUser.name?.trim() ||
            "Astro Soul Path User",

          consultationType:
            "AUDIO",
        });

      if (!emitted) {
        throw new Error(
          "Call server is disconnected. Please wait and try again.",
        );
      }

      const response =
        await getCallToken(
          bookingId,
        );

      if (
        !response?.data?.appId ||
        !response.data.token ||
        !response.data.channelName ||
        !Number.isInteger(
          response.data.uid,
        )
      ) {
        throw new Error(
          "Backend returned incomplete audio-call credentials.",
        );
      }

      if (!mountedRef.current) {
        return;
      }

      setCallId(
        bookingId,
      );

      setTokenData({
        appId:
          response.data.appId,

        token:
          response.data.token,

        channelName:
          response.data.channelName,

        uid:
          response.data.uid,
      });

      setCallStatus(
        "RINGING",
      );

      /*
       * AudioCall component render hoga,
       * lekin autoJoin tab hoga jab
       * callStatus ACCEPTED ho jayega.
       */
      setShowAudioCall(true);
    } catch (error: unknown) {
      if (!mountedRef.current) {
        return;
      }

      clearAudioCallState();

      setCallStatus(
        "IDLE",
      );

      setError(
        getErrorMessage(
          error,
          "Unable to start the audio call.",
        ),
      );
    } finally {
      if (mountedRef.current) {
        setTokenLoading(false);
      }
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
      <main className="min-h-screen bg-[#FAF7F0] px-4 py-12 sm:px-6 sm:py-20">
        <div
          className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl"
          aria-busy="true"
          aria-label="Loading realtime consultation"
        >
          <div className="animate-pulse bg-[#0B1026] p-6">
            <div className="h-4 w-40 rounded bg-white/20" />
            <div className="mt-4 h-8 w-64 rounded bg-white/20" />

            <div className="mt-5 flex flex-wrap gap-3">
              {Array.from({
                length: 4,
              }).map((_, index) => (
                <div
                  key={index}
                  className="h-14 w-28 rounded-xl bg-white/10"
                />
              ))}
            </div>
          </div>

          <div className="h-[500px] animate-pulse bg-[#FAF7F0] p-6">
            <div className="space-y-5">
              <div className="h-16 w-2/3 rounded-2xl bg-gray-200" />

              <div className="ml-auto h-20 w-3/5 rounded-2xl bg-[#D4AF37]/30" />

              <div className="h-16 w-1/2 rounded-2xl bg-gray-200" />
            </div>
          </div>

          <div className="animate-pulse border-t p-5">
            <div className="h-12 rounded-xl bg-gray-200" />
          </div>
        </div>
      </main>
    );
  }

  if (!consultation || !chatRoom) {
    return (
      <main className="min-h-screen bg-[#FAF7F0] px-4 py-12 sm:px-6 sm:py-20">
        <div
          role="alert"
          className="mx-auto max-w-4xl rounded-3xl border border-red-200 bg-white p-6 shadow-xl sm:p-8"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl text-red-700">
            !
          </div>

          <h1 className="mt-6 text-2xl font-bold text-[#0B1026]">
            Unable to open consultation
          </h1>

          <p className="mt-3 leading-7 text-red-700">
            {error ||
              "The requested consultation was not found or is no longer available."}
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() =>
                void loadChatData()
              }
              className="rounded-xl border border-red-300 px-5 py-3 font-semibold text-red-700 transition hover:bg-red-50"
            >
              Try Again
            </button>

            <Link
              href="/consultations"
              className="inline-flex items-center justify-center rounded-xl border border-[#0B1026] px-5 py-3 font-semibold text-[#0B1026] transition hover:bg-[#0B1026] hover:text-white"
            >
              My Consultations
            </Link>

            <Link
              href="/astrologers"
              className="inline-flex items-center justify-center rounded-xl bg-[#D4AF37] px-5 py-3 font-semibold text-[#0B1026] transition hover:bg-[#C9A52F]"
            >
              Browse Astrologers
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <IncomingCallModal
        open={Boolean(
          incomingCall,
        )}
        callerName={
          incomingCall?.callerName ??
          "Astro Soul Path User"
        }
        consultationType={
          incomingCall?.consultationType ??
          "AUDIO"
        }
        timeoutSeconds={
          incomingCall?.timeoutSeconds ??
          30
        }
        isProcessing={
          tokenLoading
        }
        onAccept={() =>
          void handleAcceptIncomingCall()
        }
        onReject={
          handleRejectIncomingCall
        }
      />

      <main className="min-h-screen bg-[#FAF7F0] px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">
                Active Consultation
              </p>

              <h1 className="mt-1 text-2xl font-bold text-[#0B1026] sm:text-3xl">
                Live Chat
              </h1>
            </div>

            <Link
              href="/consultations"
              className="inline-flex w-fit items-center rounded-xl border border-[#0B1026] px-5 py-2.5 text-sm font-semibold text-[#0B1026] transition hover:bg-[#0B1026] hover:text-white"
            >
              ← My Consultations
            </Link>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="leading-6">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setError("")
                  }
                  className="shrink-0 rounded-lg px-2 text-xl leading-none transition hover:bg-red-100"
                  aria-label="Close error"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          <section className="overflow-hidden rounded-3xl bg-white shadow-xl">
            <header className="bg-[#0B1026] p-5 text-white sm:p-6">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#D4AF37]">
                    Live Chat Consultation
                  </p>

                  <h2 className="mt-2 truncate text-2xl font-bold">
                    {otherParticipantName}
                  </h2>

                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
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
                            ? "animate-pulse bg-green-400"
                            : "bg-gray-500"
                        }`}
                        aria-hidden="true"
                      />

                      {otherParticipantOnline
                        ? "Participant online"
                        : "Participant offline"}
                    </span>

                    <span
                      className={`inline-flex items-center gap-2 ${
                        socketConnected
                          ? "text-green-300"
                          : "text-amber-300"
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          socketConnected
                            ? "bg-green-400"
                            : "animate-pulse bg-amber-400"
                        }`}
                        aria-hidden="true"
                      />

                      {socketConnected
                        ? "Realtime connected"
                        : "Realtime reconnecting"}
                    </span>

                    <span className="text-gray-300">
                      ₹
                      {Number(
                        consultation.ratePerMinute,
                      ).toFixed(2)}
                      /minute
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:flex xl:flex-wrap xl:items-center">
                  <div className="rounded-xl bg-white/10 px-4 py-2">
                    <p className="text-xs text-gray-300">
                      Elapsed
                    </p>

                    <p className="mt-1 font-bold">
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
                      className={`mt-1 font-bold ${
                        remainingSeconds <= 60 &&
                        isActive
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

                    <p className="mt-1 font-bold">
                      {consultation.totalMinutes}{" "}
                      min
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/10 px-4 py-2">
                    <p className="text-xs text-gray-300">
                      Charged
                    </p>

                    <p className="mt-1 font-bold text-[#D4AF37]">
                      ₹
                      {Number(
                        consultation.amountCharged,
                      ).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() =>
                    void handleStartAudioCall()
                  }
                  disabled={
                    !canStartAudioCall ||
                    callIsOpen
                  }
                  className="inline-flex items-center justify-center rounded-xl bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-500 disabled:opacity-70"
                >
                  {tokenLoading
                    ? "Preparing Audio..."
                    : callStatus ===
                        "RINGING"
                      ? "Calling..."
                      : callStatus ===
                          "ACCEPTED"
                        ? "Audio Connected"
                        : "Start Audio Call"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void handleEndConsultation()
                  }
                  disabled={
                    ending ||
                    !isActive
                  }
                  className="inline-flex items-center justify-center rounded-xl bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {ending
                    ? "Ending Consultation..."
                    : "End Consultation"}
                </button>
              </div>
            </header>

            {!isActive && (
              <div className="border-b border-gray-200 bg-gray-100 p-4 text-center font-semibold text-gray-700">
                This consultation has ended.
              </div>
            )}

            {remainingSeconds > 0 &&
              remainingSeconds <= 60 &&
              isActive && (
                <div
                  role="alert"
                  className="border-b border-red-200 bg-red-50 p-4 text-center font-semibold text-red-700"
                >
                  Less than one minute remains in this
                  consultation.
                </div>
              )}

            {callStatus ===
              "RINGING" && (
              <div className="border-b border-blue-200 bg-blue-50 p-4 text-center text-sm font-semibold text-blue-700">
                Audio call request sent. Waiting for{" "}
                {otherParticipantName} to accept…
              </div>
            )}

            {callStatus ===
              "REJECTED" && (
              <div className="border-b border-red-200 bg-red-50 p-4 text-center text-sm font-semibold text-red-700">
                The audio call was rejected.
              </div>
            )}

            {callStatus ===
              "MISSED" && (
              <div className="border-b border-amber-200 bg-amber-50 p-4 text-center text-sm font-semibold text-amber-700">
                The audio call was not answered.
              </div>
            )}

            {callStatus ===
              "UNAVAILABLE" && (
              <div className="border-b border-amber-200 bg-amber-50 p-4 text-center text-sm font-semibold text-amber-700">
                The other participant is currently
                unavailable.
              </div>
            )}

            <div
              ref={
                messagesContainerRef
              }
              className="h-[55vh] min-h-[420px] max-h-[650px] overflow-y-auto bg-[#FAF7F0] p-4 sm:p-6"
            >
              {messages.length ===
              0 ? (
                <div className="flex h-full items-center justify-center text-center">
                  <div className="max-w-md">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#D4AF37]/15 text-4xl">
                      💬
                    </div>

                    <h2 className="mt-6 text-xl font-bold text-[#0B1026]">
                      Consultation started
                    </h2>

                    <p className="mt-2 leading-7 text-gray-600">
                      Send your first message to begin the
                      consultation.
                    </p>

                    <p className="mt-3 text-sm leading-6 text-gray-500">
                      Messages and attachments are securely
                      stored in your consultation history.
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
                        Boolean(
                          attachment,
                        );

                      return (
                        <article
                          key={
                            chatMessage.id
                          }
                          className={`flex ${
                            isOwnMessage
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[88%] rounded-2xl px-4 py-3 sm:max-w-[75%] sm:px-5 ${
                              isOwnMessage
                                ? "rounded-br-md bg-[#D4AF37] text-[#0B1026]"
                                : "rounded-bl-md bg-white text-[#0B1026] shadow-sm"
                            }`}
                          >
                            {!isOwnMessage && (
                              <p className="mb-1 text-xs font-bold opacity-70">
                                {chatMessage
                                  .sender
                                  ?.name ||
                                  otherParticipantName}
                              </p>
                            )}

                            {chatMessage.content && (
                              <p className="whitespace-pre-wrap break-words leading-6">
                                {
                                  chatMessage.content
                                }
                              </p>
                            )}

                            {isImage &&
                              attachment && (
                                <a
                                  href={
                                    attachment.url
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-3 block"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={
                                      attachment.url
                                    }
                                    alt={
                                      attachment.name ||
                                      "Chat attachment"
                                    }
                                    className="max-h-80 w-auto max-w-full rounded-xl object-contain"
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
                                  className="mt-3 flex items-center gap-3 rounded-xl border border-current/20 p-3 no-underline transition hover:bg-black/5"
                                >
                                  <span
                                    className="text-2xl"
                                    aria-hidden="true"
                                  >
                                    📎
                                  </span>

                                  <span className="min-w-0">
                                    <span className="block truncate font-semibold underline">
                                      {attachment.name ||
                                        "Open attachment"}
                                    </span>

                                    <span className="mt-1 block text-xs opacity-60">
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

                            <div className="mt-2 flex items-center justify-end gap-2 text-[11px] opacity-60">
                              <time
                                dateTime={
                                  chatMessage.createdAt
                                }
                              >
                                {formatMessageTime(
                                  chatMessage.createdAt,
                                )}
                              </time>

                              {isOwnMessage && (
                                <span>
                                  {chatMessage.isRead
                                    ? "✓✓ Read"
                                    : "✓ Sent"}
                                </span>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    },
                  )}

                  {otherParticipantTyping && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl rounded-bl-md bg-white px-5 py-3 text-sm text-gray-500 shadow-sm">
                        <span className="inline-flex items-center gap-2">
                          <span className="flex gap-1">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
                          </span>

                          {otherParticipantName} is typing
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 bg-white p-4 sm:p-5">
              {isActive && (
                <div className="mb-4">
                  <ChatAttachmentButton
                    callSessionId={
                      bookingId
                    }
                    onUploaded={(
                      attachment,
                    ) =>
                      void handleAttachmentUploaded(
                        attachment,
                      )
                    }
                  />
                </div>
              )}

              <form
                onSubmit={
                  handleSendMessage
                }
                className="flex flex-col gap-3 sm:flex-row"
              >
                <label
                  htmlFor="chat-message"
                  className="sr-only"
                >
                  Chat message
                </label>

                <input
                  id="chat-message"
                  type="text"
                  value={message}
                  disabled={
                    !isActive ||
                    sending
                  }
                  maxLength={2_000}
                  autoComplete="off"
                  onChange={(
                    event,
                  ) =>
                    handleMessageInputChange(
                      event.target
                        .value,
                    )
                  }
                  placeholder={
                    isActive
                      ? "Type your message..."
                      : "Consultation has ended"
                  }
                  className="min-w-0 flex-1 rounded-xl border border-gray-300 px-4 py-3.5 outline-none transition focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/15 disabled:cursor-not-allowed disabled:bg-gray-100"
                />

                <button
                  type="submit"
                  disabled={
                    !message.trim() ||
                    !isActive ||
                    sending
                  }
                  className="inline-flex min-w-28 items-center justify-center rounded-xl bg-[#D4AF37] px-7 py-3.5 font-semibold text-[#0B1026] transition hover:bg-[#C9A52F] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending
                    ? "Sending..."
                    : "Send"}
                </button>
              </form>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                <span>
                  Maximum message length: 2,000 characters
                </span>

                <span>
                  {message.length}/2,000
                </span>
              </div>

              {showAudioCall &&
                tokenData &&
                callId && (
                  <div className="mt-6">
                    <AudioCall
                      callId={
                        callId
                      }
                      appId={
                        tokenData.appId
                      }
                      channelName={
                        tokenData.channelName
                      }
                      token={
                        tokenData.token
                      }
                      uid={
                        tokenData.uid
                      }
                      autoJoin={
                        callStatus ===
                        "ACCEPTED"
                      }
                      forceEnd={
                        remainingSeconds <=
                        0
                      }
                      forceEndReason="Purchased consultation time completed."
                      expiresAt={
                        consultation.expiresAt
                      }
                      participantName={
                        otherParticipantName
                      }
                      onEnd={() => {
                        clearAudioCallState();
                        setCallStatus(
                          "IDLE",
                        );
                      }}
                    />
                  </div>
                )}
            </div>
          </section>

          <p className="mt-4 text-center text-xs leading-5 text-gray-500">
            Live messages, attachments, typing status,
            presence and read receipts are connected to the
            Astro Soul Path backend.
          </p>
        </div>
      </main>
    </>
  );
}