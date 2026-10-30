import { sessionCandidate } from "./public-auth";
/** Selects a proof, never grants a role. Every communication API verifies it server-side. */
export function communicationOwner() {
  const candidate = sessionCandidate("/chat");
  let descriptor;
  try {
    descriptor = JSON.parse(localStorage.getItem("asp_user") || "{}");
  } catch {
    throw Error("LOGIN_REQUIRED");
  }
  if (
    !candidate ||
    !["customer", "astrologer"].includes(candidate.portal) ||
    descriptor.portal !== candidate.portal ||
    typeof descriptor.id !== "string"
  )
    throw Error("LOGIN_REQUIRED");
  return { ...candidate, id: descriptor.id };
}
export function communicationLoginDestination(path: string) {
  let professional = false;
  try {
    professional =
      JSON.parse(localStorage.getItem("asp_user") || "{}").portal ===
      "astrologer";
  } catch {}
  return (
    (professional ? "/astrologer/login" : "/login") +
    "?redirect=" +
    encodeURIComponent(path)
  );
}
