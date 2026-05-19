/**
 * useToast — Toast notification hook extracted from main.tsx.
 *
 * Provides showToast() and toasts array for rendering.
 * Auto-dismisses after 3.5s, keeps max 5 visible.
 */

import { useCallback, useRef, useState } from "react";

export type ToastType = "success" | "error" | "warn" | "info";

export interface Toast {
  id: number;
  msg: string;
  type: ToastType;
}

export interface UseToastReturn {
  toasts: Toast[];
  showToast: (msg: string, type?: ToastType) => void;
}

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const showToast = useCallback((msg: string, type: ToastType = "success") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev.slice(-4), { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return { toasts, showToast };
}
