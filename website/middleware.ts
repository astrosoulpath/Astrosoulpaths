import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

export function middleware(request: NextRequest) {
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
    /*
     * Registration needs extra handling when a user
     * is already pending or approved.
     */
    if (startsWithRoute(path, "/astrologer/register")) {
      const registerCookie =
        request.cookies.get("asp_user")?.value;

      if (!registerCookie) {
        return NextResponse.next();
      }

      try {
        const decodedCookie = decodeURIComponent(
          registerCookie,
        );

        const user = JSON.parse(
          decodedCookie,
        ) as StoredUser;

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

        const status = String(
          user.astrologerStatus ?? "",
        )
          .trim()
          .toUpperCase();

        const hasAstrologerRole =
          role === "ASTROLOGER" ||
          role === "ASTROLOGER_USER" ||
          accountRole === "ASTROLOGER";

        const isPending =
          Boolean(user.isAstrologer) &&
          PENDING_STATUSES.includes(status);

        const isApproved =
          hasAstrologerRole &&
          !PENDING_STATUSES.includes(status);

        if (isPending) {
          return redirect(
            request,
            "/astrologer/pending",
          );
        }

        if (isApproved) {
          return redirect(
            request,
            "/astrologer/dashboard",
          );
        }
      } catch {
        /*
         * Invalid registration cookie should not block
         * opening the page. The page auth check will
         * handle the user session.
         */
      }
    }

    return NextResponse.next();
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

  const isAdmin =
    role === "ADMIN" ||
    accountRole === "ADMIN" ||
    portal === "ADMIN";

  const hasAstrologerRole =
    role === "ASTROLOGER" ||
    role === "ASTROLOGER_USER" ||
    accountRole === "ASTROLOGER" ||
    portal === "ASTROLOGER";

  const isAstrologerPending =
    Boolean(user.isAstrologer) &&
    PENDING_STATUSES.includes(astrologerStatus);

  /*
   * Existing approved astrologer accounts may not yet
   * contain astrologerStatus. Therefore, an astrologer
   * role is accepted unless status is explicitly pending.
   */
  const isAstrologerApproved =
    hasAstrologerRole &&
    !PENDING_STATUSES.includes(astrologerStatus);

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
    "/astrologer/:path*",
    "/dashboard/:path*",
    "/wallet/:path*",
    "/consultations/:path*",
  ],
};
