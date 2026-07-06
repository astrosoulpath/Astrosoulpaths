import { ImageSourcePropType, StyleProp, StyleSheet, ViewStyle } from "react-native";
import { memo } from "react";

import {
  Avatar,
  AvatarFallbackText,
  AvatarImage,
} from "@/components/ui/avatar";
import { astroImages } from "@/src/constants/images";

type AppAvatarProps = {
  size?: number;
  source?: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
};

function AppAvatarComponent({
  size = 92,
  source = astroImages.logo,
  style,
}: AppAvatarProps) {
  return (
    <Avatar
      size="2xl"
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
    >
      <AvatarImage source={source} alt="Astrologer avatar" />
      <AvatarFallbackText>AS</AvatarFallbackText>
    </Avatar>
  );
}

export const AppAvatar = memo(AppAvatarComponent);

const styles = StyleSheet.create({
  avatar: {
    overflow: "hidden",
    borderWidth: 2.5,
    borderColor: "#D4A757",
    backgroundColor: "#081028",
  },
});
