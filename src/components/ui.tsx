"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText = "جارٍ...",
  className = "btn",
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

/** Re-fetches server components periodically so new WhatsApp messages appear. */
export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}

export function FormMessage({ state }: { state?: { error?: string; ok?: string } }) {
  if (!state) return null;
  if (state.error) return <p className="text-sm font-semibold text-red-600">{state.error}</p>;
  if (state.ok) return <p className="text-sm font-semibold text-brand-700">{state.ok}</p>;
  return null;
}
