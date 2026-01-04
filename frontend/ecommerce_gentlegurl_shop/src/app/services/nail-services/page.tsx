import { ServicesPageLayout } from "@/components/services/ServicesPageLayout";

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

export default function NailServicesPage() {
  return (
    <ServicesPageLayout
      title="Nail Services"
      subtitle="Hi dear🥰 Here’s our price list📋 Please let us know in advance so we can reserve sufficient time for your appointment."
      services={services}
      pricing={pricing}
      faqs={faqs}
      notes={notes}
      heroImage="/images/slideshow_placeholder.jpg"
      galleryImages={[
        {
          src: "/images/placeholder.png",
          alt: "Price list photo one (placeholder)",
          caption: "Placeholder — replace with the manicure & nail extension price list photo.",
        },
        {
          src: "/images/placeholder.png",
          alt: "Price list photo two (placeholder)",
          caption: "Placeholder — replace with the manicure add-ons and extensions price list photo.",
        },
        {
          src: "/images/placeholder.png",
          alt: "Price list photo three (placeholder)",
          caption: "Placeholder — replace with the pedicure price list photo.",
        },
      ]}
    />
  );
}
