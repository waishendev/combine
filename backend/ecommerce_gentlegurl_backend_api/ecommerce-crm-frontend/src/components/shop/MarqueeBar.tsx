'use client';

import type { MarqueeItem } from "@/lib/shop-types";

export function MarqueeBar({ items }: { items: MarqueeItem[] }) {
  if (!items.length) return null;

  return (
    <div className="overflow-hidden bg-slate-900 text-white">
      <div className="flex animate-marquee whitespace-nowrap py-2 text-sm">
        {items.map((item) => (
          <span key={item.id} className="mx-4">
            {item.text}
          </span>
        ))}
      </div>
    </div>
  );
}
