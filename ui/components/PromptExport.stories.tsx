import type { Meta, StoryObj } from "@storybook/react-vite";
import { PromptExport } from "./PromptExport";

const meta: Meta<typeof PromptExport> = {
  component: PromptExport,
  title: "Components/PromptExport",
};
export default meta;
type Story = StoryObj<typeof PromptExport>;

const samplePrompt = `# Button → React+TS+CSS
# DesignReady.ai compact spec

## tokens
colors: #18a0fb(3) #e0e0e0(5)
fonts: 14/w600(2) 12/w400(3)

## tree
@Button F 120×44 H gap:8 pad:12
  @Label T "Click me" 14/w600
  @Icon I 16×16 <ArrowRight>

## rules
stack: React+TS+CSS
match spec fidelity — sizes, colors, spacing, typography as specified above`;

export const Ready: Story = {
  args: { promptCompact: samplePrompt, score: 87 },
};

export const Locked: Story = {
  args: { promptCompact: "", score: 45 },
};
