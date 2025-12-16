import Link from "next/link";

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
        className="group inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-[#25D366] to-[#128C7E] px-4 py-3 text-white shadow-xl shadow-[#25D366]/35 transition hover:-translate-y-0.5 hover:shadow-2xl"
        aria-label="Chat with us on WhatsApp"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl font-semibold leading-none shadow-inner shadow-black/10">💬</span>
        <div className="flex flex-col text-left text-sm leading-tight">
          <span className="text-xs uppercase tracking-[0.18em] text-white/80">WhatsApp</span>
          <span className="font-semibold">Chat with us</span>
        </div>
      </Link>
    </div>
  );
}
