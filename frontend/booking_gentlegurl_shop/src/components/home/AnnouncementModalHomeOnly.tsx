"use client";

import { usePathname } from "next/navigation";
import AnnouncementModal from "@/components/home/AnnouncementModal";

type Announcement = {
  id: number | string;
  title?: string | null;
  content?: string | null;
  image_path?: string | null;
  image_url?: string | null;
  button_link?: string | null;
  button_label?: string | null;
};

export default function AnnouncementModalHomeOnly({ items }: { items: Announcement[] }) {
  const pathname = usePathname();

  // Only show on home page (/)
  if (pathname !== "/") return null;

  return <AnnouncementModal items={items} />;
}

