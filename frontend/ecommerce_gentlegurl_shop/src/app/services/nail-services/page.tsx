import { ServicesPageLayout } from "@/components/services/ServicesPageLayout";

const services = [
  { title: "Classic Manicure", description: "Nail shaping, cuticle care, and polished finish for everyday shine." },
  { title: "Gel Manicure", description: "Long-lasting gel color with chip-resistant shine and a sleek finish." },
  { title: "Classic Pedicure", description: "Relaxing soak, gentle scrub, and tidy polish for soft, refreshed feet." },
  { title: "Gel Pedicure", description: "Durable gel finish with a smooth, glossy look that lasts longer." },
  { title: "Nail Art Add-on", description: "Minimal, floral, or statement designs tailored to your mood." },
  { title: "Repair & Removal", description: "Safe gel removal plus strengthening care to protect natural nails." },
];

const pricing = [
  { label: "Classic Manicure", price: "RM 45" },
  { label: "Gel Manicure", price: "RM 79" },
  { label: "Classic Pedicure", price: "RM 65" },
  { label: "Gel Pedicure", price: "RM 99" },
  { label: "Nail Art (from)", price: "RM 15" },
  { label: "Gel Removal", price: "RM 25" },
];

const faqs = [
  { question: "How long does gel last?", answer: "Gel manicures typically last 2–3 weeks with proper aftercare and minimal water exposure." },
  { question: "Do you offer nail art references?", answer: "Yes! We have lookbook ideas ready, or you can share your inspo photos for us to recreate." },
  { question: "Can I remove gel at home?", answer: "We recommend professional removal to protect your nail bed. We use gentle techniques to avoid damage." },
  { question: "What if I have sensitive nails?", answer: "Let us know— we can adjust pressure, use nourishing bases, and keep your service extra gentle." },
  { question: "How do I prepare before my appointment?", answer: "Arrive with bare nails if possible, avoid heavy oils beforehand, and bring any inspo you love." },
];

const notes = [
  "Please arrive 5 minutes early.",
  "Late arrivals may shorten service time.",
  "Reschedule at least 24 hours in advance.",
  "Hygienic tools and sanitized stations for every client.",
];

export default function NailServicesPage() {
  return (
    <ServicesPageLayout
      title="Nail Services"
      subtitle="Clean, modern nail care with a soft-touch finish — designed for everyday elegance."
      services={services}
      pricing={pricing}
      faqs={faqs}
      notes={notes}
      heroImage="/images/slideshow_placeholder.jpg"
    />
  );
}
