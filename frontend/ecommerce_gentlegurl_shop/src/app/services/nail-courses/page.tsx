import { ServicesPageLayout } from "@/components/services/ServicesPageLayout";

const services = [
  { title: "Nail Anatomy & Hygiene", description: "Tool knowledge, safety, and sanitation fundamentals for confident work." },
  { title: "Prep & Foundation", description: "Shaping, cuticle care, and balanced base structure for lasting wear." },
  { title: "Gel Application", description: "Smooth layers, proper curing, and durability techniques." },
  { title: "Simple Nail Art", description: "Lines, dots, gradients, and stickers to build creative control." },
  { title: "Client Handling", description: "Consultations, maintenance tips, and setting expectations." },
  { title: "Portfolio Guidance", description: "Photo tips, service checklist, and how to showcase your work." },
];

const pricing = [
  { label: "Starter Workshop (1 day)", price: "RM 299" },
  { label: "Foundations Course (2 days)", price: "RM 549" },
  { label: "Nail Art Essentials (1 day)", price: "RM 399" },
  { label: "Private Coaching (per hour)", price: "RM 180" },
];

const faqs = [
  { question: "Do I need experience?", answer: "No prior experience needed—our courses are beginner-friendly with step-by-step demos." },
  { question: "Do you provide tools/materials?", answer: "Yes, core tools and products are provided unless specified. Feel free to bring favorites." },
  { question: "Will I receive a certificate?", answer: "Participants receive a gentle completion certificate; keep practicing to build your portfolio." },
  { question: "Can I bring my own model?", answer: "Yes, you can bring a model for hands-on practice. Let us know so we can schedule time." },
  { question: "What if I miss a session?", answer: "Reach out early—make-up options depend on schedule availability and upcoming intakes." },
];

const notes = [
  "Seats are limited to ensure hands-on guidance.",
  "Bring a notepad; materials are provided unless stated.",
  "Booking deposit may be required for courses (future integration ok).",
  "Practice and consistency are key — we’ll guide your next steps.",
];

export default function NailCoursesPage() {
  return (
    <ServicesPageLayout
      title="Nail Courses"
      subtitle="Learn the fundamentals of nail care & design — beginner-friendly, hands-on practice."
      services={services}
      pricing={pricing}
      faqs={faqs}
      notes={notes}
      heroImage="/images/slideshow_placeholder.jpg"
    />
  );
}
