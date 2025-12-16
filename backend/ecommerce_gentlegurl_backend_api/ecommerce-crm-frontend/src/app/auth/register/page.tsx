"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/account";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const password = String(formData.get("password") || "").trim();
    const password_confirmation = String(formData.get("password_confirmation") || "").trim();
    setLoading(true);
    try {
      await register({ name, email, password, password_confirmation, phone });
      router.push(returnTo);
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex justify-center px-4 py-10">
      <div className="w-full max-w-[480px] rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Create account</h1>
        <p className="text-sm text-slate-600">Register to check out faster and track your orders.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2 text-sm">
            <label className="block font-semibold">Name</label>
            <input name="name" className="w-full rounded border px-3 py-2" required />
          </div>
          <div className="space-y-2 text-sm">
            <label className="block font-semibold">Email</label>
            <input name="email" type="email" className="w-full rounded border px-3 py-2" required />
          </div>
          <div className="space-y-2 text-sm">
            <label className="block font-semibold">Phone (optional)</label>
            <input name="phone" className="w-full rounded border px-3 py-2" />
          </div>
          <div className="space-y-2 text-sm">
            <label className="block font-semibold">Password</label>
            <input name="password" type="password" className="w-full rounded border px-3 py-2" required />
          </div>
          <div className="space-y-2 text-sm">
            <label className="block font-semibold">Confirm Password</label>
            <input name="password_confirmation" type="password" className="w-full rounded border px-3 py-2" required />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-700">
          Already have an account?{" "}
          <Link href={`/auth/login?returnTo=${encodeURIComponent(returnTo)}`} className="text-blue-600 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
