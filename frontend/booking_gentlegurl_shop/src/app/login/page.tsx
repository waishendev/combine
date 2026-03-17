"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { useAuth } from "@/contexts/AuthContext";
import { getSafeRedirect } from "@/lib/auth/redirect";
import LoadingOverlay from "@/components/LoadingOverlay";

export default function LoginPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const reset = searchParams.get("reset") === "1";
  const resend = searchParams.get("resend") === "1";

  const bannerMessage = useMemo(() => {
    if (reset) {
      return "Password updated. Please login.";
    }
    if (resend) {
      return "Enter your email to resend the verification link.";
    }
    return null;
  }, [reset, resend]);

  const redirectTarget = useMemo(() => {
    const target = getSafeRedirect(searchParams.get("redirect"));
    if (!target) return null;
    const pathOnly = target.split("?")[0]?.split("#")[0];
    if (pathOnly === "/login" || pathOnly === "/register") return null;
    return target;
  }, [searchParams]);

  useEffect(() => {
    if (user && !isRedirecting) {
      setIsSubmitting(false);
      setIsRedirecting(true);
      router.replace(redirectTarget ?? "/booking");
    }
  }, [user, redirectTarget, router, isRedirecting]);

  return (
    <>
      <LoadingOverlay show={isSubmitting || isRedirecting} message="Signing in..." />
      <div className="min-h-[80vh]">
        <div className="relative mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-4 py-14">
          <div className="w-full max-w-md">
            <div className="mb-6 text-center">
              <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">Welcome back</h1>
              <p className="mt-2 text-sm text-[var(--foreground)]/70">
                Sign in to manage bookings, view history, and checkout faster.
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--card-border)]/60 bg-[var(--card)]/80 p-7 shadow-[0_12px_40px_-24px_rgba(var(--accent-rgb),0.25)] backdrop-blur-sm md:p-8">
              {bannerMessage ? (
                <div className="mb-4 rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-3 py-2 text-sm text-[color:var(--status-info)]">
                  {bannerMessage}
                </div>
              ) : null}
              <LoginForm redirectTarget={redirectTarget} onSubmittingChange={setIsSubmitting} />
            </div>

            <p className="mt-6 text-center text-xs text-[var(--foreground)]/55">
              By signing in, you agree to our{" "}
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
