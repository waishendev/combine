"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function RegisterPage() {
  const router = useRouter();
  const { register, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name")),
      email: String(form.get("email")),
      phone: String(form.get("phone")),
      password: String(form.get("password")),
      password_confirmation: String(form.get("password_confirmation")),
    };

    try {
      setError(null);
      await register(payload);
      router.push("/login?redirect=/booking");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-semibold">Create account</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-3xl border border-[var(--card-border)] bg-[var(--card)] p-6">
        <input name="name" required placeholder="Full name" className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2" />
        <input name="email" type="email" required placeholder="Email" className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2" />
        <input name="phone" required placeholder="Phone" className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2" />
        <input name="password" type="password" required placeholder="Password" className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2" />
        <input name="password_confirmation" type="password" required placeholder="Confirm password" className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2" />
        {error ? <p className="text-sm text-[var(--status-error)]">{error}</p> : null}
        <button disabled={loading} className="w-full rounded-full bg-[var(--accent-strong)] py-3 text-white hover:bg-[var(--accent-stronger)] transition-colors disabled:opacity-50">{loading ? "Creating..." : "Register"}</button>
      </form>
      <p className="mt-4 text-sm text-[var(--text-muted)]">Already have an account? <Link href="/login" className="text-[var(--foreground)]">Login</Link></p>
    </main>
  );
}
