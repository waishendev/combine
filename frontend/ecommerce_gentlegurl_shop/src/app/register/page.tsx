import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#fff5f9] via-white to-[#f1eaff]">
      <div className="pointer-events-none absolute -right-10 -top-16 h-80 w-80 rounded-full bg-[var(--accent)]/18 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 rounded-full bg-[var(--accent-strong)]/15 blur-3xl" />

      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-16">
        <div className="grid w-full gap-8 rounded-3xl bg-white/70 p-10 shadow-[0_18px_70px_rgba(0,0,0,0.08)] backdrop-blur md:grid-cols-5">
          <div className="md:col-span-2">
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--foreground)]/60">New here?</p>
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">Create your Gentlegurl profile</h1>
            <p className="mt-4 text-sm leading-relaxed text-[var(--foreground)]/70">
              Build a beautiful beauty routine with curated products, personalized services, and members-only rewards that grow
              with you.
            </p>
            <div className="mt-8 grid gap-3 text-sm text-[var(--foreground)]/80">
              <div className="flex items-center gap-3 rounded-2xl bg-[var(--muted)]/60 p-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[var(--accent)]">●</span>
                <span>Priority booking for salon services and courses.</span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-[var(--muted)]/60 p-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[var(--accent)]">●</span>
                <span>Earn points every time you shop, redeem for exclusive treats.</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-3">
            <div className="rounded-2xl border border-white/70 bg-white/80 p-8 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
              <RegisterForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
