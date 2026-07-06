export type SendOtpRequest = {
  phone: string;
};

export type SendOtpResponse = {
  success: boolean;
  message: string;
};

export type VerifyOtpRequest = {
  phone: string;
  token: string;
};

export type AuthNextStep = "COMPLETE_PROFILE" | "OPEN_HOME";

export type AuthUser = {
  id: string;
  supabaseId?: string;
  phone: string;
  role: string;
  isNewUser?: boolean;
  isProfileComplete?: boolean;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number;
  tokenType: string;
};

export type VerifyOtpSuccessResponse = {
  success: true;
  message: string;
  user: AuthUser;
  session: AuthSession;
  nextStep?: AuthNextStep;
};

export type GetProfileResponse = {
  success: boolean;
  message?: string;
  user: AuthUser;
  nextStep?: AuthNextStep;
};

export type VerifyOtpFailureResponse = {
  success: false;
  message: string;
  code?: string;
};

export type VerifyOtpResponse =
  | VerifyOtpSuccessResponse
  | VerifyOtpFailureResponse;
