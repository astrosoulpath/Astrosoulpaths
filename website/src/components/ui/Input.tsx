import React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({
  className = "",
  ...props
}: Props) {
  return (
    <input
      className={`w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#D4AF37] ${className}`}
      {...props}
    />
  );
}