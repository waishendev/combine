"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { useAuth } from "@/contexts/AuthContext";
import { getSafeRedirect } from "@/lib/auth/redirect";
import { getAuthFlag } from "@/lib/auth/session";
import LoadingOverlay from "@/components/LoadingOverlay";

export default function RegisterPage() {
  const { customer } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTarget = useMemo(() => {
    const target = getSafeRedirect(searchParams.get("redirect"));
    if (target === "/login" || target === "/register") return null;
    return target;
  }, [searchParams]);

  const loginHref = useMemo(() => {
    if (!redirectTarget) return "/login";
    return `/login?redirect=${encodeURIComponent(redirectTarget)}`;
  }, [redirectTarget]);

  useEffect(() => {
    if (customer || getAuthFlag()) {
      router.replace(redirectTarget ?? "/");
    }
  }, [customer, redirectTarget, router]);

  return (
    <>
      <LoadingOverlay show={isSubmitting} message="Creating account..." />
      <div className="min-h-[70vh]">
      <div className="relative mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-4 py-14">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
              Create your account
            </h1>
            <p className="mt-2 text-sm text-[var(--foreground)]/70">
              Join to save favorites, track orders, and checkout faster.
            </p>
          </div>

          {/* Card */}
          <div className="rounded-3xl border border-pink-100/60 bg-white/80 p-7 shadow-[0_12px_40px_-24px_rgba(231,162,186,0.25)] backdrop-blur-sm md:p-8">
            <RegisterForm redirectTarget={redirectTarget} onSubmittingChange={setIsSubmitting} />

            <div className="mt-6 text-center text-sm text-[var(--foreground)]/70">
              Already have an account?{" "}
              <Link
                href={loginHref}
                className="font-medium text-[var(--accent-strong)] hover:opacity-80"
              >
                Sign in →
              </Link>
            </div>
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
