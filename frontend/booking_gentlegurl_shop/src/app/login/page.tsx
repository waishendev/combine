"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") || "/booking";
  const { login, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      setError(null);
      await login(String(form.get("email")), String(form.get("password")));
      router.push(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-semibold">Welcome back</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-3xl border border-neutral-200 p-6">
        <input name="email" type="email" required placeholder="Email" className="w-full rounded-xl border px-4 py-2" />
        <input name="password" type="password" required placeholder="Password" className="w-full rounded-xl border px-4 py-2" />
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        <button disabled={loading} className="w-full rounded-full bg-black py-3 text-white">{loading ? "Signing in..." : "Login"}</button>
      </form>
      <p className="mt-4 text-sm text-neutral-600">No account? <Link href="/register" className="text-black">Create one</Link></p>
    </main>
  );
}
