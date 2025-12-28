"use client";

import { useState } from "react";

type ProductGalleryProps = {
  images: string[];
  initialIndex?: number;
  alt: string;
};

const PLACEHOLDER_IMAGE = "/images/placeholder.png";

export function ProductGallery({ images, initialIndex = 0, alt }: ProductGalleryProps) {
  const safeImages = images.filter(Boolean);
  const [activeIndex, setActiveIndex] = useState(
    initialIndex >= 0 && initialIndex < safeImages.length ? initialIndex : 0,
  );
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const handleImageError = (imageSrc: string) => {
    setImageErrors((prev) => new Set(prev).add(imageSrc));
  };

  const getImageSrc = (imageSrc: string) => {
    return imageErrors.has(imageSrc) ? PLACEHOLDER_IMAGE : imageSrc;
  };

  const activeImage = safeImages[activeIndex] ?? safeImages[0];

  if (!safeImages.length) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg bg-[var(--muted)]/40 text-[color:var(--text-muted)]">
        No Image
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-[var(--muted)]/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={getImageSrc(activeImage)} 
          alt={alt} 
          className="h-full w-full object-cover"
          onError={() => handleImageError(activeImage)}
        />

{/* <Image 
        // src={activeImage} 
        src={"/images/placeholder.png"}
        alt={alt} fill className="object-cover" /> */}
      </div>

      {safeImages.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {safeImages.map((img, index) => (
            <button
              key={`${img}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded border transition ${
                index === activeIndex
                  ? "border-[var(--accent-strong)]"
                  : "border-[var(--card-border)] hover:border-[var(--accent)]"
              }`}
            >

{/* <Image 
              // src={img}
              src={"/images/placeholder.png"}
              alt={`${alt} thumbnail ${index + 1}`} fill className="object-cover" />
               */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={getImageSrc(img)}
                alt={`${alt} thumbnail ${index + 1}`} 
                className="h-full w-full object-cover"
                onError={() => handleImageError(img)}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
