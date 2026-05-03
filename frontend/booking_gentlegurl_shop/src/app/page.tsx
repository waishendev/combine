"use client";

import { useEffect, useState } from "react";
import localFont from "next/font/local";
import { Hero, DynamicSections } from "@/components/sections/LandingSections";
import { getBookingLandingPage } from "@/lib/apiClient";
import type { LandingSections } from "@/lib/types";
import { getBookingHomepageSliders, type BookingHomepageSlider } from "@/lib/getBookingHomepageSliders";

const justBreathe = localFont({
  src: [
    {
      path: "../../public/fonts/just_breathe/JustBreathe.otf",
      weight: "400",
      style: "normal",
    },
  ],
  fallback: ["serif"],
});

const defaultSections: LandingSections = {
  hero: {
    is_active: true,
    label: "Premium Salon Booking",
    title: "Beauty appointments, made effortless.",
    subtitle:
      "Discover signature services, reserve your slot instantly, and arrive confident with our trusted professional team.",
    cta_label: "Book Appointment",
    cta_link: "/booking",
  },
  gallery: {
    is_active: true,
    heading: { label: "GALLERY", title: "Click to view services and pricing", align: "center" },
    items: [],
  },
  service_menu: {
    is_active: true,
    heading: { label: "Service Menu", title: "Click to view services and pricing", align: "center" },
    items: [],
  },
  faqs: {
    is_active: true,
    heading: { label: "FAQ", title: "You might be wondering", align: "left" },
    items: [],
  },
  notes: {
    is_active: true,
    heading: { label: "Notes", title: "Policy & care", align: "left" },
    items: [],
  },
};

export default function HomePage() {
  const [sections, setSections] = useState<LandingSections>(defaultSections);
  const [loaded, setLoaded] = useState(false);
  const [sliders, setSliders] = useState<BookingHomepageSlider[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getBookingLandingPage();
        const sliderData = await getBookingHomepageSliders();
        setSliders(sliderData);
        if (data?.sections) {
          setSections({ ...defaultSections, ...data.sections });
        }
      } catch {
        // fall back to defaults
      } finally {
        setLoaded(true);
      }
    };
    void load();
  }, []);

  return (
    <main className="bg-gradient-to-b from-transparent via-[var(--card)]/60 to-transparent pb-16">
      <div className="mx-auto max-w-6xl space-y-14 px-4 pt-8 sm:px-6 lg:px-8">
        <Hero
          hero={sections.hero}
          sliders={sliders}
          sliderTitleClassName={justBreathe.className}
          sliderSubtitleClassName={justBreathe.className}
        />
        {loaded && <DynamicSections sections={sections} />}
      </div>
    </main>
  );
}
