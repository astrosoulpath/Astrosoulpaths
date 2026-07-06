import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
} from "@react-navigation/drawer";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CosmicBackground } from "@/components/common/cosmic-background";
import { AppDrawerFooter } from "@/components/drawer/drawer-footer";
import { AppDrawerHeader } from "@/components/drawer/drawer-header";
import { DrawerItem } from "@/components/drawer/drawer-item";
import { Divider } from "@/components/ui/divider";
import { drawerItems } from "@/src/constants/drawer-items";

export function CustomDrawerContent(props: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const activeRouteName = props.state.routes[props.state.index]?.name;

  const handleItemPress = (route: string) => {
    props.navigation.navigate(route);
  };

  return (
    <CosmicBackground>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 34,
            paddingBottom: insets.bottom + 20,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AppDrawerHeader />

        <View style={styles.dividerWrap}>
          <Divider style={styles.divider} />
          <View style={styles.starMark} />
        </View>

        <View style={styles.items}>
          {drawerItems.map((item) => (
            <DrawerItem
              key={item.route}
              active={activeRouteName === item.route}
              icon={item.icon}
              onPress={() => handleItemPress(item.route)}
              route={item.route}
              title={item.title}
            />
          ))}
        </View>

        <AppDrawerFooter />
      </DrawerContentScrollView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
  },
  dividerWrap: {
    height: 30,
    justifyContent: "center",
    marginBottom: 16,
  },
  divider: {
    backgroundColor: "rgba(182,184,214,0.24)",
  },
  starMark: {
    position: "absolute",
    alignSelf: "center",
    width: 16,
    height: 16,
    transform: [{ rotate: "45deg" }],
    backgroundColor: "#F0B35D",
  },
  items: {
    flex: 1,
    gap: 16,
  },
});
