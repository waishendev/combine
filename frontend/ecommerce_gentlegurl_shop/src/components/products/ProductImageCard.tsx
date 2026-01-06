"use client";

import { useState } from "react";

interface ProductImageCardProps {
  imageUrl?: string | null;
  alt: string;
  className?: string;
}

const PLACEHOLDER_IMAGE = "/images/placeholder.png";

export function ProductImageCard({ imageUrl, alt, className = "" }: ProductImageCardProps) {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const handleImageError = (imageSrc: string) => {
    setImageErrors((prev) => new Set(prev).add(imageSrc));
  };

  const getImageSrc = (imageSrc: string) => {
    return imageErrors.has(imageSrc) ? PLACEHOLDER_IMAGE : imageSrc;
  };

  const resolvedUrl = imageUrl || PLACEHOLDER_IMAGE;

  return (
    <div className={`relative aspect-square w-full overflow-hidden bg-gradient-to-b from-[var(--background-soft)] to-[var(--card)] ${className}`}>
      <img
        src={getImageSrc(resolvedUrl)}
        alt={alt}
        className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-105"
        onError={() => handleImageError(resolvedUrl)}
      />
    </div>
  );
}
