"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import LoadingOverlay from "@/components/LoadingOverlay";
import { verifyCustomerEmail } from "@/lib/apiClient";

type VerificationStatus = "idle" | "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<VerificationStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const payload = useMemo(() => {
    return {
      id: searchParams.get("id"),
      hash: searchParams.get("hash"),
      expires: searchParams.get("expires"),
      signature: searchParams.get("signature"),
    };
  }, [searchParams]);

  useEffect(() => {
    if (!payload.id || !payload.hash) {
      setStatus("error");
      setMessage("Verification link invalid or expired.");
      return;
    }

    const verify = async () => {
      setStatus("loading");
      try {
        const response = await verifyCustomerEmail({
          id: payload.id!,
          hash: payload.hash!,
          expires: payload.expires ?? undefined,
          signature: payload.signature ?? undefined,
        });
        setStatus("success");
        setMessage(response.message ?? "Email verified. You can login now.");
      } catch {
        setStatus("error");
        setMessage("Verification link invalid or expired.");
      }
    };

    verify();
  }, [payload]);

  return (
    <>
      <LoadingOverlay show={status === "loading"} message="Verifying email..." />
      <div className="min-h-[70vh]">
        <div className="relative mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-4 py-14">
          <div className="w-full max-w-md">
            <div className="mb-6 text-center">
              <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
                Email verification
              </h1>
              <p className="mt-2 text-sm text-[var(--foreground)]/70">
                {status === "success"
                  ? "Your email is ready to use."
                  : "We’re confirming your email address."}
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--card-border)]/60 bg-[var(--card)]/80 p-7 shadow-[0_12px_40px_-24px_rgba(var(--accent-rgb),0.25)] backdrop-blur-sm md:p-8">
              {message ? (
                <div
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    status === "success"
                      ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[color:var(--status-success)]"
                      : "border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[color:var(--status-error)]"
                  }`}
                >
                  {message}
                </div>
              ) : null}

              <div className="mt-6 space-y-3">
                {status === "success" ? (
                  <Link
                    href="/login"
                    className="block w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
                  >
                    Go to Login
                  </Link>
                ) : (
                  <Link
                    href="/login?resend=1"
                    className="block w-full rounded-xl border border-[var(--card-border)]/70 px-4 py-2.5 text-center text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                  >
                    Resend verification email
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
