import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProfileManager } from "./ProfileManager";
import type { PluginProfile } from "../../shared/types";

const meta: Meta<typeof ProfileManager> = {
  component: ProfileManager,
  title: "Components/ProfileManager",
  argTypes: {
    onSelect: { action: "onSelect" },
    onSave: { action: "onSave" },
    onDelete: { action: "onDelete" },
  },
};
export default meta;

type Story = StoryObj<typeof ProfileManager>;

const makeProfile = (id: string, name: string, stack: string): PluginProfile => ({
  id,
  name,
  stack,
  layout: "",
  tokens: {},
  components: [],
  guidelines: "",
});

export const EmptyProfiles: Story = {
  args: {
    profiles: [],
    activeId: null,
  },
};

export const WithProfiles: Story = {
  args: {
    profiles: [
      makeProfile("1", "Superbrand Design System", "React + TypeScript + CSS Modules"),
      makeProfile("2", "Starter Kit", "React + Storybook 8"),
      makeProfile("3", "Internal Brand Kit", "Vue 3 + Tailwind"),
    ],
    activeId: "2",
  },
};

export const EditingProfile: Story = {
  args: {
    profiles: [
      makeProfile("1", "Superbrand Design System", "React + TypeScript + CSS Modules"),
    ],
    activeId: "1",
  },
};
