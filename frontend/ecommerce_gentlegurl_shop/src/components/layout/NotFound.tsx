import Link from "next/link";

export function NotFound() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 text-[var(--foreground)]">
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-[var(--muted)]">404</h1>
          <h2 className="mt-4 text-3xl font-semibold text-[var(--foreground)]">Page Not Found</h2>
          <p className="mt-4 text-[var(--foreground)]/70">
            Sorry, we couldn&apos;t find the page you&apos;re looking for.
          </p>
        </div>

        <div className="mt-8 flex gap-4">
          <Link
            href="/"
            className="rounded-full bg-[var(--accent)] px-6 py-3 text-white transition hover:bg-[var(--accent-strong)]"
          >
            Go Home
          </Link>
          <Link
            href="/shop"
            className="rounded-full border border-[var(--accent)] px-6 py-3 text-[var(--foreground)] transition hover:border-[var(--accent-strong)] hover:bg-[var(--muted)]/60"
          >
            Browse Shop
          </Link>
        </div>
      </div>
    </main>
  );
}

