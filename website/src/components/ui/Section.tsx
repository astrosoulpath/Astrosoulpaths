import React from "react";

type Props = {
  children: React.ReactNode;
  className?: string;
};

export function Section({ children, className = "" }: Props) {
  return (
    <section className={`py-16 md:py-24 ${className}`}>
      {children}
    </section>
  );
}