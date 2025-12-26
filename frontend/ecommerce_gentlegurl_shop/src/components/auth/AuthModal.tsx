"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

export type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "login" | "register";
};

const initialRegisterState = {
  name: "",
  email: "",
  phone: "",
  password: "",
  password_confirmation: "",
};

export function AuthModal({ isOpen, onClose, defaultTab = "login" }: AuthModalProps) {
  const { login, register } = useAuth();
  const [activeTab, setActiveTab] = useState<"login" | "register">(defaultTab);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerForm, setRegisterForm] = useState({ ...initialRegisterState });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, isOpen]);

  if (!isOpen) return null;

  const resetState = () => {
    setLoginEmail("");
    setLoginPassword("");
    setRegisterForm({ ...initialRegisterState });
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(loginEmail, loginPassword);
      resetState();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await register(registerForm);
      resetState();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--foreground)]/30 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-[var(--card-border)] bg-[var(--card)]/90 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-3 text-sm font-medium">
            <button
              className={`pb-2 ${
                activeTab === "login"
                  ? "border-b-2 border-[var(--accent)] text-[var(--foreground)]"
                  : "text-[var(--foreground)]/60"
              }`}
              onClick={() => setActiveTab("login")}
            >
              Login
            </button>
            <button
              className={`pb-2 ${
                activeTab === "register"
                  ? "border-b-2 border-[var(--accent)] text-[var(--foreground)]"
                  : "text-[var(--foreground)]/60"
              }`}
              onClick={() => setActiveTab("register")}
            >
              Register
            </button>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--foreground)]/60 transition hover:text-[var(--foreground)]"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded bg-[var(--muted)] px-3 py-2 text-sm text-[var(--accent-stronger)]">
            {error}
          </div>
        )}

        {activeTab === "login" ? (
          <form className="space-y-3" onSubmit={handleLogin}>
            <div>
              <label className="text-sm text-[var(--foreground)]/80">Email</label>
              <input
                type="email"
                className={inputClass}
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm text-[var(--foreground)]/80">Password</label>
              <input
                type="password"
                className={inputClass}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded bg-[var(--accent)] px-4 py-2 text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
            >
              {submitting ? "Signing in..." : "Login"}
            </button>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={handleRegister}>
            <div>
              <label className="text-sm text-[var(--foreground)]/80">Name</label>
              <input
                type="text"
                className={inputClass}
                value={registerForm.name}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-sm text-[var(--foreground)]/80">Email</label>
              <input
                type="email"
                className={inputClass}
                value={registerForm.email}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-sm text-[var(--foreground)]/80">Phone</label>
              <input
                type="tel"
                className={inputClass}
                value={registerForm.phone}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, phone: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-sm text-[var(--foreground)]/80">Password</label>
              <input
                type="password"
                className={inputClass}
                value={registerForm.password}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-sm text-[var(--foreground)]/80">Confirm Password</label>
              <input
                type="password"
                className={inputClass}
                value={registerForm.password_confirmation}
                onChange={(e) =>
                  setRegisterForm((prev) => ({ ...prev, password_confirmation: e.target.value }))
                }
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
        )}
      </div>
    </div>
  );
}
