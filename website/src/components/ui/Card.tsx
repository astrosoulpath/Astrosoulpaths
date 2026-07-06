import React from "react";

type Props = {
  children: React.ReactNode;
  className?: string;
};

export function Card({
  children,
  className = "",
}: Props) {
  return (
    <div
      className={`rounded-3xl bg-white shadow-lg p-6 ${className}`}
    >
      {children}
    </div>
  );
}