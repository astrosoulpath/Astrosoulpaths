"use client";
import Image from "next/image";
import { useState } from "react";
export default function ArticleCover({
  src,
  alt,
  width,
  height,
  sizes,
  className,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <p className="text-sm px-4 py-3">Cover image unavailable.</p>
  ) : (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
