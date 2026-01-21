"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LoadingOverlay from "@/components/LoadingOverlay";
import { resetCustomerPassword } from "@/lib/apiClient";
import { extractApiError } from "@/lib/auth/redirect";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const missingParams = useMemo(() => !token || !email, [token, email]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!token || !email) {
      setError("Reset link is missing required information.");
      return;
    }
    setSubmitting(true);
    try {
      await resetCustomerPassword({
        email,
        token,
        password,
        password_confirmation: confirmation,
      });
      router.replace("/login?reset=1");
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <LoadingOverlay show={submitting} message="Updating password..." />
      <div className="min-h-[70vh]">
        <div className="relative mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-4 py-14">
          <div className="w-full max-w-md">
            <div className="mb-6 text-center">
              <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
                Reset password
              </h1>
              <p className="mt-2 text-sm text-[var(--foreground)]/70">
                Choose a new password to access your account.
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--card-border)]/60 bg-[var(--card)]/80 p-7 shadow-[0_12px_40px_-24px_rgba(var(--accent-rgb),0.25)] backdrop-blur-sm md:p-8">
              {missingParams ? (
                <div className="rounded-xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-sm text-[color:var(--status-error)]">
                  Reset link is invalid or missing.
                </div>
              ) : null}

              {error ? (
                <div className="mt-4 rounded-xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-sm text-[color:var(--status-error)]">
                  {error}
                </div>
              ) : null}

              <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[var(--foreground)]/80" htmlFor="password">
                    New password
                  </label>
                  <input
                    id="password"
                    type="password"
                    className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]/25"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[var(--foreground)]/80" htmlFor="password_confirmation">
                    Confirm password
                  </label>
                  <input
                    id="password_confirmation"
                    type="password"
                    className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]/25"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={missingParams || !password || !confirmation || submitting}
                  className="mt-2 w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Saving..." : "Update password"}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-[var(--foreground)]/70">
                <Link className="font-medium text-[var(--accent-strong)] hover:opacity-80" href="/login">
                  Back to login →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
