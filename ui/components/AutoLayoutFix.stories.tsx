import type { Meta, StoryObj } from "@storybook/react-vite";
import { AutoLayoutFix } from "./AutoLayoutFix";
import type { AutoLayoutCandidate, AutoLayoutSkipped } from "../../shared/types";

const meta: Meta<typeof AutoLayoutFix> = {
  component: AutoLayoutFix,
  title: "Components/AutoLayoutFix",
  args: {
    onApplied: () => undefined,
  },
};
export default meta;

type Story = StoryObj<typeof AutoLayoutFix>;

const mockCandidates: AutoLayoutCandidate[] = [
  { nodeId: "1:100", name: "hero-wrapper", depth: 2, direction: "VERTICAL", gap: 16, padding: { top: 0, right: 0, bottom: 0, left: 0 }, alignment: "MIN", childCount: 3, confidence: 0.95 },
  { nodeId: "1:200", name: "card-content", depth: 3, direction: "VERTICAL", gap: 8, padding: { top: 12, right: 12, bottom: 12, left: 12 }, alignment: "MIN", childCount: 5, confidence: 0.88 },
  { nodeId: "1:300", name: "button-row", depth: 3, direction: "HORIZONTAL", gap: 12, padding: { top: 0, right: 0, bottom: 0, left: 0 }, alignment: "CENTER", childCount: 2, confidence: 0.92 },
];

const mockSkipped: AutoLayoutSkipped[] = [
  { nodeId: "1:400", name: "overlap-group", reason: "Children overlap" },
  { nodeId: "1:500", name: "absolute-frame", reason: "Mixed positioning" },
];

export const Idle: Story = {
  args: {
    hasSelection: true,
  },
};

export const NoSelection: Story = {
  args: {
    hasSelection: false,
  },
};

export const Analyzing: Story = {
  args: {
    hasSelection: true,
    initialAnalyzing: true,
  },
};

export const WithCandidates: Story = {
  args: {
    hasSelection: true,
    initialCandidates: mockCandidates,
    initialSkipped: mockSkipped,
  },
};

export const Success: Story = {
  args: {
    hasSelection: true,
    initialAppliedCount: 3,
  },
};

export const Empty: Story = {
  args: {
    hasSelection: true,
    initialCandidates: [],
    initialSkipped: [{ nodeId: "1:600", name: "already-layout", reason: "Already has Auto Layout" }],
  },
};

export const Embedded: Story = {
  args: {
    hasSelection: true,
    embedded: true,
  },
};
