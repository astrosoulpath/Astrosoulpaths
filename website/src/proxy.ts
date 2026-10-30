import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE_OPTIONS, ADMIN_SESSION_COOKIE, checkAdminToken } from "./features/admin/auth/admin-contract";

type StoredUser = {
  role?: string;
  userRole?: string;
  type?: string;
  portal?: string;
  accountRole?: string;
  isAstrologer?: boolean;
  astrologerStatus?: string;
};

const PUBLIC_AUTH_ROUTES = [
  "/admin/login",
  "/admin/verify-otp",
  "/astrologer/login",
  "/astrologer/register",
  "/astrologer/signup",
  "/astrologer/onboarding",
  "/astrologer/pending",
];

const CUSTOMER_ROUTES = [
  "/dashboard",
  "/wallet",
  "/consultations",
];

const APPROVED_STATUSES = [
  "APPROVED",
  "ACTIVE",
  "VERIFIED",
];

const PENDING_STATUSES = [
  "PENDING",
  "PENDING_APPROVAL",
  "UNDER_REVIEW",
];

function startsWithRoute(path: string, route: string) {
  return path === route || path.startsWith(`${route}/`);
}

function redirect(
  request: NextRequest,
  pathname: string,
) {
  return NextResponse.redirect(
    new URL(pathname, request.url),
  );
}

export async function proxy(request: NextRequest) {
  /* CANONICAL_LOCAL_HOST_V3
   * localhost is the single local frontend origin.
   * Real production domains do not match this condition.
   */
  if (request.headers.get("host") === "127.0.0.1:3000") {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.hostname = "localhost";
    return NextResponse.redirect(canonicalUrl);
  }

  const path = request.nextUrl.pathname;
  if (startsWithRoute(path, '/admin.backup-before-token-fix')) {
    return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  if (startsWithRoute(path, '/admin/verify-otp')) return redirect(request, '/admin/login');


  /*
   * Public login and registration routes.
   *
   * Registration page itself handles customer-login
   * redirection when no customer session exists.
   */
  if (
    PUBLIC_AUTH_ROUTES.some((route) =>
      startsWithRoute(path, route),
    )
  ) {
    // Application pages obtain authority from their authenticated backend request, never this hint cookie.
    return NextResponse.next();
  }

  // Admin authority never comes from the unsigned Customer/Astrologer cookie.
  if (startsWithRoute(path, "/admin")) {
    try {
      if (await checkAdminToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value)) {
        const response = NextResponse.next();
        response.headers.set("Cache-Control", "private, no-store");
        return response;
      }
      const response = redirect(request, "/admin/login");
      response.cookies.set(ADMIN_SESSION_COOKIE, "", { ...ADMIN_COOKIE_OPTIONS, maxAge: 0 });
      return response;
    } catch {
      return new NextResponse("Admin authorization is temporarily unavailable. Please retry.", { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }

  const userCookie =
    request.cookies.get("asp_user")?.value;

  if (!userCookie) {
    if (path.startsWith("/admin")) {
      return redirect(request, "/admin/login");
    }

    if (path.startsWith("/astrologer")) {
      return redirect(
        request,
        "/astrologer/login",
      );
    }

    return redirect(request, "/login");
  }

  let user: StoredUser;

  try {
    const decodedCookie =
      decodeURIComponent(userCookie);

    user = JSON.parse(decodedCookie) as StoredUser;
  } catch {
    const responsePath = path.startsWith("/admin")
      ? "/admin/login"
      : path.startsWith("/astrologer")
        ? "/astrologer/login"
        : "/login";

    const response = redirect(
      request,
      responsePath,
    );

    response.cookies.delete("asp_user");

    return response;
  }

  const role = String(
    user.role ??
      user.userRole ??
      user.type ??
      "",
  )
    .trim()
    .toUpperCase();

  const accountRole = String(
    user.accountRole ?? "",
  )
    .trim()
    .toUpperCase();

  const portal = String(user.portal ?? "")
    .trim()
    .toUpperCase();

  const astrologerStatus = String(
    user.astrologerStatus ?? "",
  )
    .trim()
    .toUpperCase();

  // Context is a routing hint only; the Admin branch above verifies its own server cookie.
  const isAdmin = portal === "ADMIN" || (!portal && (role === "ADMIN" || accountRole === "ADMIN"));

  const hasAstrologerRole = portal !== "CUSTOMER" && (role === "ASTROLOGER" || role === "ASTROLOGER_USER" || accountRole === "ASTROLOGER" || portal === "ASTROLOGER");

  const isAstrologerPending =
    portal !== "CUSTOMER" && Boolean(user.isAstrologer) &&
    PENDING_STATUSES.includes(astrologerStatus);

  /*
   * Existing approved astrologer accounts may not yet
   * contain astrologerStatus. Therefore, an astrologer
   * role is accepted unless status is explicitly pending.
   */
  const isAstrologerApproved =
    hasAstrologerRole && role !== "ASTROLOGER_APPLICANT" &&
    (!astrologerStatus || APPROVED_STATUSES.includes(astrologerStatus));

  /*
   * Admin routes
   */
  if (path.startsWith("/admin")) {
    if (!isAdmin) {
      if (isAstrologerPending) {
        return redirect(
          request,
          "/astrologer/pending",
        );
      }

      if (isAstrologerApproved) {
        return redirect(
          request,
          "/astrologer/dashboard",
        );
      }

      return redirect(request, "/dashboard");
    }

    return NextResponse.next();
  }

  if (portal === "ASTROLOGER" && astrologerStatus === "ONBOARDING" && path.startsWith("/astrologer")) {
    return startsWithRoute(path,"/astrologer/onboarding") ? NextResponse.next() : redirect(request,"/astrologer/onboarding");
  }

  /*
   * Pending application page
   */
  if (
    startsWithRoute(
      path,
      "/astrologer/pending",
    )
  ) {
    if (isAstrologerPending) {
      return NextResponse.next();
    }

    if (isAstrologerApproved) {
      return redirect(
        request,
        "/astrologer/dashboard",
      );
    }

    return redirect(
      request,
      "/astrologer/register",
    );
  }

  /*
   * Astrologer dashboard and onboarding
   */
  if (path.startsWith("/astrologer")) {
    if (isAstrologerPending) {
      return redirect(
        request,
        "/astrologer/pending",
      );
    }

    if (!isAstrologerApproved) {
      return redirect(
        request,
        "/astrologer/register",
      );
    }

    return NextResponse.next();
  }

  /*
   * Customer routes
   */
  const isCustomerRoute =
    CUSTOMER_ROUTES.some((route) =>
      startsWithRoute(path, route),
    );

  if (isCustomerRoute) {
    if (isAstrologerPending) {
      return redirect(
        request,
        "/astrologer/pending",
      );
    }

    if (isAdmin) {
      return redirect(request, "/admin");
    }

    if (isAstrologerApproved) {
      return redirect(
        request,
        "/astrologer/dashboard",
      );
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/admin.backup-before-token-fix/:path*",
    "/astrologer/:path*",
    "/dashboard/:path*",
    "/wallet/:path*",
    "/consultations/:path*",
  ],
};
