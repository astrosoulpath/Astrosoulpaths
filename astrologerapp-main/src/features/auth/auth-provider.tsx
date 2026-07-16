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
import {
  sendOtpRequest,
  verifyOtpRequest,
} from "@/src/features/auth/auth.api";
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
  verifyOtp: (
    phone: string,
    token: string,
  ) => Promise<VerifyOtpResponse>;
};

const logger = createLogger("auth-provider");

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, "").trim();
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [nextStep, setNextStep] = useState<string | null>(null);
  const [astrologer, setAstrologer] =
    useState<AstrologerAuthDetails | null>(null);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const session = await readAuthSession();

        if (!isMounted) {
          return;
        }

        if (!session?.accessToken) {
          setAccessToken(null);
          setAstrologer(null);
          setNextStep(null);
          setStatus("unauthenticated");
          return;
        }

        setAccessToken(session.accessToken);
        setAstrologer(session.astrologer ?? null);
        setNextStep(session.nextStep ?? null);
        setStatus("authenticated");

        logger.info("Restored auth session", {
          hasAccessToken: true,
          nextStep: session.nextStep ?? null,
        });
      } catch (error) {
        logger.error("Failed to restore auth session", error);

        try {
          await clearAuthSession();
        } catch (clearError) {
          logger.error("Failed to clear invalid auth session", clearError);
        }

        if (!isMounted) {
          return;
        }

        setAccessToken(null);
        setAstrologer(null);
        setNextStep(null);
        setPendingPhone(null);
        setStatus("unauthenticated");
      }
    };

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const sendOtp = useCallback(
    async (phone: string): Promise<SendOtpResponse> => {
      const normalizedPhone = normalizePhone(phone);

      if (!normalizedPhone) {
        throw new Error("Please enter a valid phone number.");
      }

      try {
        logger.info("Sending OTP request", {
          phone: normalizedPhone,
        });

        const response = await sendOtpRequest(normalizedPhone);

        if (!response) {
          throw new Error("OTP service returned an empty response.");
        }

        if (response.success === false) {
          throw new Error(
            response.message || "Unable to send OTP. Please try again.",
          );
        }

        setPendingPhone(normalizedPhone);

        logger.info("Send OTP response received", {
          phone: normalizedPhone,
          success: response.success,
          message: response.message ?? null,
        });

        return response;
      } catch (error) {
        const message = getErrorMessage(
          error,
          "Unable to send OTP. Please try again.",
        );

        logger.error("Send OTP request failed", {
          phone: normalizedPhone,
          message,
          error,
        });

        throw new Error(message);
      }
    },
    [],
  );

  const verifyOtp = useCallback(
    async (
      phone: string,
      token: string,
    ): Promise<VerifyOtpResponse> => {
      const normalizedPhone = normalizePhone(phone);
      const normalizedToken = token.replace(/\D/g, "").trim();

      if (!normalizedPhone) {
        throw new Error("Phone number is missing. Please request OTP again.");
      }

      if (!normalizedToken) {
        throw new Error("Please enter the OTP.");
      }

      try {
        logger.info("Verifying OTP", {
          phone: normalizedPhone,
        });

        const response = await verifyOtpRequest(
          normalizedPhone,
          normalizedToken,
        );

        if (!response) {
          throw new Error("OTP verification returned an empty response.");
        }

        if (!response.accessToken) {
          throw new Error(
            response.message ||
              "OTP verification failed. Please check the OTP.",
          );
        }

        const responseAstrologer = response.astrologer ?? null;
        const responseNextStep = response.nextStep ?? null;

        await saveAuthSession({
          accessToken: response.accessToken,
          astrologer: responseAstrologer,
          nextStep: responseNextStep,
        });

        setAccessToken(response.accessToken);
        setAstrologer(responseAstrologer);
        setNextStep(responseNextStep);
        setPendingPhone(null);
        setStatus("authenticated");

        logger.info("OTP verified and session stored", {
          phone: normalizedPhone,
          hasAccessToken: true,
          nextStep: responseNextStep,
          canAccessAstrologerApp:
            responseAstrologer?.canAccessAstrologerApp ?? false,
        });

        return response;
      } catch (error) {
        const message = getErrorMessage(
          error,
          "OTP verification failed. Please try again.",
        );

        logger.error("OTP verification failed", {
          phone: normalizedPhone,
          message,
          error,
        });

        throw new Error(message);
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await clearAuthSession();
    } catch (error) {
      logger.error("Failed to clear auth session during logout", error);
    } finally {
      setAccessToken(null);
      setAstrologer(null);
      setNextStep(null);
      setPendingPhone(null);
      setStatus("unauthenticated");

      logger.info("Logged out");
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const canAccessDashboard =
      nextStep === "OPEN_ASTROLOGER_DASHBOARD" ||
      astrologer?.canAccessAstrologerApp === true;

    return {
      accessToken,
      astrologer,
      canAccessDashboard,
      isAuthenticated:
        status === "authenticated" && Boolean(accessToken),
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

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider",
    );
  }

  return context;
}