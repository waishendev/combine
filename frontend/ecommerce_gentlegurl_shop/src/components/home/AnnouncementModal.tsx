"use client";

import { useState } from "react";
import Image from "next/image";

type Announcement = {
  id: number | string;
  title?: string;
  content?: string;
  image_path?: string | null;
  button_link?: string | null;
  button_label?: string | null;
};

type AnnouncementModalProps = {
  items: Announcement[];
};

export default function AnnouncementModal({ items }: AnnouncementModalProps) {
  const [open, setOpen] = useState(true);

  if (!open || !items?.length) return null;

  const item = items[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--foreground)]/25 px-4 backdrop-blur-sm">
      <div className="relative w-[90%] max-w-lg overflow-hidden rounded-3xl border border-[var(--muted)] bg-gradient-to-br from-[#fff8f5] via-[#ffeef3] to-white p-8 shadow-[0_25px_90px_-45px_rgba(216,124,163,0.55)]">
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" aria-hidden />

        <button
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--muted)] bg-white/80 text-[var(--foreground)]/70 shadow-sm transition hover:-translate-y-0.5 hover:text-[var(--foreground)]"
          onClick={() => setOpen(false)}
          aria-label="Close announcement"
        >
          ×
        </button>

        {item.title && (
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            Latest Drop
          </div>
        )}

        {item.title && <h3 className="text-2xl font-semibold text-[var(--foreground)]">{item.title}</h3>}
        {item.content && (
          <p className="mt-2 text-sm leading-relaxed text-[var(--foreground)]/75">{item.content}</p>
        )}

        {item.image_path && (
          <div className="relative mt-5 h-56 w-full overflow-hidden rounded-2xl border border-[var(--muted)] bg-[var(--muted)]">
            <Image
              src={item.image_path}
              alt={item.title ?? "announcement"}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--accent)]/15 via-transparent to-white/60" />
          </div>
        )}

        {item.button_link && (
          <a
            href={item.button_link}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#e7a2ba] via-[#f4cad9] to-[#fbe3ec] px-5 py-3 text-sm font-semibold text-[var(--foreground)] shadow-lg shadow-pink-200/30 transition hover:translate-y-[-2px] hover:shadow-xl"
          >
            {item.button_label ?? "Shop the edit"}
            <span aria-hidden className="text-base">→</span>
          </a>
        )}
      </div>
    </div>
  );
}
