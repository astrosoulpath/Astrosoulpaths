// Best-effort minimization; approved privacy policy remains necessary.
const credentialPattern = () =>
  /-----BEGIN[ A-Z]*PRIVATE KEY-----[\s\S]*|\bBearer\s+[A-Za-z0-9._-]{20,}|\bsk-[A-Za-z0-9_-]{20,}|postgres(?:ql)?:\/\/\S+/gi;
export function hasSupportCredential(text: string) {
  return credentialPattern().test(text);
}
export function redactSupportCredentials(text: string) {
  return text.replace(credentialPattern(), '[redacted credential]');
}
