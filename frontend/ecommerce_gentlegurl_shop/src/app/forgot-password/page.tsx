"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import LoadingOverlay from "@/components/LoadingOverlay";
import { requestCustomerPasswordReset } from "@/lib/apiClient";
import { extractApiError } from "@/lib/auth/redirect";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      await requestCustomerPasswordReset(email.trim());
      setMessage("If the email exists, we sent a reset link.");
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <LoadingOverlay show={submitting} message="Sending reset link..." />
      <div className="min-h-[70vh]">
        <div className="relative mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-4 py-14">
          <div className="w-full max-w-md">
            <div className="mb-6 text-center">
              <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
                Forgot password
              </h1>
              <p className="mt-2 text-sm text-[var(--foreground)]/70">
                Enter your email to receive a password reset link.
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--card-border)]/60 bg-[var(--card)]/80 p-7 shadow-[0_12px_40px_-24px_rgba(var(--accent-rgb),0.25)] backdrop-blur-sm md:p-8">
              {message ? (
                <div className="rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-2 text-sm text-[color:var(--status-success)]">
                  {message}
                </div>
              ) : null}
              {error ? (
                <div className="rounded-xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-sm text-[color:var(--status-error)]">
                  {error}
                </div>
              ) : null}

              <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[var(--foreground)]/80" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    className={[
                      "w-full rounded-xl border bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--foreground)]",
                      "border-[var(--input-border)]",
                      "focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]/25",
                      "ios-input",
                    ].join(" ")}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || email.trim().length === 0}
                  className={[
                    "w-full rounded-xl px-4 py-2.5 text-sm font-medium text-white transition",
                    "bg-[var(--accent)] hover:bg-[var(--accent-strong)]",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                  ].join(" ")}
                >
                  {submitting ? "Sending..." : "Send reset link"}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-[var(--foreground)]/70">
                Remembered your password?{" "}
                <Link href="/login" className="font-medium text-[var(--accent-strong)] hover:opacity-80">
                  Back to login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
