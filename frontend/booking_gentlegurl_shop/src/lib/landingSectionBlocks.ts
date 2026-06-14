import type { LandingGallerySectionBlock, LandingSections } from "@/lib/types";

export function resolveServiceMenuSections(sections: LandingSections): LandingGallerySectionBlock[] {
  if (Array.isArray(sections.service_menus) && sections.service_menus.length > 0) {
    return sections.service_menus;
  }
  if (sections.service_menu) {
    return [sections.service_menu];
  }
  return [];
}

export function resolveOurArtistsSections(sections: LandingSections): LandingGallerySectionBlock[] {
  if (Array.isArray(sections.our_artists_sections) && sections.our_artists_sections.length > 0) {
    return sections.our_artists_sections;
  }
  if (sections.our_artists) {
    return [sections.our_artists];
  }
  return [];
}
