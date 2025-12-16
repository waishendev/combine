import Link from "next/link";
import Image from "next/image";

interface WhatsappButtonProps {
  phone?: string | null;
  defaultMessage?: string | null;
  enabled?: boolean;
}

export default function WhatsappButton({ phone, defaultMessage, enabled = true }: WhatsappButtonProps) {
  if (!enabled || !phone) return null;

  const sanitizedPhone = phone.replace(/[^\d]/g, "");
  const message = defaultMessage ?? "Hi! I have a question about your products.";
  const url = `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(message)}`;

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <Link
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block transition-transform hover:scale-110"
        aria-label="Chat with us on WhatsApp"
      >
        <Image
          src="/images/whatapps-icon.webp"
          alt="WhatsApp"
          width={60}
          height={60}
          className="rounded-full shadow-lg"
        />
      </Link>
    </div>
  );
}
