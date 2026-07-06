import { ViewStyle } from "react-native";

import { astroColors } from "@/src/constants/colors";

export const luxuryShadows: Record<string, ViewStyle> = {
  floating: {
    shadowColor: astroColors.white,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 10,
  },
  pill: {
    shadowColor: astroColors.gold,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 7,
  },
  card: {
    shadowColor: astroColors.gold,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 26,
    elevation: 16,
  },
  logo: {
    shadowColor: astroColors.gold,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.18,
    shadowRadius: 36,
    elevation: 10,
  },
};
