import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProfileEditor } from "./ProfileEditor";
import type { PluginProfile } from "../../shared/types";

const parseTokensText = (text: string): Record<string, string> => {
  const tokens: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*([^:]+)\s*:\s*(.+)\s*$/);
    if (match) tokens[match[1].trim()] = match[2].trim();
  }
  return tokens;
};

const meta: Meta<typeof ProfileEditor> = {
  component: ProfileEditor,
  title: "Components/ProfileEditor",
  argTypes: {
    onUpdateProfile: { action: "onUpdateProfile" },
    onUpdateTokensText: { action: "onUpdateTokensText" },
    onSave: { action: "onSave" },
    onCancel: { action: "onCancel" },
  },
  args: {
    parseTokensText,
  },
};
export default meta;

type Story = StoryObj<typeof ProfileEditor>;

const emptyProfile: PluginProfile = {
  id: "new-1",
  name: "",
  stack: "React + TypeScript + CSS Modules",
  layout: "",
  tokens: {},
  components: [],
  guidelines: "",
};

const filledProfile: PluginProfile = {
  id: "edit-1",
  name: "Superbrand Design System",
  stack: "React + TypeScript + Storybook 8",
  layout: "Container 997px, Main fluid + Sidebar 348px fixed",
  tokens: {
    "color-brand-magenta": "#E20074",
    "color-bg-primary": "#1A1A1A",
    "spacing-sm": "8px",
  },
  components: [{ name: "Button" }, { name: "Card" }],
  guidelines: "Dark-first theming, 8px grid, BEM naming",
};

export const NewProfile: Story = {
  args: {
    profile: emptyProfile,
    profiles: [],
    tokensText: "",
  },
};

export const EditProfile: Story = {
  args: {
    profile: filledProfile,
    profiles: [filledProfile],
    tokensText: "color-brand-magenta: #E20074\ncolor-bg-primary: #1A1A1A\nspacing-sm: 8px",
  },
};
