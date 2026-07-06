import React from "react";

type Props = {
  title: string;
  subtitle?: string;
  center?: boolean;
};

export function Heading({
  title,
  subtitle,
  center = false,
}: Props) {
  return (
    <div className={center ? "text-center" : ""}>
      <h2 className="text-4xl font-bold text-[#0B1026]">
        {title}
      </h2>

      {subtitle && (
        <p className="mt-3 text-gray-600 max-w-2xl">
          {subtitle}
        </p>
      )}
    </div>
  );
}