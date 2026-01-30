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
    <div className="
  fixed z-50
  right-4
  bottom-24        // mobile
  md:bottom-6      // desktop
">
      <Link
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block transition-transform hover:scale-110"
        aria-label="Chat with us on WhatsApp"
      >
        <Image
          src="/images/whatapps-icon2.png"
          alt="WhatsApp"
          width={70}
          height={70}
        />
      </Link>
    </div>
  );
}
