import { ServicesPageLayout } from "@/components/services/ServicesPageLayout";

const services = [
  { title: "Brow Shaping", description: "Tidy, define, and balance your brows for a clean frame." },
  { title: "Upper Lip / Chin", description: "Quick, precise removal to soften facial hair visibility." },
  { title: "Underarm Wax", description: "Comfort-focused wax for a smooth, longer-lasting finish." },
  { title: "Half Arm / Full Arm", description: "Even, polished texture from shoulder to wrist." },
  { title: "Half Leg / Full Leg", description: "Soft, polished legs with an even glide." },
  { title: "Bikini Line", description: "Neat, comfortable shaping with hygiene-first care." },
];

const pricing = [
  { label: "Brow Shaping", price: "RM 25" },
  { label: "Upper Lip", price: "RM 15" },
  { label: "Underarm", price: "RM 25" },
  { label: "Half Arm", price: "RM 35" },
  { label: "Full Arm", price: "RM 55" },
  { label: "Half Leg", price: "RM 45" },
  { label: "Full Leg", price: "RM 75" },
  { label: "Bikini Line", price: "RM 45" },
];

const faqs = [
  { question: "Does waxing hurt?", answer: "You may feel a quick sting, but we use gentle wax and calming care to keep you comfortable." },
  { question: "How long will results last?", answer: "Results typically last 2–4 weeks depending on your growth cycle and aftercare." },
  { question: "What hair length is best?", answer: "Around a grain-of-rice length (about 0.5cm) helps wax grip well without tugging." },
  { question: "Can I wax during sensitive skin days?", answer: "If your skin is irritated or you are on sensitive days, let us know—we can reschedule or proceed gently." },
  { question: "What aftercare should I follow?", answer: "Avoid heat, sauna, swimming, or tight clothing for 24 hours and moisturize with gentle products." },
];

const notes = [
  "Avoid exfoliating 24 hours before.",
  "Avoid sauna/sun exposure 24 hours after.",
  "We use hygiene-first single-use practices where applicable.",
  "If you’re using retinoids, please inform us before booking.",
];

export default function WaxingHairRemovalPage() {
  return (
    <ServicesPageLayout
      title="Waxing & Hair Removal"
      subtitle="Gentle, clean hair removal with smooth results — comfort-first, always."
      services={services}
      pricing={pricing}
      faqs={faqs}
      notes={notes}
    />
  );
}
