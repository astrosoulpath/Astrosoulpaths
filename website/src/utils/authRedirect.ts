import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export function redirectAfterLogin(router: AppRouterInstance, response: any) {
  const rawRole =
    response.user?.role?.name ??
    response.user?.role ??
    response.role?.name ??
    response.role;

  const role =
    typeof rawRole === "string" ? rawRole.trim().toUpperCase() : undefined;

  const portal = response.portal ?? response.user?.portal;

  /*
    CUSTOMER PORTAL PRIORITY
    Customer login must always open customer dashboard.
  */

  if (portal === "customer") {
    router.replace("/dashboard");
    return;
  }

  /*
    ADMIN PORTAL PRIORITY
  */

  if (portal === "admin") {
    router.replace("/admin");
    return;
  }

  /*
    ASTROLOGER FLOW
  */

  if (role === "ASTROLOGER") {
    const astrologer = response.astrologer ?? response.user?.astrologer ?? {};

    const nextStep =
      response.nextStep ??
      response.astrologer?.nextStep ??
      response.user?.nextStep ??
      response.astrologer?.onboardingStatus;

    /*
      1. New astrologer
      Registration not completed
    */

    if (
      nextStep === "COMPLETE_ASTROLOGER_ONBOARDING" ||
      nextStep === "NEW_ASTROLOGER"
    ) {
      router.replace("/astrologer/onboarding");
      return;
    }

    /*
      2. Registration completed
      Waiting for admin approval
    */

    if (nextStep === "WAIT_FOR_ADMIN_APPROVAL") {
      router.replace("/astrologer/pending");
      return;
    }

    /*
      3. Approved astrologer
      Open dashboard
    */

    if (nextStep === "OPEN_ASTROLOGER_DASHBOARD") {
      router.replace("/astrologer/dashboard");
      return;
    }

    /*
      Backup approval check
    */

    if (astrologer?.isApproved === true && astrologer?.isVerified === true) {
      router.replace("/astrologer/dashboard");
      return;
    }

    /*
      Default astrologer route
    */

    router.replace("/astrologer/onboarding");
    return;
  }

  /*
    CUSTOMER ROLE FLOW
  */

  if (role === "CUSTOMER" || role === "USER") {
    router.replace("/dashboard");
    return;
  }

  /*
    ADMIN ROLE FLOW
  */

  if (role === "ADMIN") {
    router.replace("/admin");
    return;
  }

  /*
    UNKNOWN USER FALLBACK
  */

  router.replace("/login");
}
