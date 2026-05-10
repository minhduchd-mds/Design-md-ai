import type { PluginProfile } from "../../shared/types";
import { FigmaImportPanel } from "./FigmaImportPanel";
import styles from "./ProfileEditor.module.css";

interface ProfileEditorProps {
  profile: PluginProfile;
  profiles: PluginProfile[];
  tokensText: string;
  onUpdateProfile: (profile: PluginProfile) => void;
  onUpdateTokensText: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
  parseTokensText: (text: string) => Record<string, string>;
}

export function ProfileEditor({
  profile,
  profiles,
  tokensText,
  onUpdateProfile,
  onUpdateTokensText,
  onSave,
  onCancel,
  parseTokensText,
}: ProfileEditorProps) {
  const isExisting = profiles.some((p) => p.id === profile.id);

  return (
    <div className={styles.root}>
      <div className={styles.header}>{isExisting ? "Edit Profile" : "New Profile"}</div>
      <p className={styles.sectionLabel}>
        Import tokens from Figma or a skill file, or describe your design system below. The LLM uses this as context.
      </p>

      <FigmaImportPanel
        editProfile={profile}
        tokensText={tokensText}
        onUpdateProfile={onUpdateProfile}
        onUpdateTokensText={onUpdateTokensText}
        parseTokensText={parseTokensText}
      />

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Profile name</span>
        <input
          type="text"
          className={styles.input}
          placeholder="e.g. Superbrand Design System"
          value={profile.name}
          onChange={(e) => onUpdateProfile({ ...profile, name: e.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Tech stack</span>
        <input
          type="text"
          className={styles.input}
          placeholder="React + TypeScript + Storybook 8"
          value={profile.stack}
          onChange={(e) => onUpdateProfile({ ...profile, stack: e.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Layout</span>
        <input
          type="text"
          className={styles.input}
          placeholder="Grids, Columns, Structure"
          value={profile.layout}
          onChange={(e) => onUpdateProfile({ ...profile, layout: e.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>
          Design Tokens
          <span className={styles.hint}> (auto-filled by import)</span>
          <span className={styles.count}>{Object.keys(parseTokensText(tokensText)).length}</span>
        </span>
        <textarea
          className={styles.textarea}
          rows={5}
          placeholder={"color-brand: #E20074\nspacing-sm: 8px"}
          value={tokensText}
          onChange={(e) => onUpdateTokensText(e.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>
          Guidelines
          <span className={styles.hint}> (conventions, rules)</span>
        </span>
        <textarea
          className={styles.textarea}
          rows={4}
          placeholder="Dark-first theming, 8px grid, BEM naming..."
          value={profile.guidelines}
          onChange={(e) => onUpdateProfile({ ...profile, guidelines: e.target.value })}
        />
      </label>

      <button className={`btn-primary ${styles.saveBtn}`} onClick={onSave} disabled={!profile.name.trim()}>
        Save Profile
      </button>
      <button className={`btn-link ${styles.cancelLink}`} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
