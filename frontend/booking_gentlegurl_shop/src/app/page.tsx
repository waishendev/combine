"use client";

import { useEffect, useState } from "react";
import { Hero, DynamicSections } from "@/components/sections/LandingSections";
import { getBookingLandingPage } from "@/lib/apiClient";
import type { LandingSections } from "@/lib/types";
import { getBookingHomepageSliders, type BookingHomepageSlider } from "@/lib/getBookingHomepageSliders";

export default function HomePage() {
  const [sections, setSections] = useState<LandingSections | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sliders, setSliders] = useState<BookingHomepageSlider[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [data, sliderData] = await Promise.all([
          getBookingLandingPage(),
          getBookingHomepageSliders(),
        ]);
        setSliders(sliderData);
        if (data?.sections) {
          const s = data.sections;
          setSections({
            ...s,
            hero: {
              ...s.hero,
              title_2: s.hero.title_2 ?? "",
              subtitle_2: s.hero.subtitle_2 ?? "",
            },
          });
        } else {
          setSections(null);
        }
      } catch {
        setSections(null);
      } finally {
        setLoaded(true);
      }
    };
    void load();
  }, []);

  const hero = sections?.hero;

  return (
    <main className="bg-gradient-to-b from-transparent via-[var(--card)]/60 to-transparent pb-16">
      <div className="mx-auto max-w-6xl space-y-14 px-4 pt-8 sm:px-6 lg:px-8">
        {hero ? <Hero hero={hero} sliders={sliders} /> : null}
        {loaded && sections ? <DynamicSections sections={sections} /> : null}
      </div>
    </main>
  );
}
