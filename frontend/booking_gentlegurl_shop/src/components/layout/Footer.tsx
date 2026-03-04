import type { HomepageFooter } from "@/lib/serverHomepage";

export function Footer({ footer }: { footer?: HomepageFooter | null }) {
  if (!footer || footer.enabled === false) return null;

  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-neutral-600 md:grid-cols-3">
        <div>
          <p className="font-semibold text-black">GentleGurls Booking</p>
          {footer.about_text ? (
            <p className="mt-2">{footer.about_text}</p>
          ) : (
            <p className="mt-2">Premium salon experiences with trusted stylists.</p>
          )}
        </div>
        <div>
          <p className="font-semibold text-black">Location</p>
          <p className="mt-2">{footer.contact?.address ?? "Bangsar, Kuala Lumpur"}</p>
        </div>
        <div>
          <p className="font-semibold text-black">Contact</p>
          {footer.contact?.email && <p className="mt-2">{footer.contact.email}</p>}
          {footer.contact?.whatsapp && <p>{footer.contact.whatsapp}</p>}
        </div>
      </div>
    </footer>
  );
}
