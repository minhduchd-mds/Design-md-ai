import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProfileList } from "./ProfileList";
import type { PluginProfile } from "../../shared/types";

const meta: Meta<typeof ProfileList> = {
  component: ProfileList,
  title: "Components/ProfileList",
  argTypes: {
    onSelect: { action: "onSelect" },
    onEdit: { action: "onEdit" },
    onDelete: { action: "onDelete" },
    onNew: { action: "onNew" },
  },
};
export default meta;

type Story = StoryObj<typeof ProfileList>;

const makeProfile = (id: string, name: string, stack: string): PluginProfile => ({
  id,
  name,
  stack,
  layout: "",
  tokens: {},
  components: [],
  guidelines: "",
});

export const Empty: Story = {
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

export const SingleProfile: Story = {
  args: {
    profiles: [makeProfile("1", "My Design System", "React + TypeScript")],
    activeId: "1",
  },
};
