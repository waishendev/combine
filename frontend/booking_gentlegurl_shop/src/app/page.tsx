import { Hero, DynamicSections } from "@/components/sections/LandingSections";
import {
  getBookingHomepageSlidersServer,
  getBookingLandingPageServer,
} from "@/lib/server/getBookingLanding";

export default async function HomePage() {
  const [sections, sliders] = await Promise.all([
    getBookingLandingPageServer(),
    getBookingHomepageSlidersServer(),
  ]);

  const hero = sections?.hero;

  return (
    <main className="bg-gradient-to-b from-transparent via-[var(--card)]/60 to-transparent pb-16">
      <div className="mx-auto max-w-6xl space-y-14 px-4 pt-8 sm:px-6 lg:px-8">
        {hero ? <Hero hero={hero} sliders={sliders} /> : null}
        {sections ? <DynamicSections sections={sections} /> : null}
      </div>
    </main>
  );
}
