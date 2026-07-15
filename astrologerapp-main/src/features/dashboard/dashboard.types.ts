export type AstrologerDashboardData = {
  astrologerId: string;
  userId: string;
  name: string;
  avatarUrl: string | null;

  earnings: number;
  todayCalls: number;
  todayChats: number;
  rating: number;

  isOnline: boolean;
  isApproved: boolean;
  isVerified: boolean;

  profileCompletion: number;
  pendingConsultations: number;
  todaySchedule: unknown[];

  languages: string[];
  expertise: string[];

  pricePerMin: number;
  experience: number;
};

export type AstrologerDashboardResponse = {
  success: boolean;
  data: AstrologerDashboardData;
};

export type UpdateAstrologerStatusResponse = {
  success: boolean;
  message?: string;
  data?: {
    isOnline: boolean;
  };
};