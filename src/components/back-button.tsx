"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/** Goes back to whatever list opened this view (search results or a
 * dashboard table), rather than a hardcoded route. */
export function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-gray-500 transition hover:text-[#5B4FE9] sm:min-h-0"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={2} />
      Back
    </button>
  );
}
