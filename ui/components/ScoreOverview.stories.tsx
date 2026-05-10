import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScoreOverview } from "./ScoreOverview";
import type { ScanCategory } from "../../shared/types";

const meta: Meta<typeof ScoreOverview> = {
  component: ScoreOverview,
  title: "Components/ScoreOverview",
};
export default meta;

type Story = StoryObj<typeof ScoreOverview>;

const makeCategories = (scores: number[]): ScanCategory[] => [
  { id: "naming", label: "Naming", score: scores[0], status: scores[0] >= 75 ? "green" : scores[0] >= 50 ? "yellow" : "red" },
  { id: "structure", label: "Structure", score: scores[1], status: scores[1] >= 75 ? "green" : scores[1] >= 50 ? "yellow" : "red" },
  { id: "tokens", label: "Tokens", score: scores[2], status: scores[2] >= 75 ? "green" : scores[2] >= 50 ? "yellow" : "red" },
  { id: "meta", label: "Meta", score: scores[3], status: scores[3] >= 75 ? "green" : scores[3] >= 50 ? "yellow" : "red" },
  { id: "completeness", label: "Completeness", score: scores[4], status: scores[4] >= 75 ? "green" : scores[4] >= 50 ? "yellow" : "red" },
  { id: "variants", label: "Variants", score: scores[5], status: scores[5] >= 75 ? "green" : scores[5] >= 50 ? "yellow" : "red" },
];

export const HighScore: Story = {
  args: {
    score: 87,
    categories: makeCategories([92, 85, 88, 90, 78, 82]),
  },
};

export const MediumScore: Story = {
  args: {
    score: 62,
    categories: makeCategories([70, 65, 55, 80, 45, 60]),
  },
};

export const LowScore: Story = {
  args: {
    score: 35,
    categories: makeCategories([30, 40, 25, 50, 20, 35]),
  },
};
