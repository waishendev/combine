import { notFound } from "next/navigation";

import { ServicesPageLayout } from "@/components/services/ServicesPageLayout";
import { getHomepage } from "@/lib/server/getHomepage";
import { getServicesPage } from "@/lib/server/getServicesPage";

type ServicesSections = NonNullable<Awaited<ReturnType<typeof getServicesPage>>>["sections"];

const defaultSections: ServicesSections = {
  hero: { is_active: true, items: [] },
  services: {
    is_active: true,
    items: [],
    heading: {
      label: "Services",
      title: "What's Included",
      align: "left",
    },
  },
  gallery: {
    is_active: true,
    items: [],
    heading: {
      label: "Service Menu",
      title: "Click to view services and pricing",
      align: "center",
    },
    footerText: "",
    footerAlign: "center",
    layout: "fixed",
  },
  pricing: {
    is_active: true,
    items: [],
    heading: {
      label: "Pricing",
      title: "Transparent rates",
      align: "left",
    },
  },
  faqs: {
    is_active: true,
    items: [],
    heading: {
      label: "FAQ",
      title: "You might be wondering",
      align: "left",
    },
  },
  notes: {
    is_active: true,
    items: [],
    heading: {
      label: "Notes",
      title: "Policy & care",
      align: "left",
    },
  },
};

function mergeSections(sections: ServicesSections | undefined): ServicesSections {
  if (!sections) return defaultSections;
  const mergeHeading = (
    heading: ServicesSections[keyof ServicesSections]["heading"] | undefined,
    fallback: ServicesSections[keyof ServicesSections]["heading"] | undefined,
  ) => {
    if (!fallback) return heading;
    return {
      ...fallback,
      ...(heading ?? {}),
    };
  };

  const mergeSection = <T,>(
    section:
      | {
          is_active: boolean;
          items: T[];
          heading?: ServicesSections[keyof ServicesSections]["heading"];
          [key: string]: unknown;
        }
      | undefined,
    fallback: {
      is_active: boolean;
      items: T[];
      heading?: ServicesSections[keyof ServicesSections]["heading"];
      [key: string]: unknown;
    },
  ) => ({
    ...fallback,
    ...(section ?? {}),
    items: section?.items ?? fallback.items,
    heading: mergeHeading(section?.heading, fallback.heading),
  });

  const mergedGallery = {
    ...mergeSection(sections.gallery, defaultSections.gallery),
    footerText: sections.gallery?.footerText ?? defaultSections.gallery.footerText,
    footerAlign: sections.gallery?.footerAlign ?? defaultSections.gallery.footerAlign,
    layout: sections.gallery?.layout ?? defaultSections.gallery.layout,
  };

  return {
    hero: sections.hero ?? defaultSections.hero,
    services: mergeSection(sections.services, defaultSections.services),
    gallery: {
      ...mergedGallery,
      items: mergedGallery.items.filter((item) => item?.src),
    },
    pricing: mergeSection(sections.pricing, defaultSections.pricing),
    faqs: mergeSection(sections.faqs, defaultSections.faqs),
    notes: mergeSection(sections.notes, defaultSections.notes),
  };
}

export default async function ServicesDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [pageData, homepage] = await Promise.all([
    getServicesPage(slug),
    getHomepage(),
  ]);

  if (!pageData) {
    notFound();
  }

  const whatsapp = homepage?.contact?.whatsapp;
  const sections = mergeSections(pageData.sections);
  const heroSlides = [...(pageData.hero_slides ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );

  return (
    <ServicesPageLayout
      title={pageData.title}
      subtitle={pageData.subtitle ?? ""}
      services={sections.services.items}
      gallery={sections.gallery.items}
      pricing={sections.pricing.items}
      faqs={sections.faqs.items}
      notes={sections.notes.items}
      servicesActive={sections.services.is_active}
      galleryActive={sections.gallery.is_active}
      pricingActive={sections.pricing.is_active}
      faqsActive={sections.faqs.is_active}
      notesActive={sections.notes.is_active}
      servicesHeading={sections.services.heading ?? defaultSections.services.heading}
      galleryHeading={sections.gallery.heading ?? defaultSections.gallery.heading}
      galleryFooterText={sections.gallery.footerText ?? defaultSections.gallery.footerText}
      galleryFooterAlign={sections.gallery.footerAlign ?? defaultSections.gallery.footerAlign}
      galleryLayout={sections.gallery.layout ?? defaultSections.gallery.layout}
      pricingHeading={sections.pricing.heading ?? defaultSections.pricing.heading}
      faqHeading={sections.faqs.heading ?? defaultSections.faqs.heading}
      notesHeading={sections.notes.heading ?? defaultSections.notes.heading}
      heroActive={sections.hero.is_active}
      heroSlides={heroSlides}
      whatsappPhone={whatsapp?.phone ?? null}
      whatsappEnabled={whatsapp?.enabled ?? false}
      whatsappDefaultMessage={whatsapp?.default_message ?? null}
    />
  );
}
