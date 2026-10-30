/** Display only. Never converts amounts, assigns a missing currency or changes a ledger. */
const locales: Record<string, string> = {
  IN: "en-IN",
  US: "en-US",
  GB: "en-GB",
  FR: "fr-FR",
  AU: "en-AU",
};
export function currencyLocale(countryCode?: unknown) {
  return typeof countryCode === "string"
    ? locales[countryCode.toUpperCase()]
    : undefined;
}
export function formatStoredMoney(
  value: unknown,
  currency: unknown,
  countryCode?: unknown,
) {
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency))
    return "Unavailable";
  if (
    typeof value !== "number" &&
    !(typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value))
  )
    return "Unavailable";
  const amount = Number(value);
  if (!Number.isFinite(amount) || Math.abs(amount) > Number.MAX_SAFE_INTEGER)
    return "Unavailable";
  try {
    return new Intl.NumberFormat(currencyLocale(countryCode), {
      style: "currency",
      currency,
      currencyDisplay: "code",
    }).format(amount);
  } catch {
    return "Unavailable";
  }
}
