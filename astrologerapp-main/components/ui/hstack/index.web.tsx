import React from "react";
import {
  StyleSheet,
  type ViewStyle,
} from "react-native";

import type { VariantProps } from "@gluestack-ui/utils/nativewind-utils";

import { hstackStyle } from "./styles";

type WebStyle =
  | React.CSSProperties
  | ViewStyle
  | WebStyle[]
  | null
  | false
  | undefined;

type IHStackProps = Omit<
  React.ComponentPropsWithoutRef<"div">,
  "style"
> &
  VariantProps<typeof hstackStyle> & {
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

const HStack = React.forwardRef<
  HTMLDivElement,
  IHStackProps
>(function HStack(
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
      className={hstackStyle({
        space,
        reversed: reversed as boolean,
        class: className,
      })}
      style={flattenWebStyle(style)}
    />
  );
});

HStack.displayName = "HStack";

export { HStack };