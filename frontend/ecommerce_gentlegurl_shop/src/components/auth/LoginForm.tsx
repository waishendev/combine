"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await login(email, password);
      router.refresh();
      router.push("/account");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-5 text-[var(--foreground)]" onSubmit={handleSubmit}>
      {error && (
        <div className="rounded bg-[var(--muted)] px-3 py-2 text-sm text-[#b8527a]">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--foreground)]/80" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="w-full rounded-xl border border-white/70 bg-white/80 px-4 py-3 text-sm shadow-[0_8px_24px_rgba(0,0,0,0.05)] transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--foreground)]/80" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="w-full rounded-xl border border-white/70 bg-white/80 px-4 py-3 text-sm shadow-[0_8px_24px_rgba(0,0,0,0.05)] transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-gradient-to-r from-[var(--accent)] via-[#d0699d] to-[var(--accent-strong)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(191,82,122,0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_42px_rgba(191,82,122,0.55)] disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
      >
        {submitting ? "Signing in..." : "Login"}
      </button>
    </form>
  );
}
