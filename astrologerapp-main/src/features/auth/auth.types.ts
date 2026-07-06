export type AuthStatus = "loading" | "unauthenticated" | "authenticated";

export type AstrologerAuthDetails = {
  astrologerId?: string;
  canAccessAstrologerApp?: boolean;
  hasAstrologerProfile?: boolean;
  isApproved?: boolean;
  isAstrologer?: boolean;
  isExistingAstrologer?: boolean;
  isNewAstrologer?: boolean;
  isVerified?: boolean;
  onboardingStatus?: string;
  [key: string]: unknown;
};

export type SendOtpResponse = {
  message: string;
  portal: string;
  success: boolean;
};

export type VerifyOtpResponse = {
  accessToken: string;
  astrologer?: AstrologerAuthDetails | null;
  astrologerId: string;
  message: string;
  nextStep?: string | null;
  portal: string;
  role: string;
  success: boolean;
};

export type StoredAuthSession = {
  accessToken: string;
  astrologer: AstrologerAuthDetails | null;
  nextStep: string | null;
};
