import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen">


      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-14">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-[var(--foreground)]/70">
              Sign in to track orders, manage your account, and checkout faster.
            </p>
          </div>

          {/* Card */}
          <div className="rounded-3xl border border-pink-100/60 bg-white/80 p-7 shadow-[0_12px_40px_-24px_rgba(231,162,186,0.25)] backdrop-blur-sm md:p-8">
            <LoginForm />
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
  );
}
