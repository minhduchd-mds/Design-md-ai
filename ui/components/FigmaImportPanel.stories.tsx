import type { Meta, StoryObj } from "@storybook/react-vite";
import { FigmaImportPanel } from "./FigmaImportPanel";
import type { PluginProfile } from "../../shared/types";

const parseTokensText = (text: string): Record<string, string> => {
  const tokens: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*([^:]+)\s*:\s*(.+)\s*$/);
    if (match) tokens[match[1].trim()] = match[2].trim();
  }
  return tokens;
};

const baseProfile: PluginProfile = {
  id: "p-1",
  name: "",
  stack: "React + TypeScript",
  layout: "",
  tokens: {},
  components: [],
  guidelines: "",
};

const meta: Meta<typeof FigmaImportPanel> = {
  component: FigmaImportPanel,
  title: "Components/FigmaImportPanel",
  argTypes: {
    onUpdateProfile: { action: "onUpdateProfile" },
    onUpdateTokensText: { action: "onUpdateTokensText" },
  },
  args: {
    editProfile: baseProfile,
    tokensText: "",
    parseTokensText,
  },
};
export default meta;

type Story = StoryObj<typeof FigmaImportPanel>;

export const Default: Story = {};

export const Loading: Story = {
  args: {
    editProfile: { ...baseProfile, name: "Loading Test" },
  },
};

export const WithSourcePicker: Story = {
  args: {
    editProfile: { ...baseProfile, name: "Source Picker Test" },
    tokensText: "color-brand: #E20074",
  },
};
