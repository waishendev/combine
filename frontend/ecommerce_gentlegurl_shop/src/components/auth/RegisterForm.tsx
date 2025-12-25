"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { extractApiError } from "@/lib/auth/redirect";

function Field({
  label,
  id,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  icon,
  rightSlot,
}: {
  label: string;
  id: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  icon?: React.ReactNode;
  rightSlot?: React.ReactNode;
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
            "w-full rounded-xl border bg-white/90 px-3 py-2.5 text-sm text-[var(--foreground)]",
            "border-[var(--muted)]/70",
            "focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-[var(--muted)]/25",
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

export function RegisterForm({ 
  redirectTarget,
  onSubmittingChange,
}: { 
  redirectTarget?: string | null;
  onSubmittingChange?: (isSubmitting: boolean) => void;
}) {
  const { register } = useAuth();
  const router = useRouter();

  const [formState, setFormState] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    password_confirmation: "",
  });

  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    onSubmittingChange?.(submitting);
  }, [submitting, onSubmittingChange]);

  const handleChange = (field: keyof typeof formState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const pwMismatch =
    formState.password.length > 0 &&
    formState.password_confirmation.length > 0 &&
    formState.password !== formState.password_confirmation;

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (!formState.name.trim()) return false;
    if (!formState.email.trim()) return false;
    if (!formState.phone.trim()) return false;
    if (!formState.password.trim()) return false;
    if (!formState.password_confirmation.trim()) return false;
    if (pwMismatch) return false;
    return true;
  }, [formState, submitting, pwMismatch]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await register(formState);
      router.replace(redirectTarget ?? "/");
      router.refresh();
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && (
        <div className="rounded-xl border border-[var(--muted)]/60 bg-white/90 px-3 py-2 text-sm text-[var(--accent-stronger)]">
          {error}
        </div>
      )}

      <Field
        label="Name"
        id="name"
        type="text"
        value={formState.name}
        onChange={(v) => handleChange("name", v)}
        placeholder="Your name"
        autoComplete="name"
        icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M20 21a8 8 0 0 0-16 0" />
            <circle cx="12" cy="8" r="4" />
          </svg>
        }
      />

      <Field
        label="Email"
        id="email"
        type="email"
        value={formState.email}
        onChange={(v) => handleChange("email", v)}
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
        label="Phone"
        id="phone"
        type="tel"
        value={formState.phone}
        onChange={(v) => handleChange("phone", v)}
        placeholder="e.g. 012-345 6789"
        autoComplete="tel"
        icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M7 2h10v20H7z" />
            <path d="M10 19h4" />
          </svg>
        }
      />

      <Field
        label="Password"
        id="password"
        type={showPw ? "text" : "password"}
        value={formState.password}
        onChange={(v) => handleChange("password", v)}
        placeholder="Create a password"
        autoComplete="new-password"
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

      <div className="space-y-2">
        <Field
          label="Confirm Password"
          id="password_confirmation"
          type={showPw2 ? "text" : "password"}
          value={formState.password_confirmation}
          onChange={(v) => handleChange("password_confirmation", v)}
          placeholder="Repeat password"
          autoComplete="new-password"
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M7 11V8a5 5 0 0 1 10 0v3" />
              <path d="M6 11h12v10H6z" />
            </svg>
          }
          rightSlot={
            <button
            type="button"
            onClick={() => setShowPw2((v) => !v)}
            className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--foreground)]/60 hover:bg-[var(--background-soft)] hover:text-[var(--accent-strong)]"
            aria-label={showPw2 ? "Hide password" : "Show password"}
          >
              {showPw2 ? "Hide" : "Show"}
            </button>
          }
        />

        {pwMismatch ? (
          <p className="text-xs text-[var(--accent-stronger)]">
            Passwords do not match. Please re-check.
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className={[
          "mt-2 w-full rounded-xl px-4 py-2.5 text-sm font-medium text-white transition",
          "bg-[var(--accent)] hover:bg-[var(--accent-strong)]",
          "disabled:cursor-not-allowed disabled:opacity-60",
        ].join(" ")}
      >
        {submitting ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
