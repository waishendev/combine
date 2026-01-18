"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { useAuth } from "@/contexts/AuthContext";
import { getSafeRedirect } from "@/lib/auth/redirect";
import LoadingOverlay from "@/components/LoadingOverlay";
import { resendCustomerVerificationEmail } from "@/lib/apiClient";

export default function RegisterPage() {
  const { customer } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  const redirectTarget = useMemo(() => {
    const target = getSafeRedirect(searchParams.get("redirect"));
    if (!target) return null;
    const pathOnly = target.split("?")[0]?.split("#")[0];
    if (pathOnly === "/login" || pathOnly === "/register") return null;
    return target;
  }, [searchParams]);

  const loginHref = useMemo(() => {
    if (!redirectTarget) return "/login";
    return `/login?redirect=${encodeURIComponent(redirectTarget)}`;
  }, [redirectTarget]);

  useEffect(() => {
    if (customer && !isRedirecting) {
      setIsSubmitting(false); // Reset form submission state
      setIsRedirecting(true);
      router.replace(redirectTarget ?? "/");
    }
  }, [customer, redirectTarget, router, isRedirecting]);

  return (
    <>
      <LoadingOverlay show={isSubmitting || isRedirecting} message="Creating account..." />
      <div className="min-h-[70vh]">
      <div className="relative mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-4 py-14">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
              {successEmail ? "Account created" : "Create your account"}
            </h1>
            <p className="mt-2 text-sm text-[var(--foreground)]/70">
              {successEmail
                ? `We’ve sent a verification email to ${successEmail}. Please verify to continue.`
                : "Join to save favorites, track orders, and checkout faster."}
            </p>
          </div>

          {/* Card */}
        <div className="rounded-3xl border border-[var(--card-border)]/60 bg-[var(--card)]/80 p-7 shadow-[0_12px_40px_-24px_rgba(var(--accent-rgb),0.25)] backdrop-blur-sm md:p-8">
            {successEmail ? (
              <div className="space-y-5 text-center">
                <p className="text-sm text-[var(--foreground)]/70">
                  Check your Spam or Promotions folders if you don&apos;t see the email.
                </p>
                {resendMessage ? (
                  <div className="rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-3 py-2 text-sm text-[color:var(--status-info)]">
                    {resendMessage}
                  </div>
                ) : null}
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!successEmail) return;
                      setIsResending(true);
                      setResendMessage(null);
                      try {
                        await resendCustomerVerificationEmail(successEmail);
                        setResendMessage("If the email exists, we sent a verification email.");
                      } catch {
                        setResendMessage("We could not resend right now. Please try again soon.");
                      } finally {
                        setIsResending(false);
                      }
                    }}
                    disabled={isResending}
                    className={[
                      "w-full rounded-xl border px-4 py-2.5 text-sm font-medium transition",
                      "border-[var(--input-border)] text-[var(--foreground)] hover:border-[var(--accent)]",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                    ].join(" ")}
                  >
                    {isResending ? "Resending..." : "Resend verification email"}
                  </button>
                  <Link
                    href="/login?registered=1"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
                  >
                    Go to Login
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <RegisterForm
                  onSubmittingChange={setIsSubmitting}
                  onSuccess={(email) => {
                    setSuccessEmail(email);
                    setResendMessage(null);
                  }}
                />

            <div className="mt-6 text-center text-sm text-[var(--foreground)]/70">
              Already have an account?{" "}
              <Link
                href={loginHref}
                className="font-medium text-[var(--accent-strong)] hover:opacity-80"
              >
                Sign in →
              </Link>
            </div>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-[var(--foreground)]/55">
            By creating an account, you agree to our{" "}
            <Link className="underline hover:opacity-80" href="/terms">
              Terms
            </Link>{" "}
            and{" "}
            <Link className="underline hover:opacity-80" href="/privacy-policy">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
