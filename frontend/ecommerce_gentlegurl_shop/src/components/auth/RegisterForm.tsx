"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();

  const [formState, setFormState] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    password_confirmation: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field: keyof typeof formState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await register(formState);
      router.refresh();
      router.push("/account");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded border border-[var(--muted)] bg-white/70 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none";

  return (
    <form className="space-y-4 text-[var(--foreground)]" onSubmit={handleSubmit}>
      {error && (
        <div className="rounded bg-[var(--muted)] px-3 py-2 text-sm text-[#b8527a]">
          {error}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-sm text-[var(--foreground)]/80" htmlFor="name">
          Name
        </label>
        <input
          id="name"
          type="text"
          className={inputClass}
          value={formState.name}
          onChange={(e) => handleChange("name", e.target.value)}
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm text-[var(--foreground)]/80" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className={inputClass}
          value={formState.email}
          onChange={(e) => handleChange("email", e.target.value)}
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm text-[var(--foreground)]/80" htmlFor="phone">
          Phone
        </label>
        <input
          id="phone"
          type="tel"
          className={inputClass}
          value={formState.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm text-[var(--foreground)]/80" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          className={inputClass}
          value={formState.password}
          onChange={(e) => handleChange("password", e.target.value)}
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm text-[var(--foreground)]/80" htmlFor="password_confirmation">
          Confirm Password
        </label>
        <input
          id="password_confirmation"
          type="password"
          className={inputClass}
          value={formState.password_confirmation}
          onChange={(e) => handleChange("password_confirmation", e.target.value)}
          required
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-[var(--accent)] px-4 py-2 text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
      >
        {submitting ? "Creating account..." : "Register"}
      </button>
    </form>
  );
}
