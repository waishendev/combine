import { notFound } from "next/navigation";

import { ServicesPageLayout } from "@/components/services/ServicesPageLayout";
import { getHomepage } from "@/lib/server/getHomepage";
import { getServicesPage } from "@/lib/server/getServicesPage";

type ServicesSections = NonNullable<Awaited<ReturnType<typeof getServicesPage>>>["sections"];

const defaultSections: ServicesSections = {
  hero: { is_active: true, items: [] },
  services: { is_active: true, items: [] },
  pricing: { is_active: true, items: [] },
  faqs: { is_active: true, items: [] },
  notes: { is_active: true, items: [] },
};

function mergeSections(sections: ServicesSections | undefined): ServicesSections {
  if (!sections) return defaultSections;
  return {
    hero: sections.hero ?? defaultSections.hero,
    services: sections.services ?? defaultSections.services,
    pricing: sections.pricing ?? defaultSections.pricing,
    faqs: sections.faqs ?? defaultSections.faqs,
    notes: sections.notes ?? defaultSections.notes,
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
      pricing={sections.pricing.items}
      faqs={sections.faqs.items}
      notes={sections.notes.items}
      servicesActive={sections.services.is_active}
      pricingActive={sections.pricing.is_active}
      faqsActive={sections.faqs.is_active}
      notesActive={sections.notes.is_active}
      heroActive={sections.hero.is_active}
      heroSlides={heroSlides}
      whatsappPhone={whatsapp?.phone ?? null}
      whatsappEnabled={whatsapp?.enabled ?? false}
      whatsappDefaultMessage={whatsapp?.default_message ?? null}
    />
  );
}
