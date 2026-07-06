import { LucideIcon } from "lucide-react-native";
import { DimensionValue } from "react-native";

export interface CustomFeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  onPress?: () => void;

  // Customization
  width?: DimensionValue;
  height?: number;
  cardBg?: string;
  borderColor?: string;

  iconBg?: string;
  iconBorderColor?: string;
  iconColor?: string;

  arrowBg?: string;
  arrowBorderColor?: string;
  arrowColor?: string;

  titleColor?: string;
  descriptionColor?: string;

  className?: string;
  cardClassName?: string;
  iconClassName?: string;
  arrowClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}
