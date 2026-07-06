import { KundliGender } from "../types/kundli.types";

export const kundliTheme = {
  colors: {
    backgroundBase: "#090405",
    overlay: "rgba(14, 4, 6, 0.78)",
    gold: "#F3C66E",
    textPrimary: "#FBECC8",
    textSecondary: "#D5C4A0",
    panel: "rgba(20, 8, 10, 0.72)",
    panelBorder: "rgba(243, 198, 110, 0.32)",
    accentRed: "#B41225",
    accentRedSoft: "#7A1020",
    glow: "rgba(206, 46, 66, 0.22)",
  },
  spacing: {
    screenHorizontal: 20,
    sectionGap: 14,
  },
} as const;

export const genderOptions: Array<{ label: string; value: KundliGender }> = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
];

export const kundliTabs = [
  { label: "New Kundli", value: "new" as const },
  { label: "Open Kundli", value: "open" as const },
];
