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
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";
  const hasParams = token.length > 0 && email.length > 0;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = useMemo(() => {
    if (!password || !confirmPassword) return false;
    return password !== confirmPassword;
  }, [password, confirmPassword]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await resetCustomerPassword({
        email,
        token,
        password,
        password_confirmation: confirmPassword,
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
                Choose a new password for your account.
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--card-border)]/60 bg-[var(--card)]/80 p-7 shadow-[0_12px_40px_-24px_rgba(var(--accent-rgb),0.25)] backdrop-blur-sm md:p-8">
              {!hasParams ? (
                <div className="rounded-xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-sm text-[color:var(--status-error)]">
                  Reset link is missing or invalid. Please request a new reset link.
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
                      "opacity-70",
                    ].join(" ")}
                    value={email}
                    readOnly
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[var(--foreground)]/80" htmlFor="password">
                    New password
                  </label>
                  <input
                    id="password"
                    type="password"
                    className={[
                      "w-full rounded-xl border bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--foreground)]",
                      "border-[var(--input-border)]",
                      "focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]/25",
                      "ios-input",
                    ].join(" ")}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                    disabled={!hasParams}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    className="text-sm font-medium text-[var(--foreground)]/80"
                    htmlFor="password_confirmation"
                  >
                    Confirm password
                  </label>
                  <input
                    id="password_confirmation"
                    type="password"
                    className={[
                      "w-full rounded-xl border bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--foreground)]",
                      "border-[var(--input-border)]",
                      "focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]/25",
                      "ios-input",
                    ].join(" ")}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                    disabled={!hasParams}
                  />
                </div>

                {mismatch ? (
                  <p className="text-xs text-[var(--accent-stronger)]">
                    Passwords do not match.
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting || mismatch || !hasParams}
                  className={[
                    "w-full rounded-xl px-4 py-2.5 text-sm font-medium text-white transition",
                    "bg-[var(--accent)] hover:bg-[var(--accent-strong)]",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                  ].join(" ")}
                >
                  {submitting ? "Updating..." : "Update password"}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-[var(--foreground)]/70">
                Need help?{" "}
                <Link href="/forgot-password" className="font-medium text-[var(--accent-strong)] hover:opacity-80">
                  Request a new link
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
