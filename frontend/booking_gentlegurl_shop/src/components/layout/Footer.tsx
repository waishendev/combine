export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-neutral-600 md:grid-cols-3">
        <div>
          <p className="font-semibold text-black">GentleGurls Booking</p>
          <p className="mt-2">Premium salon experiences with trusted stylists.</p>
        </div>
        <div>
          <p className="font-semibold text-black">Location</p>
          <p className="mt-2">Bangsar, Kuala Lumpur</p>
          <p>Mon-Sun: 10:00 - 21:00</p>
        </div>
        <div>
          <p className="font-semibold text-black">Contact</p>
          <p className="mt-2">hello@gentlegurls.com</p>
          <p>+60 11-1234 5678</p>
        </div>
      </div>
    </footer>
  );
}
