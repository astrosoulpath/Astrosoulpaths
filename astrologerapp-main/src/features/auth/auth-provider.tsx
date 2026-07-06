import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  clearAuthSession,
  readAuthSession,
  saveAuthSession,
} from "@/src/features/auth/auth-storage";
import { sendOtpRequest, verifyOtpRequest } from "@/src/features/auth/auth.api";
import {
  AstrologerAuthDetails,
  AuthStatus,
  SendOtpResponse,
  VerifyOtpResponse,
} from "@/src/features/auth/auth.types";
import { createLogger } from "@/src/lib/logger";

type AuthContextValue = {
  accessToken: string | null;
  astrologer: AstrologerAuthDetails | null;
  canAccessDashboard: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  nextStep: string | null;
  pendingPhone: string | null;
  sendOtp: (phone: string) => Promise<SendOtpResponse>;
  setPendingPhone: (phone: string | null) => void;
  status: AuthStatus;
  verifyOtp: (phone: string, token: string) => Promise<VerifyOtpResponse>;
};

const logger = createLogger("auth-provider");

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [nextStep, setNextStep] = useState<string | null>(null);
  const [astrologer, setAstrologer] = useState<AstrologerAuthDetails | null>(
    null,
  );
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const session = await readAuthSession();

        if (!session?.accessToken) {
          setStatus("unauthenticated");
          return;
        }

        setAccessToken(session.accessToken);
        setAstrologer(session.astrologer);
        setNextStep(session.nextStep);
        setStatus("authenticated");
        logger.info("Restored auth session");
      } catch (error) {
        logger.error("Failed to restore auth session", error);
        setStatus("unauthenticated");
      }
    };

    void restoreSession();
  }, []);

  const sendOtp = useCallback(async (phone: string) => {
    const response = await sendOtpRequest(phone);
    setPendingPhone(phone);
    logger.info("Send OTP response received", {
      phone,
      success: response.success,
      message: response.message,
    });
    return response;
  }, []);

  const verifyOtp = useCallback(async (phone: string, token: string) => {
    const response = await verifyOtpRequest(phone, token);

    logger.info("Verify OTP response received", {
      phone,
      hasAccessToken: Boolean(response.accessToken),
      nextStep: response.nextStep ?? null,
      canAccessAstrologerApp:
        response.astrologer?.canAccessAstrologerApp ?? false,
    });

    await saveAuthSession({
      accessToken: response.accessToken,
      astrologer: response.astrologer ?? null,
      nextStep: response.nextStep ?? null,
    });

    setAccessToken(response.accessToken);
    setAstrologer(response.astrologer ?? null);
    setNextStep(response.nextStep ?? null);
    setPendingPhone(null);
    setStatus("authenticated");
    logger.info("OTP verified and session stored", {
      phone,
      hasAccessToken: Boolean(response.accessToken),
      nextStep: response.nextStep,
    });

    return response;
  }, []);

  const logout = useCallback(async () => {
    await clearAuthSession();
    setAccessToken(null);
    setAstrologer(null);
    setNextStep(null);
    setPendingPhone(null);
    setStatus("unauthenticated");
    logger.info("Logged out");
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const canAccessDashboard =
      nextStep === "OPEN_ASTROLOGER_DASHBOARD" ||
      astrologer?.canAccessAstrologerApp === true;

    return {
      accessToken,
      astrologer,
      canAccessDashboard,
      isAuthenticated: status === "authenticated" && !!accessToken,
      logout,
      nextStep,
      pendingPhone,
      sendOtp,
      setPendingPhone,
      status,
      verifyOtp,
    };
  }, [
    accessToken,
    astrologer,
    logout,
    nextStep,
    pendingPhone,
    sendOtp,
    status,
    verifyOtp,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
