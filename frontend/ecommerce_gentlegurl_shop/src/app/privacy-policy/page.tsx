export default function PrivacyPolicyPage() {
  return (
    <main className="bg-gradient-to-b from-transparent via-[var(--card)]/60 to-transparent pb-16">
      <div className="mx-auto max-w-4xl space-y-10 px-4 pt-10 sm:px-6 lg:px-8">
        <header className="space-y-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--accent-strong)]">
            Customer Care
          </p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)] sm:text-4xl">
            Gentlegurls Privacy Policy
          </h1>
          <p className="text-sm text-[color:var(--text-muted)] sm:text-base">
            This Privacy Policy explains how Gentlegurls collects, uses, and protects your personal information when you
            shop with us.
          </p>
        </header>

        <section className="grid gap-6">
          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.5)] backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Collected Information</h2>
            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              We only collect the information that is needed for account registration and order processing on our website.
              The information we gather is voluntarily submitted by customers when registering or placing an order.
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.5)] backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Personal Identification Details</h2>
            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              Your personal details are used to process cosmetic product orders, customize your profile information, comply
              with legal requirements, update order status, and share relevant updates, promotions, and events from
              Gentlegurls.
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.5)] backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Payment Information</h2>
            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              Gentlegurls accepts payments via BILPLZ and manual bank transfer. We do not store your full card or banking
              details on our servers. Payment information is handled through secure payment channels.
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.5)] backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Confidentiality</h2>
            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              Your personal information is kept confidential with us. We do not share your details with third parties
              without your consent, except when required by law or to fulfill your order.
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.5)] backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Security</h2>
            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              We apply appropriate security measures to protect customer data from unauthorized access, illegal disclosure,
              and misuse. However, please note that information transmitted over the internet cannot be guaranteed 100%
              secure.
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.5)] backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Changes to Our Privacy Policy</h2>
            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              Gentlegurls may update this Privacy Policy from time to time without prior notice. Please revisit this page
              to stay informed of any changes.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
