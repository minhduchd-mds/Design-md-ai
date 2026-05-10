import type { Meta, StoryObj } from "@storybook/react-vite";
import { TokenMap } from "./TokenMap";
import type { ColorMapping } from "../../shared/types";

const meta: Meta<typeof TokenMap> = {
  component: TokenMap,
  title: "Components/TokenMap",
  parameters: {
    layout: "fullscreen",
  },
};
export default meta;
type Story = StoryObj<typeof TokenMap>;

// ==================== FULL REALISTIC MIXED MAPPINGS FROM Light.tokens.json ====================

const mixedMappings: ColorMapping[] = [
  // Brand & Primary
  { hex: "#B9000E", tokenName: "primary", count: 24, nodeId: "10:1" },
  { hex: "#C61F1B", tokenName: "red-light", count: 11, nodeId: "10:2" },
  { hex: "#FFB600", tokenName: "yellow-primary", count: 15, nodeId: "10:3" },
  { hex: "#EBA800", tokenName: "yellow-button", count: 7, nodeId: "10:4" },

  // Text colors
  { hex: "#4E0300", tokenName: "text", count: 68, nodeId: "10:5" },
  { hex: "#260100", tokenName: "back-text", count: 12, nodeId: "10:6" },

  // Primary Red Scale
  { hex: "#EE0033", tokenName: "Primary.Red-500", count: 19, nodeId: "10:7" },
  { hex: "#FF1F4F", tokenName: "Primary.Red-400", count: 8, nodeId: "10:8" },
  { hex: "#C80029", tokenName: "Primary.Red-600", count: 6, nodeId: "10:9" },
  { hex: "#FF466F", tokenName: "Primary.Red-300", count: 5, nodeId: "10:10" },

  // Semantic Gray
  { hex: "#2C2F32", tokenName: "Semantic.Gray.gray-900", count: 34, nodeId: "10:11" },
  { hex: "#FFFFFF", tokenName: "Semantic.Gray.White", count: 87, nodeId: "10:12" },
  { hex: "#EFEEED", tokenName: "Semantic.Gray.backgroud", count: 22, nodeId: "10:13" },
  { hex: "#F3F4F5", tokenName: "Semantic.Gray.gray-200", count: 18, nodeId: "10:14" },

  // Semantic Status Colors
  { hex: "#0A84FF", tokenName: "Semantic.Info.Blue-600 (light)", count: 14, nodeId: "10:15" },
  { hex: "#6DB500", tokenName: "Semantic.Success.Green-500", count: 9, nodeId: "10:16" },
  { hex: "#ED1B2F", tokenName: "Semantic.Error.Red-500", count: 13, nodeId: "10:17" },
  { hex: "#F89521", tokenName: "Semantic.Warrning.Orangen-500", count: 7, nodeId: "10:18" },

  // Chart & Accent Colors
  { hex: "#F53FC6", tokenName: "Chart.Pink", count: 5, nodeId: "10:19" },
  { hex: "#7A5AF8", tokenName: "Semantic.Purple.Purple-500", count: 6, nodeId: "10:20" },
  { hex: "#16B364", tokenName: "Chart.Green", count: 4, nodeId: "10:21" },
  { hex: "#F39C0D", tokenName: "Chart.Yellow", count: 3, nodeId: "10:22" },

  // Unmapped colors (to demonstrate handling of unknown colors)
  { hex: "#FF5533", tokenName: null, count: 5, nodeId: "10:23" },
  { hex: "#AABBCC", tokenName: null, count: 3, nodeId: "10:24" },
  { hex: "#00CC88", tokenName: null, count: 2, nodeId: "10:25" },
];

const allMapped: ColorMapping[] = [
  { hex: "#B9000E", tokenName: "primary", count: 24, nodeId: "10:1" },
  { hex: "#C61F1B", tokenName: "red-light", count: 11, nodeId: "10:2" },
  { hex: "#FFB600", tokenName: "yellow-primary", count: 15, nodeId: "10:3" },
  { hex: "#4E0300", tokenName: "text", count: 68, nodeId: "10:5" },
  { hex: "#EE0033", tokenName: "Primary.Red-500", count: 19, nodeId: "10:7" },
  { hex: "#2C2F32", tokenName: "Semantic.Gray.gray-900", count: 34, nodeId: "10:11" },
  { hex: "#FFFFFF", tokenName: "Semantic.Gray.White", count: 87, nodeId: "10:12" },
  { hex: "#0A84FF", tokenName: "Semantic.Info.Blue-600 (light)", count: 14, nodeId: "10:15" },
  { hex: "#6DB500", tokenName: "Semantic.Success.Green-500", count: 9, nodeId: "10:16" },
  { hex: "#ED1B2F", tokenName: "Semantic.Error.Red-500", count: 13, nodeId: "10:17" },
  { hex: "#F89521", tokenName: "Semantic.Warrning.Orangen-500", count: 7, nodeId: "10:18" },
  { hex: "#7A5AF8", tokenName: "Semantic.Purple.Purple-500", count: 6, nodeId: "10:20" },
];

export const MixedWithProfile: Story = {
  args: {
    mappings: mixedMappings,
    profileName: "Superbrand DS - Light",
  },
};

export const AllMapped: Story = {
  args: {
    mappings: allMapped,
    profileName: "Superbrand DS - Light",
  },
};

export const WithoutProfile: Story = {
  args: {
    mappings: mixedMappings,
  },
};

export const Empty: Story = {
  args: {
    mappings: [],
  },
};
