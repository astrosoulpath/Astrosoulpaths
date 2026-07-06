import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline";
};

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition";

  const variants = {
    primary: "bg-[#D4AF37] text-[#0B1026] hover:opacity-90",
    secondary: "bg-[#0B1026] text-white hover:opacity-90",
    outline: "border border-[#D4AF37] text-[#0B1026] hover:bg-[#D4AF37]/10",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}