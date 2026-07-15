export type AuthStatus =
  | "loading"
  | "unauthenticated"
  | "authenticated";

export type AuthUser = {
  id: string;
  supabaseId: string | null;
  phone: string | null;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  role: string | null;
  isNewUser: boolean;
  isAstrologer: boolean;
  isProfileComplete: boolean;
  isActive: boolean;
  isBlocked: boolean;
  isVerified: boolean;
};

export type SendOtpPayload = {
  phone: string;
};

export type VerifyOtpPayload = {
  phone: string;
  otp: string;
};

export type SendOtpResponse = {
  success: boolean;
  message: string;
  portal?: string;
  data?: {
    phone?: string;
  };
};

export type VerifyOtpResponse = {
  success: boolean;
  message?: string;

  accessToken?: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
  nextStep?: string | null;

  portal?: string;
  role?: string;
  user?: AuthUser;

  data?: {
    accessToken?: string;
    refreshToken?: string | null;
    expiresAt?: number | null;
    nextStep?: string | null;
    user?: AuthUser;
  };
};

export type StoredAuthSession = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  nextStep: string | null;
  user: AuthUser | null;
};

export type AuthContextValue = {
  status: AuthStatus;
  session: StoredAuthSession | null;
  user: AuthUser | null;
  loading: boolean;
  authenticated: boolean;

  sendOtp: (
    payload: SendOtpPayload,
  ) => Promise<SendOtpResponse>;

  verifyOtp: (
    payload: VerifyOtpPayload,
  ) => Promise<StoredAuthSession>;

  restoreSession: () => Promise<void>;
  signOut: () => Promise<void>;
};