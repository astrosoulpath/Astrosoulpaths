import {
  CircleHelp,
  Home,
  PhoneCall,
  ReceiptText,
  Settings,
  UserRound,
  type LucideIcon,
} from "lucide-react-native";

export type DrawerRouteName =
  | "index"
  | "audio-call"
  | "profile"
  | "settings"
  | "support"
  | "transactions";

export type DrawerItemConfig = {
  icon: LucideIcon;
  route: DrawerRouteName;
  title: string;
};

export const drawerItems: DrawerItemConfig[] = [
  { icon: Home, route: "index", title: "Home" },
  { icon: PhoneCall, route: "audio-call", title: "Audio Call" },
  { icon: UserRound, route: "profile", title: "Profile" },
  { icon: Settings, route: "settings", title: "Settings" },
  { icon: CircleHelp, route: "support", title: "Help & Support" },
  { icon: ReceiptText, route: "transactions", title: "Light Transaction" },
];
