import { useCallback, useEffect, useState } from "react";

import {
  fetchAstrologerDashboard,
  updateAstrologerOnlineStatus,
} from "./dashboard.api";
import type { AstrologerDashboardData } from "./dashboard.types";

type DashboardState = {
  data: AstrologerDashboardData | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isUpdatingStatus: boolean;
};

export function useDashboard() {
  const [state, setState] = useState<DashboardState>({
    data: null,
    error: null,
    isLoading: true,
    isRefreshing: false,
    isUpdatingStatus: false,
  });

  const loadDashboard = useCallback(async (refresh = false) => {
    setState((current) => ({
      ...current,
      error: null,
      isLoading: refresh ? current.isLoading : true,
      isRefreshing: refresh,
    }));

    try {
      const data = await fetchAstrologerDashboard();

      setState((current) => ({
        ...current,
        data,
        error: null,
        isLoading: false,
        isRefreshing: false,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load dashboard.",
        isLoading: false,
        isRefreshing: false,
      }));
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const refreshDashboard = useCallback(() => {
    return loadDashboard(true);
  }, [loadDashboard]);

  const toggleOnlineStatus = useCallback(async () => {
    const currentData = state.data;

    if (!currentData || state.isUpdatingStatus) {
      return;
    }

    const nextStatus = !currentData.isOnline;

    setState((current) => ({
      ...current,
      error: null,
      isUpdatingStatus: true,
    }));

    try {
      const isOnline =
        await updateAstrologerOnlineStatus(nextStatus);

      setState((current) => ({
        ...current,
        data: current.data
          ? {
              ...current.data,
              isOnline,
            }
          : current.data,
        isUpdatingStatus: false,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update online status.",
        isUpdatingStatus: false,
      }));
    }
  }, [state.data, state.isUpdatingStatus]);

  return {
    ...state,
    refreshDashboard,
    toggleOnlineStatus,
  };
}