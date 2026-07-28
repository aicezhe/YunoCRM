"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ParticleField } from "@/components/particle-field";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!EMAIL_RE.test(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }
    if (!password) {
      setError("Please enter your password");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "Invalid email or password"
          : authError.message
      );
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#EEEBFF] via-[#F7F5FF] to-white px-4 font-sans">
      <ParticleField className="pointer-events-none absolute inset-0 h-full w-full" />

      <div className="relative z-10 w-full max-w-md rounded-3xl bg-white/80 p-10 shadow-[0_20px_60px_-15px_rgba(91,79,233,0.25)] backdrop-blur-sm">
        <div className="mb-8 text-center">
          <span className="text-2xl font-semibold tracking-tight text-[#5B4FE9]">
            Yuno<span className="text-gray-900">CRM</span>
          </span>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-gray-900">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-gray-500">Log in to your workspace</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-[#5B4FE9] focus:ring-4 focus:ring-[#5B4FE9]/10"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-[#5B4FE9] focus:ring-4 focus:ring-[#5B4FE9]/10"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#5B4FE9] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#5B4FE9]/30 transition hover:bg-[#4A3FD4] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && (
              <span
                aria-hidden
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
            )}
            {loading ? "Logging in…" : "Log in"}
          </button>

          <p
            role="alert"
            aria-live="polite"
            className={`min-h-5 text-center text-sm text-red-500 ${error ? "" : "invisible"}`}
          >
            {error ?? " "}
          </p>
        </form>
      </div>
    </main>
  );
}
