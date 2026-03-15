export default function ContactPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Contact</h1>
      <p className="mt-4 text-[var(--text-muted)]">Visit us in Bangsar, Kuala Lumpur or message us to discuss your next look.</p>
      <div className="mt-6 space-y-2 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6">
        <p>Email: hello@gentlegurls.com</p>
        <p>Phone: +60 11-1234 5678</p>
      </div>
    </main>
  );
}
