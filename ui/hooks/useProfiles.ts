import { useState, useEffect, useCallback } from "react";
import type { PluginProfile } from "../../shared/types";

export function useProfiles() {
  const [profiles, setProfiles] = useState<PluginProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const msg = event.data?.pluginMessage;
      if (!msg) return;
      if (msg.type === "profiles-loaded") {
        setProfiles(msg.profiles);
        setActiveId(msg.activeId);
      }
      if (msg.type === "profile-saved") {
        setProfiles(msg.profiles);
        setActiveId((prev) => prev && !msg.profiles.find((p: PluginProfile) => p.id === prev) ? null : prev);
      }
    }
    window.addEventListener("message", handleMessage);
    // Request profiles on mount
    parent.postMessage({ pluginMessage: { type: "load-profiles" } }, "*");
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const activeProfile = profiles.find((p) => p.id === activeId) ?? null;

  const saveProfile = useCallback((profile: PluginProfile) => {
    parent.postMessage({ pluginMessage: { type: "save-profile", profile } }, "*");
    // Automatically set as active
    setActiveId(profile.id);
    parent.postMessage({ pluginMessage: { type: "set-active-profile", profileId: profile.id } }, "*");
  }, []);

  const selectProfile = useCallback((profileId: string | null) => {
    setActiveId(profileId);
    parent.postMessage({ pluginMessage: { type: "set-active-profile", profileId } }, "*");
  }, []);

  const deleteProfile = useCallback(
    (profileId: string) => {
      parent.postMessage({ pluginMessage: { type: "delete-profile", profileId } }, "*");
      if (activeId === profileId) {
        setActiveId(null);
      }
    },
    [activeId],
  );

  return { profiles, activeProfile, activeId, saveProfile, selectProfile, deleteProfile };
}
