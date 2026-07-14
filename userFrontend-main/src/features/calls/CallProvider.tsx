'use client';

import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  acceptCall as acceptSocketCall,
  cancelCall as cancelSocketCall,
  connectCallSocket,
  disconnectCallSocket,
  getCallSocket,
  initiateCall as initiateSocketCall,
  rejectCall as rejectSocketCall,
  type CallAcceptedPayload,
  type CallCancelledPayload,
  type CallErrorPayload,
  type CallMissedPayload,
  type CallRejectedPayload,
  type CallRingingPayload,
  type CallUnavailablePayload,
  type ConsultationType,
  type IncomingCallPayload,
} from '@/lib/socket';

type ActiveCall = {
  callId: string;
  callerUserId: string;
  recipientUserId: string;
  consultationType: ConsultationType;
  status:
    | 'RINGING'
    | 'ACCEPTED'
    | 'REJECTED'
    | 'CANCELLED'
    | 'MISSED'
    | 'UNAVAILABLE';
};

type StartOutgoingCallInput = {
  callId: string;
  recipientUserId: string;
  callerName?: string;
  consultationType?: ConsultationType;
};

type CallContextValue = {
  isSocketConnected: boolean;
  incomingCall: IncomingCallPayload | null;
  outgoingCall: CallRingingPayload | null;
  activeCall: ActiveCall | null;
  callError: string | null;

  startOutgoingCall: (
    input: StartOutgoingCallInput,
  ) => Promise<void>;

  acceptIncomingCall: () => Promise<void>;
  rejectIncomingCall: (
    reason?: string,
  ) => Promise<void>;
  cancelOutgoingCall: (
    reason?: string,
  ) => Promise<void>;

  clearCallError: () => void;
  clearCallState: () => void;
};

type CallProviderProps = PropsWithChildren<{
  userId?: string | null;
}>;

const CallContext =
  createContext<CallContextValue | null>(
    null,
  );

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong while processing the call.';
}

export function CallProvider({
  children,
  userId,
}: CallProviderProps) {
  const normalizedUserId =
    userId?.trim() || null;

  const [
    isSocketConnected,
    setIsSocketConnected,
  ] = useState(false);

  const [
    incomingCall,
    setIncomingCall,
  ] =
    useState<IncomingCallPayload | null>(
      null,
    );

  const [
    outgoingCall,
    setOutgoingCall,
  ] =
    useState<CallRingingPayload | null>(
      null,
    );

  const [
    activeCall,
    setActiveCall,
  ] =
    useState<ActiveCall | null>(null);

  const [
    callError,
    setCallError,
  ] = useState<string | null>(null);

  const clearCallError =
    useCallback(() => {
      setCallError(null);
    }, []);

  const clearCallState =
    useCallback(() => {
      setIncomingCall(null);
      setOutgoingCall(null);
      setActiveCall(null);
      setCallError(null);
    }, []);

  useEffect(() => {
    if (!normalizedUserId) {
      disconnectCallSocket();
      setIsSocketConnected(false);
      clearCallState();

      return;
    }

    const socket =
      connectCallSocket(
        normalizedUserId,
      );

    const handleConnect = () => {
      setIsSocketConnected(true);
      setCallError(null);
    };

    const handleDisconnect = () => {
      setIsSocketConnected(false);
    };

    const handleConnectError = (
      error: Error,
    ) => {
      setIsSocketConnected(false);

      setCallError(
        error.message ||
          'Unable to connect to the call server.',
      );
    };

    const handleIncomingCall = (
      payload: IncomingCallPayload,
    ) => {
      setIncomingCall(payload);

      setActiveCall({
        callId: payload.callId,
        callerUserId:
          payload.callerUserId,
        recipientUserId:
          payload.recipientUserId,
        consultationType:
          payload.consultationType,
        status: 'RINGING',
      });

      setCallError(null);
    };

    const handleRinging = (
      payload: CallRingingPayload,
    ) => {
      setOutgoingCall(payload);

      setActiveCall({
        callId: payload.callId,
        callerUserId:
          payload.callerUserId,
        recipientUserId:
          payload.recipientUserId,
        consultationType:
          payload.consultationType,
        status: 'RINGING',
      });

      setCallError(null);
    };

    const handleAccepted = (
      payload: CallAcceptedPayload,
    ) => {
      setIncomingCall(null);
      setOutgoingCall(null);

      setActiveCall({
        callId: payload.callId,
        callerUserId:
          payload.callerUserId,
        recipientUserId:
          payload.recipientUserId,
        consultationType:
          payload.consultationType,
        status: 'ACCEPTED',
      });

      setCallError(null);
    };

    const handleRejected = (
      payload: CallRejectedPayload,
    ) => {
      setIncomingCall(null);
      setOutgoingCall(null);

      setActiveCall({
        callId: payload.callId,
        callerUserId:
          payload.callerUserId,
        recipientUserId:
          payload.recipientUserId,
        consultationType:
          payload.consultationType,
        status: 'REJECTED',
      });
    };

    const handleCancelled = (
      payload: CallCancelledPayload,
    ) => {
      setIncomingCall(null);
      setOutgoingCall(null);

      setActiveCall({
        callId: payload.callId,
        callerUserId:
          payload.callerUserId,
        recipientUserId:
          payload.recipientUserId,
        consultationType:
          payload.consultationType,
        status: 'CANCELLED',
      });
    };

    const handleMissed = (
      payload: CallMissedPayload,
    ) => {
      setIncomingCall(null);
      setOutgoingCall(null);

      setActiveCall({
        callId: payload.callId,
        callerUserId:
          payload.callerUserId,
        recipientUserId:
          payload.recipientUserId,
        consultationType:
          payload.consultationType,
        status: 'MISSED',
      });
    };

    const handleUnavailable = (
      payload: CallUnavailablePayload,
    ) => {
      setIncomingCall(null);
      setOutgoingCall(null);

      setActiveCall({
        callId: payload.callId,
        callerUserId:
          payload.callerUserId,
        recipientUserId:
          payload.recipientUserId,
        consultationType:
          payload.consultationType,
        status: 'UNAVAILABLE',
      });

      setCallError(payload.reason);
    };

    const handleCallError = (
      payload: CallErrorPayload,
    ) => {
      setCallError(payload.message);
    };

    socket.on(
      'connect',
      handleConnect,
    );

    socket.on(
      'disconnect',
      handleDisconnect,
    );

    socket.on(
      'connect_error',
      handleConnectError,
    );

    socket.on(
      'call:incoming',
      handleIncomingCall,
    );

    socket.on(
      'call:ringing',
      handleRinging,
    );

    socket.on(
      'call:accepted',
      handleAccepted,
    );

    socket.on(
      'call:rejected',
      handleRejected,
    );

    socket.on(
      'call:cancelled',
      handleCancelled,
    );

    socket.on(
      'call:missed',
      handleMissed,
    );

    socket.on(
      'call:unavailable',
      handleUnavailable,
    );

    socket.on(
      'call:error',
      handleCallError,
    );

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off(
        'connect',
        handleConnect,
      );

      socket.off(
        'disconnect',
        handleDisconnect,
      );

      socket.off(
        'connect_error',
        handleConnectError,
      );

      socket.off(
        'call:incoming',
        handleIncomingCall,
      );

      socket.off(
        'call:ringing',
        handleRinging,
      );

      socket.off(
        'call:accepted',
        handleAccepted,
      );

      socket.off(
        'call:rejected',
        handleRejected,
      );

      socket.off(
        'call:cancelled',
        handleCancelled,
      );

      socket.off(
        'call:missed',
        handleMissed,
      );

      socket.off(
        'call:unavailable',
        handleUnavailable,
      );

      socket.off(
        'call:error',
        handleCallError,
      );
    };
  }, [
    normalizedUserId,
    clearCallState,
  ]);

  const startOutgoingCall =
    useCallback(
      async (
        input: StartOutgoingCallInput,
      ) => {
        if (!normalizedUserId) {
          setCallError(
            'Please log in before starting a call.',
          );

          return;
        }

        const socket =
          getCallSocket();

        if (!socket.connected) {
          setCallError(
            'Call server is not connected.',
          );

          return;
        }

        setCallError(null);

        try {
          const response =
            await initiateSocketCall({
              callId:
                input.callId,
              recipientUserId:
                input.recipientUserId,
              callerId:
                normalizedUserId,
              callerName:
                input.callerName,
              consultationType:
                input.consultationType ??
                'AUDIO',
            });

          if (!response.success) {
            setCallError(
              response.message ??
                response.reason ??
                'Unable to start the call.',
            );

            return;
          }

          if (
            response.status ===
            'RINGING'
          ) {
            setOutgoingCall(response);

            setActiveCall({
              callId:
                response.callId,
              callerUserId:
                response.callerUserId,
              recipientUserId:
                response.recipientUserId,
              consultationType:
                response.consultationType,
              status:
                'RINGING',
            });
          }
        } catch (error) {
          setCallError(
            getErrorMessage(error),
          );
        }
      },
      [normalizedUserId],
    );

  const acceptIncomingCall =
    useCallback(async () => {
      if (
        !normalizedUserId ||
        !incomingCall
      ) {
        return;
      }

      try {
        const response =
          await acceptSocketCall({
            callId:
              incomingCall.callId,
            callerUserId:
              incomingCall
                .callerUserId,
            receiverUserId:
              normalizedUserId,
          });

        if (!response.success) {
          setCallError(
            response.message,
          );

          return;
        }

        setIncomingCall(null);

        setActiveCall({
          callId:
            response.callId,
          callerUserId:
            response.callerUserId,
          recipientUserId:
            response.recipientUserId,
          consultationType:
            response.consultationType,
          status:
            'ACCEPTED',
        });
      } catch (error) {
        setCallError(
          getErrorMessage(error),
        );
      }
    }, [
      incomingCall,
      normalizedUserId,
    ]);

  const rejectIncomingCall =
    useCallback(
      async (
        reason =
          'The call was rejected.',
      ) => {
        if (
          !normalizedUserId ||
          !incomingCall
        ) {
          return;
        }

        try {
          const response =
            await rejectSocketCall({
              callId:
                incomingCall.callId,
              callerUserId:
                incomingCall
                  .callerUserId,
              receiverUserId:
                normalizedUserId,
              reason,
            });

          if (!response.success) {
            setCallError(
              response.message,
            );

            return;
          }

          setIncomingCall(null);

          setActiveCall({
            callId:
              response.callId,
            callerUserId:
              response.callerUserId,
            recipientUserId:
              response.recipientUserId,
            consultationType:
              response.consultationType,
            status:
              'REJECTED',
          });
        } catch (error) {
          setCallError(
            getErrorMessage(error),
          );
        }
      },
      [
        incomingCall,
        normalizedUserId,
      ],
    );

  const cancelOutgoingCall =
    useCallback(
      async (
        reason =
          'The caller cancelled the call.',
      ) => {
        if (
          !normalizedUserId ||
          !outgoingCall
        ) {
          return;
        }

        try {
          const response =
            await cancelSocketCall({
              callId:
                outgoingCall.callId,
              callerUserId:
                normalizedUserId,
              recipientUserId:
                outgoingCall
                  .recipientUserId,
              reason,
            });

          if (!response.success) {
            setCallError(
              response.message,
            );

            return;
          }

          setOutgoingCall(null);

          setActiveCall({
            callId:
              response.callId,
            callerUserId:
              response.callerUserId,
            recipientUserId:
              response.recipientUserId,
            consultationType:
              response.consultationType,
            status:
              'CANCELLED',
          });
        } catch (error) {
          setCallError(
            getErrorMessage(error),
          );
        }
      },
      [
        normalizedUserId,
        outgoingCall,
      ],
    );

  const value =
    useMemo<CallContextValue>(
      () => ({
        isSocketConnected,
        incomingCall,
        outgoingCall,
        activeCall,
        callError,
        startOutgoingCall,
        acceptIncomingCall,
        rejectIncomingCall,
        cancelOutgoingCall,
        clearCallError,
        clearCallState,
      }),
      [
        isSocketConnected,
        incomingCall,
        outgoingCall,
        activeCall,
        callError,
        startOutgoingCall,
        acceptIncomingCall,
        rejectIncomingCall,
        cancelOutgoingCall,
        clearCallError,
        clearCallState,
      ],
    );

  return (
    <CallContext.Provider
      value={value}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall():
  CallContextValue {
  const context =
    useContext(CallContext);

  if (!context) {
    throw new Error(
      'useCall must be used inside CallProvider.',
    );
  }

  return context;
}