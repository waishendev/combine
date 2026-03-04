import Link from "next/link";

type Props = {
  enabled?: boolean;
  phone?: string | null;
  defaultMessage?: string | null;
};

export function WhatsappButton({ enabled = false, phone, defaultMessage }: Props) {
  if (!enabled || !phone) return null;
  const sanitizedPhone = phone.replace(/[^\d]/g, "");
  const message = defaultMessage ?? "Hi! I would like to make a booking.";
  const url = `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(message)}`;

  return (
    <div className="fixed z-50 right-4 bottom-24 md:bottom-6">
      <Link
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105"
        aria-label="Chat with us on WhatsApp"
      >
        <i className="fa-brands fa-whatsapp text-3xl" />
      </Link>
    </div>
  );
}
