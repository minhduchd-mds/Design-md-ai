/**
 * usePWAInstall — Progressive Web App install prompt hook.
 *
 * Captures the `beforeinstallprompt` event and exposes install capability.
 * Detects platform (iOS, Android, desktop) for appropriate install guidance.
 */

import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallPlatform = "android" | "ios" | "windows" | "macos" | "linux" | "unknown";

export interface UsePWAInstallReturn {
  /** Whether install prompt is available */
  canInstall: boolean;
  /** Whether the app is already running as PWA */
  isInstalled: boolean;
  /** Detected platform */
  platform: InstallPlatform;
  /** Trigger the native install prompt (Android/desktop) */
  promptInstall: () => Promise<boolean>;
  /** Whether user dismissed the prompt */
  dismissed: boolean;
}

function detectPlatform(): InstallPlatform {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  if (/windows/.test(ua)) return "windows";
  if (/macintosh|mac os/.test(ua)) return "macos";
  if (/linux/.test(ua)) return "linux";
  return "unknown";
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function usePWAInstall(): UsePWAInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(false);
  const [platform] = useState<InstallPlatform>(detectPlatform);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const installedHandler = () => setIsInstalled(true);

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    const result = await deferredPrompt.prompt();
    setDeferredPrompt(null);
    if (result.outcome === "dismissed") {
      setDismissed(true);
      return false;
    }
    return true;
  }, [deferredPrompt]);

  return {
    canInstall: deferredPrompt !== null,
    isInstalled,
    platform,
    promptInstall,
    dismissed,
  };
}
