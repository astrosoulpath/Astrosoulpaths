import React from "react";
import {
  StyleSheet,
  type StyleProp,
  type TextStyle,
} from "react-native";
import type { VariantProps } from "@gluestack-ui/utils/nativewind-utils";

import { textStyle } from "./styles";

type NativeTextProps = {
  adjustsFontSizeToFit?: boolean;
  allowFontScaling?: boolean;
  ellipsizeMode?: "head" | "middle" | "tail" | "clip";
  numberOfLines?: number;
  selectable?: boolean;
  style?: StyleProp<TextStyle>;
};

type SpanProps = Omit<
  React.ComponentPropsWithoutRef<"span">,
  "style"
>;

type ITextProps = SpanProps &
  VariantProps<typeof textStyle> &
  NativeTextProps;

const Text = React.forwardRef<HTMLSpanElement, ITextProps>(
  (
    {
      className,
      isTruncated,
      bold,
      underline,
      strikeThrough,
      size = "md",
      sub,
      italic,
      highlight,

      adjustsFontSizeToFit: _adjustsFontSizeToFit,
      allowFontScaling: _allowFontScaling,
      ellipsizeMode: _ellipsizeMode,
      numberOfLines,
      selectable,
      style,

      children,
      ...rest
    },
    ref
  ) => {
    const flatStyle = StyleSheet.flatten(style) ?? {};

    const lineClampStyle: React.CSSProperties =
      typeof numberOfLines === "number"
        ? numberOfLines === 1
          ? {
              display: "inline-block",
              maxWidth: "100%",
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }
          : {
              display: "-webkit-box",
              overflow: "hidden",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: numberOfLines,
            }
        : {};

    return (
      <span
        {...rest}
        ref={ref}
        className={textStyle({
          isTruncated: isTruncated as boolean,
          bold: bold as boolean,
          underline: underline as boolean,
          strikeThrough: strikeThrough as boolean,
          size,
          sub: sub as boolean,
          italic: italic as boolean,
          highlight: highlight as boolean,
          class: className,
        })}
        style={{
          ...(flatStyle as React.CSSProperties),
          ...lineClampStyle,
          userSelect: selectable === false ? "none" : undefined,
        }}
      >
        {children}
      </span>
    );
  }
);

Text.displayName = "Text";

export { Text };