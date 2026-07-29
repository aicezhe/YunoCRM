"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShieldAlert } from "lucide-react";

export function AccessDeniedToast() {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(() => searchParams.get("denied") === "users");

  useEffect(() => {
    if (!visible) return;
    router.replace("/dashboard", { scroll: false });
    const timeout = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-sm items-center gap-2 rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm text-red-700 shadow-lg sm:right-4 sm:left-auto">
      <ShieldAlert className="h-4 w-4 shrink-0" strokeWidth={2} />
      {t("accessDenied")}
    </div>
  );
}
