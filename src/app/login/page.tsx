"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ParticleField } from "@/components/particle-field";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Supabase's own wire string for a bad email/password pair. Compared
 * against, never displayed — so it must stay in English regardless of the
 * UI locale, or the check silently stops matching. */
const SUPABASE_BAD_CREDENTIALS = "Invalid login credentials";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!EMAIL_RE.test(email.trim())) {
      setError(t("invalidEmail"));
      return;
    }
    if (!password) {
      setError(t("missingPassword"));
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(authError.message === SUPABASE_BAD_CREDENTIALS ? t("wrongCredentials") : authError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-gradient-to-br from-[#EEEBFF] via-[#F7F5FF] to-white px-4 py-8 font-sans">
      <ParticleField className="pointer-events-none absolute inset-0 h-full w-full" />

      {/* Reachable before signing in — otherwise the language can only be
          changed from inside the app. */}
      <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6">
        <LocaleSwitcher open="down" />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-3xl bg-white/80 p-7 shadow-[0_20px_60px_-15px_rgba(91,79,233,0.25)] backdrop-blur-sm sm:p-10">
        <div className="mb-8 text-center">
          <span className="text-2xl font-semibold tracking-tight text-[#5B4FE9]">
            Yuno<span className="text-gray-900">CRM</span>
          </span>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-gray-900">
            {t("welcome")}
          </h1>
          <p className="mt-2 text-sm text-gray-500">{t("subtitle")}</p>
        </div>

        {/* Inputs are 16px on phones and 14px from sm up: below 16px, iOS
            Safari zooms the whole page in when a field takes focus. */}
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
              {t("email")}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-900 placeholder-gray-400 outline-none transition focus:border-[#5B4FE9] focus:ring-4 focus:ring-[#5B4FE9]/10 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
              {t("password")}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 pr-11 text-base text-gray-900 placeholder-gray-400 outline-none transition focus:border-[#5B4FE9] focus:ring-4 focus:ring-[#5B4FE9]/10 sm:text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                aria-pressed={showPassword}
                className="absolute top-1/2 right-3.5 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
              >
                {showPassword ? (
                  <EyeOff className="h-4.5 w-4.5" strokeWidth={1.75} />
                ) : (
                  <Eye className="h-4.5 w-4.5" strokeWidth={1.75} />
                )}
              </button>
            </div>
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
            {loading ? t("submitting") : t("submit")}
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
