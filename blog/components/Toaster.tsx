"use client";

import { createContext, useCallback, useContext, useEffect, useState, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, WarningCircle, X } from "@phosphor-icons/react";

type ToastType = "success" | "error";
type ToastItem = { id: number; message: string; type: ToastType };

const ToastContext = createContext<{ toast: (message: string, type?: ToastType) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

// Surfaces a toast passed through a redirect (?toast=...), then strips the
// query params so it only shows once. Server actions that redirect on success
// (post create/update/delete, settings, profile, ...) use this to confirm.
function ToastFromUrl({ onMessage }: { onMessage: (message: string, type?: ToastType) => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const message = searchParams.get("toast");
    if (!message) return;
    const type = searchParams.get("toastType") === "error" ? "error" : "success";
    onMessage(message, type);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("toast");
    params.delete("toastType");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router, onMessage]);

  return null;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <Suspense fallback={null}>
        <ToastFromUrl onMessage={toast} />
      </Suspense>

      <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border p-3 shadow-lg ${
              t.type === "error"
                ? "border-red-300 bg-red-50 text-red-800"
                : "border-emerald-300 bg-emerald-50 text-emerald-800"
            }`}
          >
            {t.type === "error" ? (
              <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" weight="bold" />
            ) : (
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" weight="bold" />
            )}
            <p className="flex-1 text-sm">{t.message}</p>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}