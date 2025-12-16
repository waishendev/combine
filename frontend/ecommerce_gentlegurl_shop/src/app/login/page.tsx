import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#fff5f9] via-white to-[#f1eaff]">
      <div className="pointer-events-none absolute -left-16 -top-16 h-72 w-72 rounded-full bg-[var(--accent)]/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 right-0 h-64 w-64 rounded-full bg-[var(--accent-strong)]/15 blur-3xl" />

      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-16">
        <div className="grid w-full gap-8 rounded-3xl bg-white/70 p-10 shadow-[0_18px_70px_rgba(0,0,0,0.08)] backdrop-blur md:grid-cols-5">
          <div className="md:col-span-2">
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--foreground)]/60">Welcome back</p>
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">Log in to your Gentlegurl account</h1>
            <p className="mt-4 text-sm leading-relaxed text-[var(--foreground)]/70">
              Access your orders, wishlist, rewards, and tailored beauty recommendations. We keep your experience calm, elegant,
              and secure.
            </p>
            <div className="mt-8 grid gap-3 text-sm text-[var(--foreground)]/80">
              <div className="flex items-center gap-3 rounded-2xl bg-[var(--muted)]/60 p-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[var(--accent)]">●</span>
                <span>Seamless checkout across all your devices.</span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-[var(--muted)]/60 p-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[var(--accent)]">●</span>
                <span>Earn loyalty perks crafted for modern beauty lovers.</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-3">
            <div className="rounded-2xl border border-white/70 bg-white/80 p-8 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
              <LoginForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
