import { memo } from "react";

import { DrawerItem } from "@/components/drawer/drawer-item";
import { DrawerSection } from "@/components/drawer/drawer-section";
import { drawerItems } from "@/src/constants/drawer-items";

type DrawerContentProps = {
  activeItem?: string;
  onItemPress?: (title: string) => void;
};

function AppDrawerContentComponent({
  activeItem = "Home",
  onItemPress,
}: DrawerContentProps) {
  return (
    <DrawerSection>
      {drawerItems.map((item) => (
        <DrawerItem
          key={item.route}
          active={activeItem === item.title}
          icon={item.icon}
          onPress={() => onItemPress?.(item.title)}
          route={item.route}
          title={item.title}
        />
      ))}
    </DrawerSection>
  );
}

export const AppDrawerContent = memo(AppDrawerContentComponent);
