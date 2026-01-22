"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { extractApiError } from "@/lib/auth/redirect";
import { resendCustomerVerification } from "@/lib/apiClient";

function Field({
  label,
  id,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  rightSlot,
  icon,
}: {
  label: string;
  id: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  rightSlot?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-[var(--foreground)]/80" htmlFor={id}>
        {label}
      </label>

      <div className="relative">
        {icon ? (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground)]/45">
            {icon}
          </div>
        ) : null}

        <input
          id={id}
          type={type}
          className={[
            "w-full rounded-xl border bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--foreground)]",
            "border-[var(--input-border)]",
            "focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]/25",
            "ios-input",
            icon ? "pl-10" : "",
            rightSlot ? "pr-12" : "",
          ].join(" ")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
        />

        {rightSlot ? (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightSlot}</div>
        ) : null}
      </div>
    </div>
  );
}

export function LoginForm({ 
  redirectTarget,
  onSubmittingChange,
}: { 
  redirectTarget?: string | null;
  onSubmittingChange?: (isSubmitting: boolean) => void;
}) {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    onSubmittingChange?.(submitting);
  }, [submitting, onSubmittingChange]);

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.trim().length > 0 && !submitting;
  }, [email, password, submitting]);

  const registerHref = useMemo(() => {
    if (!redirectTarget) {
      return "/register";
    }
    return `/register?redirect=${encodeURIComponent(redirectTarget)}`;
  }, [redirectTarget]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setVerificationMessage(null);
    setResendMessage(null);

    try {
      await login(email, password);
      router.replace(redirectTarget ?? "/");
      router.refresh();
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "data" in err) {
        const data = (err as { data?: { code?: string; message?: string } }).data;
        if (data?.code === "EMAIL_NOT_VERIFIED") {
          setVerificationMessage(data.message ?? "Please verify your email before logging in.");
          return;
        }
      }
      setError(extractApiError(err));
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
      setResendMessage(response.message ?? "If the email exists, we sent a verification link.");
    } catch {
      setResendMessage("We couldn't resend the email just now. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {verificationMessage && (
        <div className="space-y-3 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-3 text-sm text-[color:var(--status-warning)]">
          <p>{verificationMessage}</p>
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={resending}
            className="w-full rounded-lg border border-[var(--status-warning-border)] px-3 py-2 text-xs font-medium text-[color:var(--status-warning)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resending ? "Resending..." : "Resend verification email"}
          </button>
          {resendMessage ? <p className="text-xs text-[var(--foreground)]/70">{resendMessage}</p> : null}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-sm text-[color:var(--status-error)]">
          {error}
        </div>
      )}

      <Field
        label="Email"
        id="email"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        autoComplete="email"
        icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 6h16v12H4z" />
            <path d="m4 7 8 6 8-6" />
          </svg>
        }
      />

      <Field
        label="Password"
        id="password"
        type={showPw ? "text" : "password"}
        value={password}
        onChange={setPassword}
        placeholder="••••••••"
        autoComplete="current-password"
        icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M7 11V8a5 5 0 0 1 10 0v3" />
            <path d="M6 11h12v10H6z" />
          </svg>
        }
        rightSlot={
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--foreground)]/60 hover:bg-[var(--background-soft)] hover:text-[var(--accent-strong)]"
            aria-label={showPw ? "Hide password" : "Show password"}
          >
            {showPw ? "Hide" : "Show"}
          </button>
        }
      />

      <button
        type="submit"
        disabled={!canSubmit}
        className={[
          "mt-2 w-full rounded-xl px-4 py-2.5 text-sm font-medium text-white transition",
          "bg-[var(--accent)] hover:bg-[var(--accent-strong)]",
          "disabled:cursor-not-allowed disabled:opacity-60",
        ].join(" ")}
      >
        {submitting ? "Signing in..." : "Sign in"}
      </button>

      <div className="flex items-center justify-between pt-1 text-xs text-[var(--foreground)]/60">
        <Link href="/forgot-password" className="font-medium text-[var(--accent-strong)] hover:opacity-80">
          Forgot password?
        </Link>
        <span>New here?</span>
        <Link href={registerHref} className="font-medium text-[var(--accent-strong)] hover:opacity-80">
          Create account
        </Link>
      </div>
    </form>
  );
}
