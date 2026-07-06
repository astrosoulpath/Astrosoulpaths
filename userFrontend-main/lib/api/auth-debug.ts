type GenericSessionShape = {
  accessToken?: string | null;
  refreshToken?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  expiresAt?: number | null;
  expires_at?: number | null;
  tokenType?: string | null;
  token_type?: string | null;
};

type JwtPayload = {
  sub?: string;
  aud?: string | string[];
  iss?: string;
  exp?: number;
  role?: string;
  email?: string;
  phone?: string;
  session_id?: string;
  [key: string]: unknown;
};

function decodeJwtSegment(segment?: string) {
  if (!segment || typeof globalThis.atob !== "function") {
    return null;
  }

  try {
    const normalizedSegment = segment.replace(/-/g, "+").replace(/_/g, "/");
    const paddedSegment = normalizedSegment.padEnd(
      Math.ceil(normalizedSegment.length / 4) * 4,
      "=",
    );

    return JSON.parse(globalThis.atob(paddedSegment)) as JwtPayload;
  } catch {
    return null;
  }
}

export function maskToken(token: string | null | undefined) {
  if (typeof token !== "string") {
    return null;
  }

  const trimmedToken = token.trim();

  if (!trimmedToken) {
    return null;
  }

  if (trimmedToken.length <= 16) {
    return trimmedToken;
  }

  return `${trimmedToken.slice(0, 10)}...${trimmedToken.slice(-6)}`;
}

export function inspectToken(token: string | null | undefined) {
  const isString = typeof token === "string";
  const trimmedToken = isString ? token.trim() : "";
  const segments = trimmedToken ? trimmedToken.split(".") : [];
  const payload = decodeJwtSegment(segments[1]);

  return {
    exists: Boolean(trimmedToken),
    isString,
    length: trimmedToken.length,
    startsWithEyJ: trimmedToken.startsWith("eyJ"),
    segmentCount: segments.length,
    masked: maskToken(trimmedToken),
    payload: payload
      ? {
          sub: payload.sub,
          aud: payload.aud,
          iss: payload.iss,
          exp: payload.exp,
          role: payload.role,
          email: payload.email,
          phone: payload.phone,
          session_id: payload.session_id,
        }
      : null,
  };
}

export function inspectSessionTokens(session: GenericSessionShape | null | undefined) {
  if (!session) {
    return {
      exists: false,
      accessToken: inspectToken(null),
      refreshToken: inspectToken(null),
      expiresAt: null,
      tokenType: null,
    };
  }

  return {
    exists: true,
    accessToken: inspectToken(session.accessToken ?? session.access_token),
    refreshToken: inspectToken(session.refreshToken ?? session.refresh_token),
    expiresAt: session.expiresAt ?? session.expires_at ?? null,
    tokenType: session.tokenType ?? session.token_type ?? null,
  };
}

export function debugSessionSnapshot(
  label: string,
  session: GenericSessionShape | null | undefined,
  extra?: Record<string, unknown>,
) {
  if (!__DEV__) {
    return;
  }

  console.log(label, {
    ...extra,
    session: inspectSessionTokens(session),
  });
}

export function debugAuthorizationHeader(
  label: string,
  token: string | null | undefined,
  extra?: Record<string, unknown>,
) {
  if (!__DEV__) {
    return;
  }

  const trimmedToken = typeof token === "string" ? token.trim() : "";
  const headerValue = trimmedToken ? `Bearer ${trimmedToken}` : null;

  console.log(label, {
    ...extra,
    headerExists: Boolean(headerValue),
    headerFormatValid: Boolean(trimmedToken) && headerValue === `Bearer ${trimmedToken}`,
    bearerPrefixPresent: Boolean(headerValue?.startsWith("Bearer ")),
    headerPreview: headerValue ? `Bearer ${maskToken(trimmedToken)}` : null,
    token: inspectToken(trimmedToken),
  });
}