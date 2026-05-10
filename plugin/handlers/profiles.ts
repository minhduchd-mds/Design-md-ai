import type { PluginMessage, PluginProfile } from "../../shared/types";

const PROFILES_KEY = "designready-profiles";
const ACTIVE_PROFILE_KEY = "designready-active-profile";

export async function loadProfiles(): Promise<{ profiles: PluginProfile[]; activeId: string | null }> {
  const profiles: PluginProfile[] = (await figma.clientStorage.getAsync(PROFILES_KEY)) ?? [];
  const activeId: string | null = (await figma.clientStorage.getAsync(ACTIVE_PROFILE_KEY)) ?? null;
  return { profiles, activeId };
}

export async function saveProfile(profile: PluginProfile): Promise<PluginProfile[]> {
  const { profiles } = await loadProfiles();
  const idx = profiles.findIndex((p) => p.id === profile.id);
  if (idx >= 0) {
    profiles[idx] = profile;
  } else {
    profiles.push(profile);
  }
  await figma.clientStorage.setAsync(PROFILES_KEY, profiles);
  return profiles;
}

export async function deleteProfile(profileId: string): Promise<PluginProfile[]> {
  const { profiles, activeId } = await loadProfiles();
  const filtered = profiles.filter((p) => p.id !== profileId);
  await figma.clientStorage.setAsync(PROFILES_KEY, filtered);
  if (activeId === profileId) {
    await figma.clientStorage.setAsync(ACTIVE_PROFILE_KEY, null);
  }
  return filtered;
}

export async function setActiveProfile(profileId: string | null): Promise<void> {
  await figma.clientStorage.setAsync(ACTIVE_PROFILE_KEY, profileId);
}

export async function sendProfilesOnStartup(): Promise<void> {
  const { profiles, activeId } = await loadProfiles();
  const msg: PluginMessage = { type: "profiles-loaded", profiles, activeId };
  figma.ui.postMessage(msg);
}

export async function handleProfileMessage(msg: PluginMessage): Promise<boolean> {
  switch (msg.type) {
    case "load-profiles": {
      const data = await loadProfiles();
      const resp: PluginMessage = { type: "profiles-loaded", profiles: data.profiles, activeId: data.activeId };
      figma.ui.postMessage(resp);
      return true;
    }
    case "save-profile": {
      const profiles = await saveProfile(msg.profile);
      const resp: PluginMessage = { type: "profile-saved", profiles };
      figma.ui.postMessage(resp);
      return true;
    }
    case "set-active-profile": {
      await setActiveProfile(msg.profileId);
      return true;
    }
    case "delete-profile": {
      const profiles = await deleteProfile(msg.profileId);
      const resp: PluginMessage = { type: "profile-saved", profiles };
      figma.ui.postMessage(resp);
      return true;
    }
    default:
      return false;
  }
}
