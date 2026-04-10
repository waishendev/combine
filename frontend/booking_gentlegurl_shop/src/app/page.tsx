"use client";

import { useEffect, useState } from "react";
import { Hero, DynamicSections } from "@/components/sections/LandingSections";
import { getBookingLandingPage } from "@/lib/apiClient";
import type { LandingSections } from "@/lib/types";

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

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getBookingLandingPage();
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
    <>
      <Hero hero={sections.hero} />
      {loaded && <DynamicSections sections={sections} />}
    </>
  );
}
