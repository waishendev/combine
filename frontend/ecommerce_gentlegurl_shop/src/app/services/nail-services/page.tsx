import { ServicesPageLayout } from "@/components/services/ServicesPageLayout";
import { getHomepage } from "@/lib/server/getHomepage";

const services = [
  {
    title: "Manicure & Gel Manicure",
    description: "Cuticle care, shaping, and polish options from classic color to art design and mystery boxes.",
  },
  {
    title: "Pedicure & Gel Pedicure",
    description: "Foot care with plain, glitter, cat eye, chrome, or art design finishes.",
  },
  {
    title: "Spa Enhancements",
    description: "Standard or deluxe spa upgrades with masks, scrubs, massage, and collagen therapy options.",
  },
  {
    title: "Nail Extension",
    description: "Full set or partial extensions, plus structure rebalancing for long natural nails.",
  },
  {
    title: "Nail Art",
    description: "Custom creative nail art sessions with advance booking required.",
  },
  {
    title: "Removal & Repair",
    description: "Gentle removal for gel or extensions, with options to continue or not continue service.",
  },
];

const pricing = [
  { label: "Manicure (no color)", price: "RM 45" },
  { label: "Gel Manicure (plain / glitter)", price: "RM 98" },
  { label: "Gel Pedicure (plain / glitter)", price: "RM 78" },
  { label: "Custom Creative Nail Art", price: "From RM 288" },
  { label: "Standard Spa Add-on", price: "RM 48" },
  { label: "Deluxe Spa Add-on", price: "RM 68" },
];

const faqs = [
  {
    question: "How do I book?",
    answer: "Let us know your service preferences and we will confirm the appointment once time is reserved.",
  },
  {
    question: "What should I include in my request?",
    answer: "Please share nail extension (full set / partial) and removal preference (natural / extensions / none) in advance.",
  },
  {
    question: "Do you offer waxing or laser services?",
    answer: "Yes, waxing and 810 laser services are available. Ask us for details when booking.",
  },
  {
    question: "What else is in-store?",
    answer: "We carry Korean & Chinese beauty products and POP MART blind boxes for you to browse.",
  },
  {
    question: "Is the appointment confirmed immediately?",
    answer: "An appointment is confirmed only after receiving a confirmation message. If not received, please remind us.",
  },
];

const notes = [
  "Hi dear🥰 Here’s our price list📋 Please let us know in advance so we can reserve sufficient time for your appointment.",
  "Service: Nail extension (full set / partial) and removal option (remove natural nails / remove extensions / none).",
  "⚠️ An appointment is confirmed only after receiving a confirmation message. If not received, please remind us. Thank you!",
  "💖 Waxing / 810 laser services are also available.",
  "We also carry Korean & Chinese beauty products and POP MART blind boxes — feel free to have a look during your visit 🛒",
];

export default async function NailServicesPage() {
  const homepage = await getHomepage();
  const whatsapp = homepage?.contact?.whatsapp;

  return (
    <ServicesPageLayout
      title="Nail Services"
      subtitle="Hi dear🥰 Here's our price list📋 Please let us know in advance so we can reserve sufficient time for your appointment."
      services={services}
      pricing={pricing}
      faqs={faqs}
      notes={notes}
      heroSlides={[
        { src: "/images/CUSTOMERGIVE/Manicure.jpeg", alt: "Gel manicure with design" },
        { src: "/images/CUSTOMERGIVE/Gel Manicure.jpeg", alt: "Gel manicure with design" },
        { src: "/images/CUSTOMERGIVE/Gel Manicure with Design.jpeg", alt: "Gel manicure with design" },
        // { src: "/images/CUSTOMERGIVE/Pedicure RM45.jpeg", alt: "Gel manicure with design" },
        { src: "/images/CUSTOMERGIVE/Gel Pedicure.jpeg", alt: "Gel manicure with design" },
        { src: "/images/CUSTOMERGIVE/Gel Pedicure with Design.jpeg", alt: "Gel pedicure with design" },
      ]}

      whatsappPhone={whatsapp?.phone ?? null}
      whatsappEnabled={whatsapp?.enabled ?? false}
      whatsappDefaultMessage={whatsapp?.default_message ?? null}
    />
  );
}
