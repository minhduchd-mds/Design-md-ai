import { useState } from "react";
import type { PluginProfile } from "../../shared/types";
import { ProfileList } from "./ProfileList";
import { ProfileEditor } from "./ProfileEditor";

interface ProfileManagerProps {
  profiles: PluginProfile[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onSave: (profile: PluginProfile) => void;
  onDelete: (id: string) => void;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const EMPTY_PROFILE: Omit<PluginProfile, "id"> = {
  name: "",
  stack: "React + TypeScript + CSS Modules",
  layout: "",
  tokens: {},
  components: [],
  guidelines: "",
};

function parseTokensText(text: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*([^:]+)\s*:\s*(.+)\s*$/);
    if (match) {
      tokens[match[1].trim()] = match[2].trim();
    }
  }
  return tokens;
}

export function ProfileManager({ profiles, activeId, onSelect, onSave, onDelete }: ProfileManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editProfile, setEditProfile] = useState<PluginProfile | null>(null);
  const [tokensText, setTokensText] = useState("");

  const startNew = () => {
    setEditProfile({ ...EMPTY_PROFILE, id: generateId(), tokens: {} });
    setTokensText("");
    setIsEditing(true);
  };

  const startEdit = (profile: PluginProfile) => {
    setEditProfile({ ...profile });
    setTokensText(
      Object.entries(profile.tokens)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n"),
    );
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!editProfile || !editProfile.name.trim()) return;
    const tokens = parseTokensText(tokensText);
    onSave({ ...editProfile, tokens });
    setIsEditing(false);
    setEditProfile(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditProfile(null);
  };

  if (isEditing && editProfile) {
    return (
      <ProfileEditor
        profile={editProfile}
        profiles={profiles}
        tokensText={tokensText}
        onUpdateProfile={setEditProfile}
        onUpdateTokensText={setTokensText}
        onSave={handleSave}
        onCancel={handleCancel}
        parseTokensText={parseTokensText}
      />
    );
  }

  return (
    <ProfileList
      profiles={profiles}
      activeId={activeId}
      onSelect={onSelect}
      onEdit={startEdit}
      onDelete={onDelete}
      onNew={startNew}
    />
  );
}
