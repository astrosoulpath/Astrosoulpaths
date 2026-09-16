"use client";

import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline";
};

export function Button({
  children,
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {

  const base =
    "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-all duration-300 cursor-pointer";

  const variants = {
    primary:
      "bg-[#D4AF37] text-[#0B1026] hover:bg-[#c49d2f] hover:shadow-lg hover:-translate-y-0.5",

    secondary:
      "bg-[#0B1026] text-white hover:bg-[#151b3d] hover:shadow-lg hover:-translate-y-0.5",

    outline:
      "border border-[#D4AF37] text-[#0B1026] hover:bg-[#D4AF37]/10 hover:shadow-md",
  };


  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}