import {
  apiClient,
  getApiErrorMessage,
} from "@/src/lib/api-client";

import type {
  AstrologerDashboardData,
  AstrologerDashboardResponse,
  UpdateAstrologerStatusResponse,
} from "./dashboard.types";

export async function fetchAstrologerDashboard(): Promise<AstrologerDashboardData> {
  try {
    const response =
      await apiClient.get<AstrologerDashboardResponse>(
        "/astrologer/dashboard",
      );

    return response.data.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(error),
    );
  }
}

export async function updateAstrologerOnlineStatus(
  isOnline: boolean,
): Promise<boolean> {
  try {
    const response =
      await apiClient.patch<UpdateAstrologerStatusResponse>(
        "/astrologer/status",
        {
          isOnline,
        },
      );

    return (
      response.data.data?.isOnline ??
      isOnline
    );
  } catch (error) {
    throw new Error(
      getApiErrorMessage(error),
    );
  }
}