"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import LoadingOverlay from "@/components/LoadingOverlay";
import { forgotCustomerPassword, resendCustomerVerification } from "@/lib/apiClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setVerificationMessage(null);
    setResendMessage(null);
    try {
      const response = await forgotCustomerPassword({ email });
      setMessage(response.message ?? "If the email exists, we sent a reset link.");
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "data" in err) {
        const data = (err as { data?: { code?: string; message?: string } }).data;
        if (data?.code === "EMAIL_NOT_VERIFIED") {
          setVerificationMessage(data.message ?? "Please verify your email before resetting your password.");
          return;
        }
      }
      setMessage("If the email exists, we sent a reset link.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim()) {
      setResendMessage("Enter your email above so we can resend the verification link.");
      return;
    }
    setResending(true);
    setResendMessage(null);
    try {
      const response = await resendCustomerVerification({ email });
      setResendMessage(response.message ?? " We have resend a verification link.");
    } catch {
      setResendMessage("We couldn't resend the email just now. Please try again.");
    } finally {
      setResending(false);
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
                Enter your email to receive a reset link.
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--card-border)]/60 bg-[var(--card)]/80 p-7 shadow-[0_12px_40px_-24px_rgba(var(--accent-rgb),0.25)] backdrop-blur-sm md:p-8">
              {verificationMessage ? (
                <div className="mb-4 rounded-xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-sm text-[color:var(--status-error)]">
                  <p>{verificationMessage}</p>
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resending}
                    className="w-full rounded-lg mt-2 border border-[var(--status-error-border)] px-3 py-2 text-xs font-medium text-[color:var(--status-error)] transition hover:border-[var(--error)] hover:text-[var(--accent-error)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {resending ? "Resending..." : "Resend verification email"}
                  </button>
                  {resendMessage ? (
                    <div className="mt-2 rounded-lg border border-[var(--card-border)]/60 bg-[var(--background-soft)] px-3 py-2 text-xs text-[var(--foreground)]/70">
                      {resendMessage}
                    </div>
                  ) : null}
                </div>
              ) : message ? (
                <div className="mb-4 rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-3 py-2 text-sm text-[color:var(--status-info)]">
                  {message}
                </div>
              ) : null}

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[var(--foreground)]/80" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    className="w-full mt-2 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]/25"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={!email.trim() || submitting}
                  className="mt-2 w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Sending..." : "Send reset link"}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-[var(--foreground)]/70">
                Remembered your password?{" "}
                <Link className="font-medium text-[var(--accent-strong)] hover:opacity-80" href="/login">
                  Sign in →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
