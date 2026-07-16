import React from "react";
import {
  StyleSheet,
  type ViewStyle,
} from "react-native";

import type { VariantProps } from "@gluestack-ui/utils/nativewind-utils";

import { boxStyle } from "./styles";

type WebBoxStyle =
  | React.CSSProperties
  | ViewStyle
  | WebBoxStyle[]
  | null
  | false
  | undefined;

type IBoxProps = Omit<
  React.ComponentPropsWithoutRef<"div">,
  "style"
> &
  VariantProps<typeof boxStyle> & {
    className?: string;
    pointerEvents?: React.CSSProperties["pointerEvents"];
    style?: WebBoxStyle;
  };

function flattenWebStyle(
  style: WebBoxStyle,
): React.CSSProperties | undefined {
  if (!style) {
    return undefined;
  }

  const flattenedStyle =
    StyleSheet.flatten(
      style as never,
    );

  if (!flattenedStyle) {
    return undefined;
  }

  return flattenedStyle as React.CSSProperties;
}

const Box = React.forwardRef<
  HTMLDivElement,
  IBoxProps
>(function Box(
  {
    className,
    pointerEvents,
    style,
    ...props
  },
  ref,
) {
  const flattenedStyle =
    flattenWebStyle(style);

  const resolvedStyle:
    | React.CSSProperties
    | undefined =
    flattenedStyle || pointerEvents
      ? {
          ...flattenedStyle,
          ...(pointerEvents
            ? {
                pointerEvents,
              }
            : {}),
        }
      : undefined;

  return (
    <div
      {...props}
      ref={ref}
      className={boxStyle({
        class: className,
      })}
      style={resolvedStyle}
    />
  );
});

Box.displayName = "Box";

export { Box };