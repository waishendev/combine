import { ServicesPageLayout } from "@/components/services/ServicesPageLayout";
import { getHomepage } from "@/lib/server/getHomepage";

const services = [
  { title: "Waxing (Upper Body)", description: "Arms, underarm, back, chest, and stomach options with smooth results." },
  { title: "Waxing (Lower Body)", description: "Lower leg to full leg services for a polished, even finish." },
  { title: "Waxing (Bikini)", description: "Bikini line, clipping, and Brazilian options available." },
  { title: "Waxing (Face)", description: "Eyebrow, lip, chin, jawline, and full-face services." },
  { title: "810 Laser Ice Hair Removal", description: "Armpit, full arm, and full leg packages with session options." },
  { title: "Keratin Lash Lift", description: "Lifted, curled lashes with a clean, natural finish." },
];

const pricing = [
  { label: "Waxing - Upper Body: Under Arm (Armpit)", price: "RM 48" },
  { label: "Waxing - Upper Body: Lower Arm", price: "RM 68" },
  { label: "Waxing - Upper Body: Upper Arm or 3/4 Arm", price: "RM 88" },
  { label: "Waxing - Upper Body: Full Arm", price: "RM 108" },
  { label: "Waxing - Upper Body: Under Arm (Armpit) + Full Arm", price: "RM 168" },
  { label: "Waxing - Upper Body: Full Back and Shoulder", price: "RM 78" },
  { label: "Waxing - Upper Body: Chest and Stomach", price: "RM 78" },
  { label: "Waxing - Upper Body: Stomach", price: "RM 48" },
  { label: "Waxing - Lower Body: Lower Leg", price: "RM 68" },
  { label: "Waxing - Lower Body: Upper Leg or 3/4 Leg", price: "RM 118" },
  { label: "Waxing - Lower Body: Full Leg", price: "RM 148" },
  { label: "Waxing - Bikini: Bikini Line", price: "RM 78" },
  { label: "Waxing - Bikini: Bikini Line and Clipping", price: "RM 88" },
  { label: "Waxing - Bikini: Brazilian XXX (All Off)", price: "RM 198" },
  { label: "Waxing - Bikini: Brazilian Triangle or Line", price: "RM 178" },
  { label: "Waxing - Face: Eyebrow", price: "RM 38" },
  { label: "Waxing - Face: Forehead", price: "RM 38" },
  { label: "Waxing - Face: Cheeks", price: "RM 48" },
  { label: "Waxing - Face: Sideburn", price: "RM 38" },
  { label: "Waxing - Face: Lip", price: "RM 38" },
  { label: "Waxing - Face: Chin", price: "RM 48" },
  { label: "Waxing - Face: Lip and Chin", price: "RM 78" },
  { label: "Waxing - Face: Jaw Lines", price: "RM 38" },
  { label: "Waxing - Face: Neck", price: "RM 48" },
  { label: "Waxing - Face: Full Face", price: "RM 198" },
  { label: "810 Laser Ice Hair Removal (Armpit) - Single Session", price: "RM 68" },
  { label: "810 Laser Ice Hair Removal (Armpit) - Monthly Package", price: "RM 138" },
  { label: "810 Laser Ice Hair Removal (Armpit) - Yearly Package", price: "RM 488" },
  { label: "810 Laser Ice Hair Removal (Full Arm) - Single Session", price: "RM 88" },
  { label: "810 Laser Ice Hair Removal (Full Arm) - Monthly Package", price: "RM 168" },
  { label: "810 Laser Ice Hair Removal (Full Arm) - Yearly Package", price: "RM 888" },
  { label: "810 Laser Ice Hair Removal (Full Leg) - Single Session", price: "RM 118" },
  { label: "810 Laser Ice Hair Removal (Full Leg) - Monthly Package", price: "RM 248" },
  { label: "810 Laser Ice Hair Removal (Full Leg) - Yearly Package", price: "RM 1188" },
  { label: "Keratin Lash Lift", price: "RM 108" },
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
  "Subject to technician availability.",
];

export default async function WaxingHairRemovalPage() {
  const homepage = await getHomepage();
  const whatsapp = homepage?.contact?.whatsapp;

  return (
    <ServicesPageLayout
      title="Waxing & Hair Removal"
      subtitle="Gentle, clean hair removal with smooth results — comfort-first, always."
      services={services}
      pricing={pricing}
      faqs={faqs}
      notes={notes}
      heroSlides={[
        { src: "/images/CUSTOMERGIVE/Waxing.jpeg", alt: "Waxing service highlight" },
        { src: "/images/CUSTOMERGIVE/810 Laser Ice Hair Removal.jpeg", alt: "Laser hair removal highlight" },
      ]}
      whatsappPhone={whatsapp?.phone ?? null}
      whatsappEnabled={whatsapp?.enabled ?? false}
      whatsappDefaultMessage={whatsapp?.default_message ?? null}
    />
  );
}
