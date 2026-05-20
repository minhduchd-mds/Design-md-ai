import type { Meta, StoryObj } from "@storybook/react-vite";
import { Select } from "../src/primitives/index.js";

const meta: Meta<typeof Select> = {
  title: "Desygn UI/Select",
  component: Select,
  args: {
    placeholder: "Select WCAG level",
    options: [
      { label: "WCAG 2.2 A", value: "A" },
      { label: "WCAG 2.2 AA", value: "AA" },
      { label: "WCAG 2.2 AAA", value: "AAA" },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof Select>;

export const Default: Story = {};
export const WithSelection: Story = { args: { defaultValue: "AA", placeholder: undefined } };
export const Error: Story = { args: { error: "Choose a conformance level" } };
export const Disabled: Story = { args: { disabled: true } };
