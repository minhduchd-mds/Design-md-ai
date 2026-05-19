import type { Meta, StoryObj } from "@storybook/react-vite";
import { BatchPanel } from "./BatchPanel";
import type { BatchScanResult } from "../../shared/types";

const meta: Meta<typeof BatchPanel> = {
  component: BatchPanel,
  title: "Components/BatchPanel",
};
export default meta;
type Story = StoryObj<typeof BatchPanel>;

const emptyScanResult = {
  score: 0,
  categories: [],
  issues: [],
};

const mockResult: BatchScanResult = {
  averageScore: 82,
  items: [
    { name: "Icon", nodeId: "1:1", score: 92, atomicLevel: "atom", scanResult: { ...emptyScanResult, score: 92 } },
    { name: "Badge", nodeId: "1:2", score: 85, atomicLevel: "atom", scanResult: { ...emptyScanResult, score: 85 } },
    { name: "ProductCard", nodeId: "1:3", score: 78, atomicLevel: "molecule", scanResult: { ...emptyScanResult, score: 78 } },
    { name: "Header", nodeId: "1:4", score: 71, atomicLevel: "organism", scanResult: { ...emptyScanResult, score: 71 } },
  ],
  exportPlan: [],
  batchPromptCompact: `# Batch → React+TS+CSS
# Desygn AI compact spec

## build-order
1. Icon (atom)
2. Badge (atom)
3. ProductCard (molecule) — uses Icon, Badge
4. Header (organism) — uses ProductCard

## tree
@Icon I 16×16
@Badge F 48×24 H gap:4 pad:4,8
  @Label T "New" 10/w600
@ProductCard F 240×320 V gap:12 pad:16
  @Image I 240×180
  @Badge → Badge
  @Title T "Product" 14/w600
  @Price T "€29.99" 16/w700
@Header F 1280×80 H gap:24 pad:0,32
  @Logo I 120×40
  @Nav F H gap:16
  @ProductCard → ProductCard`,
};

const mockResultNoPrompt: BatchScanResult = {
  ...mockResult,
  batchPromptCompact: undefined,
};

export const WithPrompt: Story = {
  args: {
    result: mockResult,
    onSelectNode: () => undefined,
  },
};

export const WithoutPrompt: Story = {
  args: {
    result: mockResultNoPrompt,
    onSelectNode: () => undefined,
  },
};
