import type { LandingVisitStudio } from "@/lib/types/landingVisitStudio";

export type EcommerceLandingHero = {
  is_active: boolean;
  label: string;
  title: string;
  subtitle: string;
  title_2: string;
  subtitle_2: string;
  cta_label: string;
  cta_link: string;
};

export type EcommerceSliderIntro = {
  is_active: boolean;
  headline: string;
};

export type EcommerceLandingSections = {
  slider_intro: EcommerceSliderIntro;
  hero: EcommerceLandingHero;
  visit_studio: LandingVisitStudio;
};
