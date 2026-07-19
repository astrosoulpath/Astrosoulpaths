"use client";

import Link from "next/link";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import dynamic from "next/dynamic";

const AudioCall = dynamic(
  () => import("@/components/call/AudioCall"),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-3xl bg-white p-10 text-center shadow-xl">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-[#D4AF37]" />

        <p className="mt-5 font-semibold text-[#0B1026]">
          Loading audio call...
        </p>
      </div>
    ),
  },
);
import {
  getConsultationHistory,
  type ConsultationSession,
} from "@/services/consultationService";
import {
  cancelCall,
  onCallAccepted,
  onCallCancelled,
  onCallError,
  onCallMissed,
  onCallRejected,
  onCallUnavailable,
  type CallAcceptedPayload,
} from "@/services/callSocket";

type FilterOption =
  | "all"
  | "active"
  | "completed";

type ConsultationMode =
  | "chat"
  | "audio"
  | "video";

type AudioCallPhase =
  | "IDLE"
  | "RINGING"
  | "ACCEPTED"
  | "CONNECTING"
  | "ENDED"
  | "FAILED";

type StoredActiveCall = {
  id?: string;
  callId?: string;
  userId?: string;
  callerUserId?: string;
  receiverUserId?: string;
  recipientUserId?: string;
  astrologerId?: string;
  astrologerName?: string;
  channelName?: string;
  ratePerMinute?: number;
  purchasedMinutes?: number;
  extendedMinutes?: number;
  totalMinutes?: number;
  amountCharged?: number;
  remainingSeconds?: number;
  startedAt?: string;
  expiresAt?: string;
  endedAt?: string | null;
  status?: string;
  acceptedAt?: string;
  consultationType?: "AUDIO" | "VIDEO";
  mode?: ConsultationMode;
};

type AgoraCallCredentials = {
  appId: string;
  token: string;
  channelName: string;
  uid: number;
  callId: string;
  expiresAt?: string;
};

function formatDate(
  value?: string | null,
): string {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Not available";
  }

  return date.toLocaleString(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  );
}

function getDurationSeconds(
  consultation: ConsultationSession,
): number {
  const startTime =
    new Date(
      consultation.startedAt,
    ).getTime();

  const endTime =
    consultation.endedAt
      ? new Date(
          consultation.endedAt,
        ).getTime()
      : Date.now();

  if (
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      (endTime - startTime) /
        1000,
    ),
  );
}

function formatDuration(
  totalSeconds: number,
): string {
  const safeSeconds =
    Math.max(
      0,
      Math.floor(totalSeconds),
    );

  const hours =
    Math.floor(
      safeSeconds / 3600,
    );

  const minutes =
    Math.floor(
      (safeSeconds % 3600) /
        60,
    );

  const seconds =
    safeSeconds % 60;

  if (hours > 0) {
    return `${String(
      hours,
    ).padStart(2, "0")}:${String(
      minutes,
    ).padStart(2, "0")}:${String(
      seconds,
    ).padStart(2, "0")}`;
  }

  return `${String(
    minutes,
  ).padStart(2, "0")}:${String(
    seconds,
  ).padStart(2, "0")}`;
}

function isActiveConsultation(
  consultation: ConsultationSession,
): boolean {
  if (
    consultation.status !==
      "ACTIVE" ||
    consultation.endedAt
  ) {
    return false;
  }

  const expiryTime =
    new Date(
      consultation.expiresAt,
    ).getTime();

  return (
    Number.isFinite(
      expiryTime,
    ) &&
    expiryTime > Date.now()
  );
}

function getStatusLabel(
  consultation: ConsultationSession,
): string {
  if (
    isActiveConsultation(
      consultation,
    )
  ) {
    return "Active";
  }

  if (
    consultation.status ===
    "EXPIRED"
  ) {
    return "Expired";
  }

  if (
    consultation.status ===
    "ENDED"
  ) {
    return "Completed";
  }

  return (
    consultation.status ||
    "Completed"
  );
}

function getSafeNumber(
  value: unknown,
): number {
  const numberValue =
    Number(value);

  return Number.isFinite(
    numberValue,
  )
    ? numberValue
    : 0;
}

function getApiBaseUrl(): string {
  const value =
    process.env
      .NEXT_PUBLIC_API_BASE_URL
      ?.trim() ||
    process.env
      .NEXT_PUBLIC_API_URL
      ?.trim();

  if (!value) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not configured.",
    );
  }

  return value.replace(
    /\/+$/,
    "",
  );
}

function readStoredActiveCall():
  StoredActiveCall | null {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  const rawValue =
    window.localStorage.getItem(
      "asp_active_call",
    );

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(
      rawValue,
    ) as StoredActiveCall;
  } catch {
    window.localStorage.removeItem(
      "asp_active_call",
    );

    return null;
  }
}

function writeStoredActiveCall(
  value: StoredActiveCall,
): void {
  window.localStorage.setItem(
    "asp_active_call",
    JSON.stringify(value),
  );
}

async function requestAgoraToken(
  callId: string,
): Promise<AgoraCallCredentials> {
  const accessToken =
    window.localStorage.getItem(
      "asp_access_token",
    );

  if (!accessToken) {
    throw new Error(
      "LOGIN_REQUIRED",
    );
  }

  const response =
    await fetch(
      `${getApiBaseUrl()}/call/token`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${accessToken}`,
        },

        body: JSON.stringify({
          callId,
        }),
      },
    );

  const payload =
    (await response.json().catch(
      () => null,
    )) as
      | {
          success?: boolean;
          message?: string;
          data?: {
            appId?: string;
            token?: string;
            channelName?: string;
            uid?: number;
            callId?: string;
            expiresAt?: string;
          };
        }
      | null;

  if (!response.ok) {
    throw new Error(
      payload?.message ||
        "Unable to generate Agora call token.",
    );
  }

  const data = payload?.data;

  const uid = data?.uid;

if (
  !data?.appId ||
  !data.token ||
  !data.channelName ||
  typeof uid !== "number" ||
  !Number.isInteger(uid) ||
  !data.callId
) {
  throw new Error(
    "Backend returned incomplete Agora call credentials.",
  );
}

return {
  appId: data.appId,
  token: data.token,
  channelName: data.channelName,
  uid,
  callId: data.callId,
  expiresAt: data.expiresAt,
};
}

function ConsultationsContent() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const queryCallId =
    searchParams
      .get("callId")
      ?.trim() || "";

  const queryMode =
    (
      searchParams
        .get("mode")
        ?.trim()
        .toLowerCase() || ""
    ) as ConsultationMode | "";

  const [
    consultations,
    setConsultations,
  ] =
    useState<
      ConsultationSession[]
    >([]);

  const [filter, setFilter] =
    useState<FilterOption>(
      "all",
    );

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [
    activeStoredCall,
    setActiveStoredCall,
  ] =
    useState<StoredActiveCall | null>(
      null,
    );

  const [
    audioPhase,
    setAudioPhase,
  ] =
    useState<AudioCallPhase>(
      "IDLE",
    );

  const [
    agoraCredentials,
    setAgoraCredentials,
  ] =
    useState<AgoraCallCredentials | null>(
      null,
    );

  const [
    audioError,
    setAudioError,
  ] = useState("");

  const [
    cancellingCall,
    setCancellingCall,
  ] = useState(false);

  const mountedRef =
    useRef(true);

  const tokenRequestedRef =
    useRef("");

  const activeAudioCallId =
    useMemo(() => {
      if (
        queryMode !== "audio"
      ) {
        return "";
      }

      return (
        queryCallId ||
        activeStoredCall?.callId ||
        activeStoredCall?.id ||
        ""
      );
    }, [
      activeStoredCall?.callId,
      activeStoredCall?.id,
      queryCallId,
      queryMode,
    ]);

  const loadConsultations =
    useCallback(
      async (
        refresh = false,
      ) => {
        const token =
          localStorage.getItem(
            "asp_access_token",
          );

        if (!token) {
          router.replace(
            `/login?redirect=${encodeURIComponent(
              "/consultations",
            )}`,
          );

          return;
        }

        try {
          if (refresh) {
            setRefreshing(
              true,
            );
          } else {
            setLoading(true);
          }

          setError("");

         const response =
          await getConsultationHistory();

         const calls = Array.isArray(response.data)
          ? response.data
          : [];

          setConsultations(
            [...calls].sort(
              (
                first,
                second,
              ) =>
                new Date(
                  second.createdAt,
                ).getTime() -
                new Date(
                  first.createdAt,
                ).getTime(),
            ),
          );
        } catch (
          error: unknown
        ) {
          const message =
            error instanceof Error
              ? error.message
              : "Unable to load consultations.";

          if (
            message ===
            "LOGIN_REQUIRED"
          ) {
            localStorage.removeItem(
              "asp_access_token",
            );

            localStorage.removeItem(
              "asp_refresh_token",
            );

            router.replace(
              `/login?redirect=${encodeURIComponent(
                "/consultations",
              )}`,
            );

            return;
          }

          setError(message);
        } finally {
          if (
            mountedRef.current
          ) {
            setLoading(false);
            setRefreshing(
              false,
            );
          }
        }
      },
      [router],
    );

  const loadAgoraCredentials =
    useCallback(
      async (
        callId: string,
      ) => {
        const normalizedCallId =
          callId.trim();

        if (
          !normalizedCallId ||
          tokenRequestedRef.current ===
            normalizedCallId
        ) {
          return;
        }

        tokenRequestedRef.current =
          normalizedCallId;

        try {
          setAudioPhase(
            "CONNECTING",
          );

          setAudioError("");

          const credentials =
            await requestAgoraToken(
              normalizedCallId,
            );

          if (
            !mountedRef.current
          ) {
            return;
          }

          setAgoraCredentials(
            credentials,
          );

          setAudioPhase(
            "ACCEPTED",
          );
        } catch (
          error: unknown
        ) {
          tokenRequestedRef.current =
            "";

          if (
            !mountedRef.current
          ) {
            return;
          }

          const message =
            error instanceof Error
              ? error.message
              : "Unable to prepare audio call.";

          if (
            message ===
            "LOGIN_REQUIRED"
          ) {
            router.replace(
              `/login?redirect=${encodeURIComponent(
                `/consultations?callId=${normalizedCallId}&mode=audio`,
              )}`,
            );

            return;
          }

          setAudioError(
            message,
          );

          setAudioPhase(
            "FAILED",
          );
        }
      },
      [router],
    );

  useEffect(() => {
    mountedRef.current =
      true;

    setActiveStoredCall(
      readStoredActiveCall(),
    );

    void loadConsultations();

    return () => {
      mountedRef.current =
        false;
    };
  }, [loadConsultations]);

  useEffect(() => {
    if (
      queryMode !== "audio" ||
      !activeAudioCallId
    ) {
      return;
    }

    const storedCall =
      readStoredActiveCall();

    if (storedCall) {
      setActiveStoredCall(
        storedCall,
      );
    }

    const accepted =
      storedCall?.status ===
        "ACCEPTED" ||
      Boolean(
        storedCall?.acceptedAt,
      );

    if (accepted) {
      void loadAgoraCredentials(
        activeAudioCallId,
      );
      return;
    }

    setAudioPhase(
      "RINGING",
    );
  }, [
    activeAudioCallId,
    loadAgoraCredentials,
    queryMode,
  ]);

  useEffect(() => {
    if (
      queryMode !== "audio" ||
      !activeAudioCallId
    ) {
      return;
    }

    const cleanupAccepted =
      onCallAccepted(
        (
          payload:
            CallAcceptedPayload,
        ) => {
          if (
            payload.callId !==
            activeAudioCallId
          ) {
            return;
          }

          const currentStoredCall =
            readStoredActiveCall();

          const updatedCall = {
            ...(currentStoredCall ??
              {}),
            id:
              payload.callId,
            callId:
              payload.callId,
            callerUserId:
              payload.callerUserId,
            receiverUserId:
              payload.receiverUserId,
            recipientUserId:
              payload.recipientUserId,
            consultationType:
              payload.consultationType,
            mode:
              "audio" as const,
            status:
              payload.status,
            acceptedAt:
              payload.acceptedAt,
          };

          writeStoredActiveCall(
            updatedCall,
          );

          setActiveStoredCall(
            updatedCall,
          );

          void loadAgoraCredentials(
            payload.callId,
          );
        },
      );

    const cleanupRejected =
      onCallRejected(
        (payload) => {
          if (
            payload.callId !==
            activeAudioCallId
          ) {
            return;
          }

          setAudioPhase(
            "FAILED",
          );

          setAudioError(
            payload.reason ||
              "The call was rejected.",
          );
        },
      );

    const cleanupCancelled =
      onCallCancelled(
        (payload) => {
          if (
            payload.callId !==
            activeAudioCallId
          ) {
            return;
          }

          setAudioPhase(
            "ENDED",
          );

          setAudioError(
            payload.reason ||
              "The call was cancelled.",
          );
        },
      );

    const cleanupMissed =
      onCallMissed(
        (payload) => {
          if (
            payload.callId !==
            activeAudioCallId
          ) {
            return;
          }

          setAudioPhase(
            "ENDED",
          );

          setAudioError(
            payload.reason ||
              "The call was not answered.",
          );
        },
      );

    const cleanupUnavailable =
      onCallUnavailable(
        (payload) => {
          if (
            payload.callId !==
            activeAudioCallId
          ) {
            return;
          }

          setAudioPhase(
            "FAILED",
          );

          setAudioError(
            payload.reason ||
              "The astrologer is unavailable.",
          );
        },
      );

    const cleanupError =
      onCallError(
        (payload) => {
          setAudioError(
            payload.message,
          );
        },
      );

    return () => {
      cleanupAccepted();
      cleanupRejected();
      cleanupCancelled();
      cleanupMissed();
      cleanupUnavailable();
      cleanupError();
    };
  }, [
    activeAudioCallId,
    loadAgoraCredentials,
    queryMode,
  ]);

  const handleCancelRingingCall =
    useCallback(async () => {
      if (
        cancellingCall ||
        !activeAudioCallId
      ) {
        return;
      }

      const storedCall =
        readStoredActiveCall();

      const callerUserId =
        storedCall?.callerUserId ||
        storedCall?.userId ||
        "";

      const recipientUserId =
        storedCall?.recipientUserId ||
        storedCall?.astrologerId ||
        "";

      if (!recipientUserId) {
        setAudioError(
          "Recipient information is missing. Unable to cancel the call.",
        );

        return;
      }

      setCancellingCall(
        true,
      );

      const emitted =
        cancelCall({
          callId:
            activeAudioCallId,

          callerUserId:
            callerUserId ||
            undefined,

          recipientUserId,

          reason:
            "The caller cancelled the call.",
        });

      if (!emitted) {
        setCancellingCall(
          false,
        );

        setAudioError(
          "Call server is disconnected. Please try again.",
        );

        return;
      }

      setAudioPhase(
        "ENDED",
      );

      setCancellingCall(
        false,
      );

      void loadConsultations(
        true,
      );
    }, [
      activeAudioCallId,
      cancellingCall,
      loadConsultations,
    ]);

  const handleAudioCallEnd =
    useCallback(() => {
      setAudioPhase(
        "ENDED",
      );

      setAgoraCredentials(
        null,
      );

      tokenRequestedRef.current =
        "";

      const stored =
        readStoredActiveCall();

      if (stored) {
        writeStoredActiveCall({
          ...stored,
          status: "ENDED",
          endedAt:
            new Date().toISOString(),
        });
      }

      void loadConsultations(
        true,
      );

      router.replace(
        "/consultations",
      );
    }, [
      loadConsultations,
      router,
    ]);

  const filteredConsultations =
    useMemo(() => {
      if (filter === "all") {
        return consultations;
      }

      if (
        filter === "active"
      ) {
        return consultations.filter(
          isActiveConsultation,
        );
      }

      return consultations.filter(
        (consultation) =>
          !isActiveConsultation(
            consultation,
          ),
      );
    }, [
      consultations,
      filter,
    ]);

  const activeCount =
    useMemo(
      () =>
        consultations.filter(
          isActiveConsultation,
        ).length,
      [consultations],
    );

  const completedCount =
    useMemo(
      () =>
        consultations.filter(
          (consultation) =>
            !isActiveConsultation(
              consultation,
            ),
        ).length,
      [consultations],
    );

  const totalSpent =
    useMemo(
      () =>
        consultations.reduce(
          (
            total,
            consultation,
          ) =>
            total +
            getSafeNumber(
              consultation.amountCharged,
            ),
          0,
        ),
      [consultations],
    );

  const currentAudioCall =
    useMemo(() => {
      if (
        !activeAudioCallId
      ) {
        return null;
      }

      return (
        consultations.find(
          (consultation) =>
            consultation.id ===
            activeAudioCallId,
        ) ?? null
      );
    }, [
      activeAudioCallId,
      consultations,
    ]);

  return (
    <main className="min-h-screen bg-[#FAF7F0] px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-semibold text-[#D4AF37]">
              My Consultations
            </p>

            <h1 className="mt-3 text-4xl font-bold text-[#0B1026] sm:text-5xl">
              Consultation history
            </h1>

            <p className="mt-4 max-w-2xl leading-7 text-gray-600">
              Continue active audio or chat
              consultations and review your
              completed consultation records.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={
                loading ||
                refreshing
              }
              onClick={() =>
                void loadConsultations(
                  true,
                )
              }
              className="rounded-xl border border-[#0B1026] px-5 py-3 font-semibold text-[#0B1026] transition hover:bg-[#0B1026] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <Link
              href="/astrologers"
              className="rounded-xl bg-[#D4AF37] px-5 py-3 font-semibold text-[#0B1026] transition hover:bg-[#C9A52F]"
            >
              Find Astrologers
            </Link>
          </div>
        </div>

        {queryMode ===
          "audio" &&
          activeAudioCallId && (
            <section className="mt-10">
              {audioError && (
                <div
                  role="alert"
                  className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="font-bold">
                        Audio call notification
                      </h2>

                      <p className="mt-1 text-sm">
                        {audioError}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setAudioError(
                          "",
                        )
                      }
                      className="font-bold"
                      aria-label="Close notification"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}

              {audioPhase ===
                "RINGING" && (
                <div className="overflow-hidden rounded-3xl bg-white shadow-xl">
                  <div className="bg-gradient-to-br from-[#0B1026] to-[#202B57] p-8 text-center text-white">
                    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white/15 text-5xl ring-8 ring-white/10">
                      📞
                    </div>

                    <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-white/60">
                      Calling
                    </p>

                    <h2 className="mt-2 text-3xl font-bold">
                      {
                        activeStoredCall?.astrologerName ||
                        currentAudioCall?.astrologer?.userProfile?.fullName ||
                        "Astrologer"
                       }
                    </h2>

                    <p className="mt-2 text-white/70">
                      Waiting for the astrologer to answer…
                    </p>
                  </div>

                  <div className="p-6 text-center sm:p-8">
                    <div className="mx-auto flex max-w-md items-center justify-center gap-3 rounded-2xl bg-blue-50 p-4 text-blue-700">
                      <span className="h-3 w-3 animate-pulse rounded-full bg-blue-500" />

                      Incoming call request sent
                    </div>

                    <button
                      type="button"
                      disabled={
                        cancellingCall
                      }
                      onClick={() =>
                        void handleCancelRingingCall()
                      }
                      className="mt-6 rounded-2xl bg-red-600 px-8 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {cancellingCall
                        ? "Cancelling..."
                        : "Cancel Call"}
                    </button>
                  </div>
                </div>
              )}

              {audioPhase ===
                "CONNECTING" && (
                <div className="rounded-3xl bg-white p-10 text-center shadow-xl">
                  <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-[#D4AF37]" />

                  <h2 className="mt-6 text-2xl font-bold text-[#0B1026]">
                    Preparing secure audio
                  </h2>

                  <p className="mt-2 text-gray-600">
                    Generating your Agora
                    credentials…
                  </p>
                </div>
              )}

              {audioPhase ===
                "ACCEPTED" &&
                agoraCredentials && (
                  <AudioCall
                    callId={
                      agoraCredentials.callId
                    }
                    appId={
                      agoraCredentials.appId
                    }
                    channelName={
                      agoraCredentials.channelName
                    }
                    token={
                      agoraCredentials.token
                    }
                    uid={
                      agoraCredentials.uid
                    }
                    autoJoin
                    expiresAt={
                      activeStoredCall?.expiresAt ||
                      currentAudioCall?.expiresAt ||
                      agoraCredentials.expiresAt ||
                      null
                    }
                    participantName={
                       activeStoredCall?.astrologerName ||
                       currentAudioCall?.astrologer?.userProfile?.fullName ||
                       "Astrologer"
                     }
                    onEnd={
                      handleAudioCallEnd
                    }
                  />
                )}

              {(audioPhase ===
                "ENDED" ||
                audioPhase ===
                  "FAILED") && (
                <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 text-4xl">
                    📵
                  </div>

                  <h2 className="mt-5 text-2xl font-bold text-[#0B1026]">
                    {audioPhase ===
                    "FAILED"
                      ? "Call could not connect"
                      : "Call ended"}
                  </h2>

                  <p className="mt-2 text-gray-600">
                    {audioError ||
                      "Your audio consultation has finished."}
                  </p>

                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        tokenRequestedRef.current =
                          "";

                        setAudioError(
                          "",
                        );

                        if (
                          activeAudioCallId
                        ) {
                          void loadAgoraCredentials(
                            activeAudioCallId,
                          );
                        }
                      }}
                      className="rounded-xl bg-[#0B1026] px-6 py-3 font-semibold text-white"
                    >
                      Retry Connection
                    </button>

                    <Link
                      href="/astrologers"
                      className="rounded-xl border border-[#D4AF37] px-6 py-3 font-semibold text-[#0B1026]"
                    >
                      Find Astrologers
                    </Link>
                  </div>
                </div>
              )}
            </section>
          )}

        {error && (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            <h2 className="font-bold">
              Unable to load consultations
            </h2>

            <p className="mt-1 text-sm">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                void loadConsultations()
              }
              className="mt-4 rounded-xl border border-red-300 px-5 py-2 font-semibold"
            >
              Try Again
            </button>
          </div>
        )}

        <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl bg-white p-6 shadow-lg">
            <p className="text-sm font-medium text-gray-500">
              Total Consultations
            </p>

            <p className="mt-2 text-3xl font-bold text-[#0B1026]">
              {consultations.length}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-lg">
            <p className="text-sm font-medium text-gray-500">
              Active
            </p>

            <p className="mt-2 text-3xl font-bold text-green-600">
              {activeCount}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-lg">
            <p className="text-sm font-medium text-gray-500">
              Completed
            </p>

            <p className="mt-2 text-3xl font-bold text-[#0B1026]">
              {completedCount}
            </p>
          </div>

          <div className="rounded-3xl bg-[#0B1026] p-6 text-white shadow-lg">
            <p className="text-sm font-medium text-gray-300">
              Total Spent
            </p>

            <p className="mt-2 text-3xl font-bold text-[#D4AF37]">
              ₹
              {totalSpent.toFixed(
                2,
              )}
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-3xl bg-white p-6 shadow-lg sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#0B1026]">
                Consultation records
              </h2>

              <p className="mt-1 text-gray-600">
                Continue an active
                consultation or review
                completed records.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
                  [
                    "active",
                    "Active",
                  ],
                  [
                    "completed",
                    "Completed",
                  ],
                ] as const
              ).map(
                ([
                  value,
                  label,
                ]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setFilter(
                        value,
                      )
                    }
                    className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                      filter ===
                      value
                        ? "bg-[#0B1026] text-white"
                        : "bg-[#FAF7F0] text-[#0B1026] hover:bg-[#D4AF37]/20"
                    }`}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
          </div>

          {loading ? (
            <div className="mt-8 space-y-5">
              {Array.from({
                length: 3,
              }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="animate-pulse rounded-2xl border border-gray-200 p-6"
                  >
                    <div className="h-6 w-48 rounded bg-gray-200" />
                    <div className="mt-4 h-4 w-72 rounded bg-gray-200" />

                    <div className="mt-6 grid gap-4 sm:grid-cols-3">
                      {Array.from({
                        length: 3,
                      }).map(
                        (
                          _,
                          itemIndex,
                        ) => (
                          <div
                            key={
                              itemIndex
                            }
                            className="h-20 rounded-xl bg-gray-200"
                          />
                        ),
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          ) : filteredConsultations.length ===
            0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-[#FAF7F0] p-10 text-center">
              <h3 className="text-xl font-bold text-[#0B1026]">
                No consultations found
              </h3>

              <p className="mt-2 text-gray-600">
                Your active and completed
                consultations will appear
                here.
              </p>

              <Link
                href="/astrologers"
                className="mt-6 inline-flex rounded-xl bg-[#D4AF37] px-6 py-3 font-semibold text-[#0B1026]"
              >
                Browse Astrologers
              </Link>
            </div>
          ) : (
            <div className="mt-8 space-y-5">
              {filteredConsultations.map(
                (
                  consultation,
                ) => {
                  const active =
                    isActiveConsultation(
                      consultation,
                    );

                  const duration =
                    getDurationSeconds(
                      consultation,
                    );

                  const statusLabel =
                    getStatusLabel(
                      consultation,
                    );

                  const storedCall =
                    activeStoredCall;

                  const storedCallId =
                    storedCall?.callId ||
                    storedCall?.id;

                  const mode:
                    ConsultationMode =
                    storedCallId ===
                      consultation.id &&
                    storedCall?.mode
                      ? storedCall.mode
                      : "chat";

                  return (
                    <article
                      key={
                        consultation.id
                      }
                      className="rounded-2xl border border-gray-200 p-6 transition hover:border-[#D4AF37] hover:shadow-md"
                    >
                      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-bold text-[#0B1026]">
                              {consultation.astrologer?.userProfile?.fullName ||
                                 "Astro Soul Path Astrologer"}
                            </h3>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                active
                                  ? "bg-green-100 text-green-700"
                                  : consultation.status ===
                                      "EXPIRED"
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {
                                statusLabel
                              }
                            </span>

                            <span className="rounded-full bg-[#D4AF37]/15 px-3 py-1 text-xs font-bold text-[#0B1026]">
                              {mode ===
                              "audio"
                                ? "Audio Consultation"
                                : "Chat Consultation"}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-gray-500">
                            Started:{" "}
                            {formatDate(
                              consultation.startedAt,
                            )}
                          </p>

                          {consultation.endedAt && (
                            <p className="mt-1 text-sm text-gray-500">
                              Ended:{" "}
                              {formatDate(
                                consultation.endedAt,
                              )}
                            </p>
                          )}

                          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-xl bg-[#FAF7F0] p-4">
                              <p className="text-xs font-medium text-gray-500">
                                Price
                              </p>

                              <p className="mt-1 font-bold text-[#0B1026]">
                                ₹
                                {getSafeNumber(
                                  consultation.purchasedMinutes +
                                  consultation.extendedMinutes,
                                )}{" "}
                                minutes
                              </p>
                            </div>

                            <div className="rounded-xl bg-[#FAF7F0] p-4">
                              <p className="text-xs font-medium text-gray-500">
                                Purchased
                              </p>

                              <p className="mt-1 font-bold text-[#0B1026]">
                                {getSafeNumber(
                                  consultation.purchasedMinutes +
                                  consultation.extendedMinutes
                                )}{" "}
                                minutes
                              </p>
                            </div>

                            <div className="rounded-xl bg-[#FAF7F0] p-4">
                              <p className="text-xs font-medium text-gray-500">
                                Duration
                              </p>

                              <p className="mt-1 font-bold text-[#0B1026]">
                                {active
                                  ? "In progress"
                                  : formatDuration(
                                      duration,
                                    )}
                              </p>
                            </div>

                            <div className="rounded-xl bg-[#FAF7F0] p-4">
                              <p className="text-xs font-medium text-gray-500">
                                Charged
                              </p>

                              <p className="mt-1 font-bold text-[#D4AF37]">
                                ₹
                                {getSafeNumber(
                                  consultation.amountCharged,
                                ).toFixed(
                                  2,
                                )}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {active ? (
                            <Link
                              href={
                                mode ===
                                "audio"
                                  ? `/consultations?callId=${encodeURIComponent(
                                      consultation.id,
                                    )}&mode=audio`
                                  : `/chat/${encodeURIComponent(
                                      consultation.id,
                                    )}`
                              }
                              className="inline-flex w-full justify-center rounded-xl bg-[#D4AF37] px-6 py-3 font-semibold text-[#0B1026] transition hover:bg-[#C9A52F]"
                            >
                              {mode ===
                              "audio"
                                ? "Open Audio Call"
                                : "Continue Chat"}
                            </Link>
                          ) : (
                            <Link
                              href="/astrologers"
                              className="inline-flex w-full justify-center rounded-xl border border-[#D4AF37] px-6 py-3 font-semibold text-[#0B1026] transition hover:bg-[#D4AF37]/10"
                            >
                              Book Again
                            </Link>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 border-t pt-4 text-xs text-gray-500">
                        Consultation ID:{" "}
                        {consultation.id}
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ConsultationsFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF7F0] px-4">
      <div className="rounded-3xl bg-white px-10 py-8 text-center shadow-lg">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-[#D4AF37]" />
        <p className="mt-5 font-semibold text-[#0B1026]">
          Loading consultations...
        </p>
      </div>
    </main>
  );
}

export default function ConsultationsPage() {
  return (
    <Suspense fallback={<ConsultationsFallback />}>
      <ConsultationsContent />
    </Suspense>
  );
}