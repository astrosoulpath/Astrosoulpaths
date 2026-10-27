export type AboutContent = {
  title: string;
  introduction: string;
  mission: string;
  vision: string;
  services: string;
  why: string;
  commitment: string;
};
export const aboutFields = [
  "title",
  "introduction",
  "mission",
  "vision",
  "services",
  "why",
  "commitment",
] as const;
export function readAbout(value: unknown): AboutContent {
  if (!value || typeof value !== "object")
    throw Error("About content is unavailable.");
  const input = value as Record<string, unknown>,
    content = {} as AboutContent;
  for (const key of aboutFields) {
    const text = input[key];
    if (
      typeof text !== "string" ||
      text.length > (key === "title" ? 120 : 8000) ||
      /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)
    )
      throw Error("About content is unavailable.");
    content[key] = text;
  }
  if (!content.title.trim() || !content.introduction.trim())
    throw Error("About content is unavailable.");
  return content;
}
