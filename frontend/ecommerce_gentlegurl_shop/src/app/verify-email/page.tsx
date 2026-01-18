"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import LoadingOverlay from "@/components/LoadingOverlay";
import { resendCustomerVerificationEmail, verifyCustomerEmail } from "@/lib/apiClient";
import { extractApiError } from "@/lib/auth/redirect";

type VerificationState = "idle" | "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<VerificationState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const params = useMemo(() => {
    const id = searchParams.get("id");
    const hash = searchParams.get("hash");
    const expires = searchParams.get("expires");
    const signature = searchParams.get("signature");
    if (!id || !hash || !expires || !signature) return null;
    return { id, hash, expires, signature };
  }, [searchParams]);

  useEffect(() => {
    const runVerification = async () => {
      if (!params) {
        setState("error");
        setMessage("Verification link invalid or expired.");
        return;
      }

      setState("loading");
      setMessage(null);

      try {
        await verifyCustomerEmail(params);
        setState("success");
        setMessage("Email verified. You can login now.");
      } catch (err: unknown) {
        setState("error");
        setMessage(extractApiError(err) || "Verification link invalid or expired.");
      }
    };

    runVerification();
  }, [params]);

  return (
    <>
      <LoadingOverlay show={state === "loading"} message="Verifying email..." />
      <div className="min-h-[70vh]">
        <div className="relative mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-4 py-14">
          <div className="w-full max-w-md">
            <div className="mb-6 text-center">
              <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
                Email verification
              </h1>
              <p className="mt-2 text-sm text-[var(--foreground)]/70">
                {state === "success"
                  ? "Your email is verified."
                  : "We are checking your verification link."}
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--card-border)]/60 bg-[var(--card)]/80 p-7 shadow-[0_12px_40px_-24px_rgba(var(--accent-rgb),0.25)] backdrop-blur-sm md:p-8">
              {message ? (
                <div
                  className={[
                    "rounded-xl border px-3 py-2 text-sm",
                    state === "success"
                      ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[color:var(--status-success)]"
                      : "border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[color:var(--status-error)]",
                  ].join(" ")}
                >
                  {message}
                </div>
              ) : null}

              {state === "success" ? (
                <Link
                  href="/login"
                  className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
                >
                  Go to login
                </Link>
              ) : (
                <div className="mt-6 space-y-4">
                  <div className="space-y-1.5">
                    <label
                      className="text-sm font-medium text-[var(--foreground)]/80"
                      htmlFor="resend-email"
                    >
                      Email
                    </label>
                    <input
                      id="resend-email"
                      type="email"
                      className={[
                        "w-full rounded-xl border bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--foreground)]",
                        "border-[var(--input-border)]",
                        "focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]/25",
                        "ios-input",
                      ].join(" ")}
                      value={resendEmail}
                      onChange={(event) => setResendEmail(event.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>

                  {resendMessage ? (
                    <div className="rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-3 py-2 text-sm text-[color:var(--status-info)]">
                      {resendMessage}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    disabled={resending || resendEmail.trim().length === 0}
                    onClick={async () => {
                      setResending(true);
                      setResendMessage(null);
                      try {
                        await resendCustomerVerificationEmail(resendEmail.trim());
                        setResendMessage("If the email exists, we sent a verification email.");
                      } catch (err: unknown) {
                        setResendMessage(extractApiError(err));
                      } finally {
                        setResending(false);
                      }
                    }}
                    className={[
                      "w-full rounded-xl border px-4 py-2.5 text-sm font-medium transition",
                      "border-[var(--input-border)] text-[var(--foreground)] hover:border-[var(--accent)]",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                    ].join(" ")}
                  >
                    {resending ? "Resending..." : "Resend verification email"}
                  </button>

                  <Link
                    href="/login"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
                  >
                    Back to login
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
