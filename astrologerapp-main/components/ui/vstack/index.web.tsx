import React from "react";
import {
  StyleSheet,
  type ViewStyle,
} from "react-native";

import type { VariantProps } from "@gluestack-ui/utils/nativewind-utils";

import { vstackStyle } from "./styles";

type WebStyle =
  | React.CSSProperties
  | ViewStyle
  | WebStyle[]
  | null
  | false
  | undefined;

type IVStackProps = Omit<
  React.ComponentPropsWithoutRef<"div">,
  "style"
> &
  VariantProps<typeof vstackStyle> & {
    style?: WebStyle;
  };

function flattenWebStyle(
  style: WebStyle,
): React.CSSProperties | undefined {
  if (!style) {
    return undefined;
  }

  const flattened = StyleSheet.flatten(
    style as never,
  );

  return flattened
    ? (flattened as React.CSSProperties)
    : undefined;
}

const VStack = React.forwardRef<
  HTMLDivElement,
  IVStackProps
>(function VStack(
  {
    className,
    space,
    reversed,
    style,
    ...props
  },
  ref,
) {
  return (
    <div
      {...props}
      ref={ref}
      className={vstackStyle({
        space,
        reversed: reversed as boolean,
        class: className,
      })}
      style={flattenWebStyle(style)}
    />
  );
});

VStack.displayName = "VStack";

export { VStack };