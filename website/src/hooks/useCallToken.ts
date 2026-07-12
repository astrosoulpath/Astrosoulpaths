"use client";

import { useCallback, useState } from "react";

import agoraService, {
  AgoraTokenResponse,
} from "@/services/agoraService";

export function useCallToken() {
  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [tokenData, setTokenData] =
    useState<AgoraTokenResponse["data"] | null>(
      null,
    );

  const loadToken =
    useCallback(
      async (callId: string) => {
        try {
          setLoading(true);
          setError("");

          const response =
            await agoraService.getToken(
              callId,
            );

          setTokenData(response.data);

          return response.data;
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : "Unable to fetch call token.";

          setError(message);

          throw err;
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  return {
    loading,
    error,
    tokenData,
    loadToken,
  };
}