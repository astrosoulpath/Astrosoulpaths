import type { AuthNextStep } from "@/features/auth/api/auth.types";

export const appRoutes = {
  root: "/",
  home: "/home",
  kundli: "/kundli",
  insights: "/insights",
  remedies: "/remedies",
  profile: "/profile",
  otpLogin: "/(auth)/otp-login",
  onboarding: "/(auth)/onboarding",
  comingSoon: "/coming-soon",
  recharge: "/recharge",
  devNav: "/dev-nav",
} as const;

export function resolveAuthenticatedRoute(
  nextStep: AuthNextStep | string | null | undefined,
  isProfileComplete: boolean | undefined,
) {
  if (nextStep === "COMPLETE_PROFILE") {
    return appRoutes.onboarding;
  }

  if (nextStep === "OPEN_HOME") {
    return appRoutes.home;
  }

  if (isProfileComplete === true) {
    return appRoutes.home;
  }

  if (isProfileComplete === false) {
    return appRoutes.onboarding;
  }

  return null;
}
