"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/account";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "").trim();
    setLoading(true);
    try {
      await login(email, password);
      router.push(returnTo);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex justify-center px-4 py-10">
      <div className="w-full max-w-[480px] rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Login</h1>
        <p className="text-sm text-slate-600">Sign in to manage your orders and rewards.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2 text-sm">
            <label className="block font-semibold">Email</label>
            <input name="email" type="email" className="w-full rounded border px-3 py-2" required />
          </div>
          <div className="space-y-2 text-sm">
            <label className="block font-semibold">Password</label>
            <input name="password" type="password" className="w-full rounded border px-3 py-2" required />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-700">
          New customer?{" "}
          <Link href={`/auth/register?returnTo=${encodeURIComponent(returnTo)}`} className="text-blue-600 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
