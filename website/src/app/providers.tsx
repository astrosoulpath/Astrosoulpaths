"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {callRouteAllowed,callSessionEligible} from '@/features/auth/call-session-policy';
import {sessionCandidate,verifyNavigationSession} from '@/features/auth/public-auth';
import {disconnectChatSocket} from '@/lib/chatSocket';
import IncomingCallModal from "@/components/call/IncomingCallModal";
import { supabase } from "@/lib/supabase";
import {
  acceptCall,
  connectCallSocket,
  disconnectCallSocket,
  getCallSocket,
  isCallSocketConnected,
  onCallConnectionState,
  onCallAccepted,
  onCallCancelled,
  onCallError,
  onCallMissed,
  onCallRejected,
  onIncomingCall,
  rejectCall,
  type CallAcceptedPayload,
  type CallErrorPayload,
  type IncomingCallPayload,
} from "@/services/callSocket";

type AppContextType = {
  userId: string | null;
  socketConnected: boolean;
  incomingCall: IncomingCallPayload | null;
  callError: string | null;
  clearCallError: () => void;
};

const AppContext =
  createContext<AppContextType | null>(
    null,
  );

type AppProvidersProps = {
  children: ReactNode;
};

function getStoredAccessToken():string|null{return typeof window==='undefined'?null:sessionCandidate(window.location.pathname)?.token??null;}

export function AppProviders({
  children,
}: AppProvidersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const routeContext = !callRouteAllowed(pathname)?"public-auth":pathname.startsWith("/astrologer/")?"astrologer":"customer";

  const [userId, setUserId] =
    useState<string | null>(null);

  const [
    socketConnected,
    setSocketConnected,
  ] = useState(false);

  const [
    incomingCall,
    setIncomingCall,
  ] =
    useState<IncomingCallPayload | null>(
      null,
    );

  const [
    processingIncomingCall,
    setProcessingIncomingCall,
  ] = useState(false);

  const [callError, setCallError] =
    useState<string | null>(null);

  const mountedRef =
    useRef(true);

  const currentUserIdRef =
    useRef<string | null>(null);

  const socketCleanupRef =
    useRef<(() => void) | null>(
      null,
    );

  const retryRef=useRef<()=>void>(()=>{});
  const listenerCleanupRef =
    useRef<(() => void)[]>([]);

  const clearCallError =
    useCallback(() => {
      setCallError(null);
    }, []);

  const clearSocketListeners =
    useCallback(() => {
      for (
        const cleanup of
        listenerCleanupRef.current
      ) {
        cleanup();
      }

      listenerCleanupRef.current =
        [];
    }, []);

  const clearSocketConnectionHandlers =
    useCallback(() => {
      socketCleanupRef.current?.();
      socketCleanupRef.current =
        null;
    }, []);

  const handleAcceptedCall =
    useCallback(
      (
        payload: CallAcceptedPayload,
      ) => {
        if (!mountedRef.current) {
          return;
        }

        setIncomingCall(null);
        setProcessingIncomingCall(
          false,
        );
        setCallError(null);

        if (
          typeof window !==
          "undefined"
        ) {
          const storedCall =
            window.localStorage.getItem(
              "asp_active_call",
            );

          let activeCall:
            | Record<
                string,
                unknown
              >
            | null = null;

          if (storedCall) {
            try {
              activeCall =
                JSON.parse(
                  storedCall,
                ) as Record<
                  string,
                  unknown
                >;
            } catch {
              activeCall = null;
            }
          }

          window.localStorage.setItem(
            "asp_active_call",
            JSON.stringify({
              ...(activeCall ?? {}),
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
                payload.consultationType ===
                "VIDEO"
                  ? "video"
                  : "audio",
              status:
                payload.status,
              acceptedAt:
                payload.acceptedAt,
            }),
          );
        }

        window.dispatchEvent(new Event('asp-consultation-changed'));
        if(sessionCandidate(window.location.pathname)?.portal==='astrologer'&&payload.consultationType==='AUDIO'){router.push('/chat/'+encodeURIComponent(payload.callId)+'?mode=audio');return;}
        router.push(
          `/consultations?callId=${encodeURIComponent(
            payload.callId,
          )}&mode=${payload.consultationType.toLowerCase()}`,
        );
      },
      [router],
    );

  const attachCallListeners =
    useCallback(() => {
      clearSocketListeners();

      const cleanups: Array<
        () => void
      > = [];

      cleanups.push(
        onIncomingCall(
          (payload) => {
            if (
              !mountedRef.current
            ) {
              return;
            }

            setIncomingCall(
              payload,
            );

            setCallError(null);
          },
        ),
      );

      cleanups.push(
        onCallAccepted(
          handleAcceptedCall,
        ),
      );

      cleanups.push(
        onCallRejected(
          (payload) => {
            if (
              !mountedRef.current
            ) {
              return;
            }

            setIncomingCall(
              null,
            );

            setProcessingIncomingCall(
              false,
            );

            setCallError(
              payload.reason ||
                "The call was rejected.",
            );
          },
        ),
      );

      cleanups.push(
        onCallCancelled(
          (payload) => {
            if (
              !mountedRef.current
            ) {
              return;
            }

            setIncomingCall(
              null,
            );

            setProcessingIncomingCall(
              false,
            );

            setCallError(
              payload.reason ||
                "The caller cancelled the call.",
            );
          },
        ),
      );

      cleanups.push(
        onCallMissed(
          (payload) => {
            if (
              !mountedRef.current
            ) {
              return;
            }

            setIncomingCall(
              null,
            );

            setProcessingIncomingCall(
              false,
            );

            setCallError(
              payload.reason ||
                "The call was missed.",
            );
          },
        ),
      );

      cleanups.push(
        onCallError(
          (
            payload:
              CallErrorPayload,
          ) => {
            if (
              !mountedRef.current
            ) {
              return;
            }

            setProcessingIncomingCall(
              false,
            );

            setCallError(
              payload.message,
            );
          },
        ),
      );

      listenerCleanupRef.current =
        cleanups;
    }, [
      clearSocketListeners,
      handleAcceptedCall,
    ]);

  const connectForUser =
    useCallback(
      (
        authenticatedUserId:
          string,
      ) => {
        const normalizedUserId =
          authenticatedUserId.trim();

        if (!normalizedUserId) {
          return;
        }

        currentUserIdRef.current =
          normalizedUserId;

        clearSocketConnectionHandlers();
        clearSocketListeners();

        const socket =
          connectCallSocket(
            normalizedUserId,
          );

        const handleConnect =
          () => {
            if (
              !mountedRef.current
            ) {
              return;
            }

            setSocketConnected(isCallSocketConnected());

            setCallError(null);
          };

        const handleDisconnect =
          () => {
            if (
              !mountedRef.current
            ) {
              return;
            }

            setSocketConnected(
              false,
            );
          };

        const handleConnectError =
          (error: Error) => {
            if (
              !mountedRef.current
            ) {
              return;
            }

            setSocketConnected(
              false,
            );

            setCallError(
              error.message ||
                "Unable to connect to the call server.",
            );
          };

        socket.on(
          "call:registered",
          handleConnect,
        );

        socket.on(
          "disconnect",
          handleDisconnect,
        );

        socket.on(
          "connect_error",
          handleConnectError,
        );

        const statusCleanup=typeof onCallConnectionState==='function'?onCallConnectionState(state=>{if(!mountedRef.current)return;setSocketConnected(state==='ready');if(state==='ready'||state==='idle')setCallError(null);else if(state==='unavailable')setCallError('The call server is unavailable after bounded retries. Your account remains signed in.');else if(state==='unauthorized')setCallError('Call access needs authorized session recovery. Reverify your account.');}):()=>{};
        socketCleanupRef.current =
          () => {
            statusCleanup();
            socket.off(
              "call:registered",
              handleConnect,
            );

            socket.off(
              "disconnect",
              handleDisconnect,
            );

            socket.off(
              "connect_error",
              handleConnectError,
            );
          };

        attachCallListeners();

        setSocketConnected(
          isCallSocketConnected(),
        );
      },
      [
        attachCallListeners,
        clearSocketConnectionHandlers,
        clearSocketListeners,
      ],
    );

  const disconnectCurrentUser =
    useCallback(() => {
      clearSocketConnectionHandlers();
      clearSocketListeners();

      disconnectCallSocket();

      currentUserIdRef.current =
        null;

      setSocketConnected(false);
      setIncomingCall(null);

      setProcessingIncomingCall(
        false,
      );
    }, [
      clearSocketConnectionHandlers,
      clearSocketListeners,
    ]);

  useEffect(() => {
    mountedRef.current = true;
    let generation = 0,
      controller: AbortController | undefined,
      boundOwner: string | null = null, pendingOwner:string|undefined;
    async function initialize() {
      if(controller&&!controller.signal.aborted&&pendingOwner===sessionCandidate(window.location.pathname)?.snapshot)return;
      const current = ++generation;
      controller?.abort();
      const abort = new AbortController();
      controller = abort;
      if(!callRouteAllowed(window.location.pathname)){boundOwner=null;disconnectCurrentUser();setUserId(null);setCallError(null);return;}
      const candidate = sessionCandidate(window.location.pathname);
      pendingOwner=candidate?.snapshot;
      if (candidate?.snapshot !== boundOwner) {
        disconnectCurrentUser();
        disconnectChatSocket();
        setUserId(null);
      }
      if (!candidate) {
        boundOwner = null;
        return;
      }
      try {
        const verified = await verifyNavigationSession(
          window.location.pathname,
          abort.signal,
        );
        if (!mountedRef.current || current !== generation || abort.signal.aborted)
          return;
        if (
          !verified ||
          (verified.portal === "astrologer" && verified.role !== "ASTROLOGER")
        ) {
          boundOwner = null;
          setUserId(null);
          disconnectCurrentUser();
          disconnectChatSocket();
          return;
        }
        if(!(await callSessionEligible(verified,window.location.pathname,abort.signal))){if(current===generation&&!abort.signal.aborted){boundOwner=null;setUserId(null);disconnectCurrentUser();setCallError(null);}return;}
        if(!mountedRef.current||current!==generation||abort.signal.aborted)return;
        boundOwner = sessionCandidate(window.location.pathname)?.snapshot??null;
        setUserId(verified.id);
        if (
          currentUserIdRef.current !== verified.id ||
          !getCallSocket()?.connected
        )
          connectForUser(verified.id);
      } catch {
        if (!mountedRef.current || current !== generation || abort.signal.aborted)
          return;
        boundOwner = null;
        setUserId(null);
        disconnectCurrentUser();
        disconnectChatSocket();
        setCallError(
          "Your communication session could not be verified. Sign in again or check your connection.",
        );
      } finally {if(current===generation)pendingOwner=undefined;}
    }
    const changed = () => {
      void initialize();
    };
    retryRef.current=()=>{disconnectCurrentUser();boundOwner=null;controller?.abort();pendingOwner=undefined;void initialize();};
    const refresh=()=>{void initialize();};
    const timer=setInterval(()=>{if(document.visibilityState==='visible')refresh();},30000);
    window.addEventListener('focus',refresh);window.addEventListener('asp-communication-changed',refresh);
    void initialize();
    window.addEventListener("asp-auth-changed", changed);
    window.addEventListener("storage", changed);
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      void initialize();
    });
    return () => {
      mountedRef.current = false;
      generation++;
      controller?.abort();
      clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('asp-communication-changed',refresh);
      authListener.subscription.unsubscribe();
      window.removeEventListener("asp-auth-changed", changed);
      window.removeEventListener("storage", changed);
      clearSocketConnectionHandlers();
      clearSocketListeners();
      disconnectCallSocket();
      disconnectChatSocket();
    };
  }, [
    clearSocketConnectionHandlers,
    clearSocketListeners,
    connectForUser,
    disconnectCurrentUser,
    routeContext,
  ]);

  const handleAcceptIncomingCall =
    useCallback(async () => {
      if (
        processingIncomingCall ||
        !incomingCall ||
        !userId
      ) {
        return;
      }

      setProcessingIncomingCall(
        true,
      );

      setCallError(null);

      const emitted =
        acceptCall({
          callId:
            incomingCall.callId,

          callerUserId:
            incomingCall.callerUserId ??
            incomingCall.callerId,

          receiverUserId:
            userId,
        });

      if (!emitted) {
        setProcessingIncomingCall(
          false,
        );

        setCallError(
          "Call server is not connected. Please try again.",
        );

        return;
      }

      /*
       * UI actual call:accepted event par
       * consultations page par redirect hogi.
       */
      window.setTimeout(() => {
        if (
          !mountedRef.current
        ) {
          return;
        }

        setProcessingIncomingCall(
          false,
        );
      }, 10_000);
    }, [
      incomingCall,
      processingIncomingCall,
      userId,
    ]);

  const handleRejectIncomingCall =
    useCallback(async () => {
      if (
        processingIncomingCall ||
        !incomingCall ||
        !userId
      ) {
        return;
      }

      setProcessingIncomingCall(
        true,
      );

      setCallError(null);

      const emitted =
        rejectCall({
          callId:
            incomingCall.callId,

          callerUserId:
            incomingCall.callerUserId ??
            incomingCall.callerId,

          receiverUserId:
            userId,

          reason:
            "The call was rejected.",
        });

      if (!emitted) {
        setProcessingIncomingCall(
          false,
        );

        setCallError(
          "Call server is not connected. Please try again.",
        );

        return;
      }

      /*
       * Modal turant close kar dete hain.
       * Backend both participants ko
       * call:rejected event bhejega.
       */
      setIncomingCall(null);

      setProcessingIncomingCall(
        false,
      );
    }, [
      incomingCall,
      processingIncomingCall,
      userId,
    ]);

  const value =
    useMemo<AppContextType>(
      () => ({
        userId,
        socketConnected,
        incomingCall,
        callError,
        clearCallError,
      }),
      [
        userId,
        socketConnected,
        incomingCall,
        callError,
        clearCallError,
      ],
    );

  const accessToken =
    getStoredAccessToken();

  return (
    <AppContext.Provider
      value={value}
    >
      {children}

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
          processingIncomingCall
        }
        onAccept={
          handleAcceptIncomingCall
        }
        onReject={
          handleRejectIncomingCall
        }
      />

      {callError &&
        userId &&
        accessToken && (
          <div
            role="alert"
            className="fixed bottom-5 right-5 z-[10000] w-[calc(100%-2.5rem)] max-w-sm rounded-2xl border border-red-200 bg-white p-4 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                !
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[#0B1026]">
                  Call notification
                </p>

                <p className="mt-1 text-sm leading-5 text-gray-600">
                  {callError}
                </p><button type="button" className="mt-2 underline" onClick={()=>retryRef.current()}>Verify & retry call connection</button>
              </div>

              <button
                type="button"
                onClick={
                  clearCallError
                }
                className="shrink-0 rounded-lg px-2 text-xl leading-none text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close call notification"
              >
                ×
              </button>
            </div>
          </div>
        )}
    </AppContext.Provider>
  );
}

export function useAppContext():
  AppContextType {
  const context =
    useContext(AppContext);

  if (!context) {
    throw new Error(
      "useAppContext must be used inside AppProviders.",
    );
  }

  return context;
}