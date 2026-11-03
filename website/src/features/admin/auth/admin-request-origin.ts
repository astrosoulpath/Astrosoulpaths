/** Preserve production same-origin enforcement; support loopback dev proxies only. */
export function adminRequestOriginAllowed(input: {
  origin: string | null;
  internalOrigin: string;
  host: string | null;
  mode?: string;
}): boolean {
  if (!input.origin) return false;
  try {
    const browser = new URL(input.origin);
    const internal = new URL(input.internalOrigin);
    if (browser.username || browser.password || browser.search || browser.hash || browser.pathname !== '/') return false;
    if (browser.origin === internal.origin) return true;
    if (input.mode !== 'development') return false;
    const loopback = ['localhost', '127.0.0.1', '[::1]'];
    return browser.protocol === 'http:' && internal.protocol === 'http:' &&
      loopback.includes(browser.hostname) &&
      [...loopback, '0.0.0.0', '[::]'].includes(internal.hostname) &&
      browser.host === input.host && browser.port === internal.port;
  } catch { return false; }
}
