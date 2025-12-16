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
    <form className="space-y-4 text-[var(--foreground)]" onSubmit={handleSubmit}>
      {error && (
        <div className="rounded bg-[var(--muted)] px-3 py-2 text-sm text-[#b8527a]">
          {error}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-sm text-[var(--foreground)]/80" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="w-full rounded border border-[var(--muted)] bg-white/70 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm text-[var(--foreground)]/80" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="w-full rounded border border-[var(--muted)] bg-white/70 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-[var(--accent)] px-4 py-2 text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
      >
        {submitting ? "Signing in..." : "Login"}
      </button>
    </form>
  );
}
