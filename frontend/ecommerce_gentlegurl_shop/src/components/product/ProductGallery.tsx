"use client";

import Image from "next/image";
import { useState } from "react";

type ProductGalleryProps = {
  images: string[];
  initialIndex?: number;
  alt: string;
};

export function ProductGallery({ images, initialIndex = 0, alt }: ProductGalleryProps) {
  const safeImages = images.filter(Boolean);
  const [activeIndex, setActiveIndex] = useState(
    initialIndex >= 0 && initialIndex < safeImages.length ? initialIndex : 0,
  );

  const activeImage = safeImages[activeIndex] ?? safeImages[0];

  if (!safeImages.length) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg bg-gray-100 text-gray-400">
        No Image
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-100">
        <Image 
        // src={activeImage} 
        src={"/images/placeholder.png"}
        alt={alt} fill className="object-cover" />
      </div>

      {safeImages.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {safeImages.map((img, index) => (
            <button
              key={`${img}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded border transition ${
                index === activeIndex ? "border-black" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <Image 
              // src={img}
              src={"/images/placeholder.png"}
              alt={`${alt} thumbnail ${index + 1}`} fill className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
