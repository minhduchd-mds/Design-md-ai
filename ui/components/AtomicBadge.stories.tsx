import type { Meta, StoryObj } from "@storybook/react-vite";
import { AtomicBadge } from "./AtomicBadge";
import type { AtomicInfo, ExportPlanItem } from "../../shared/types";

const meta: Meta<typeof AtomicBadge> = {
  component: AtomicBadge,
  title: "Components/AtomicBadge",
};
export default meta;

type Story = StoryObj<typeof AtomicBadge>;

/* ── Atom ── */

const atomInfo: AtomicInfo = {
  name: "Button",
  nodeId: "1:100",
  level: "atom",
  isComponentized: true,
  componentCount: 1,
  instanceCount: 1,
  depth: 2,
  subComponents: [],
  significantFrames: [],
  dependencyTree: {
    name: "Button",
    level: "atom",
    children: [],
  },
};

const atomExportPlan: ExportPlanItem[] = [
  { step: 1, name: "Button", level: "atom", context: "standalone button" },
];

export const Atom: Story = {
  args: {
    info: atomInfo,
    exportPlan: atomExportPlan,
  },
};

/* ── Molecule ── */

const moleculeInfo: AtomicInfo = {
  name: "SearchBar",
  nodeId: "1:200",
  level: "molecule",
  isComponentized: true,
  componentCount: 3,
  instanceCount: 3,
  depth: 3,
  subComponents: ["Button", "TextInput", "Icon"],
  significantFrames: [],
  dependencyTree: {
    name: "SearchBar",
    level: "molecule",
    children: [
      { name: "TextInput", level: "atom", children: [] },
      { name: "Icon", level: "atom", children: [] },
      { name: "Button", level: "atom", children: [] },
    ],
  },
};

const moleculeExportPlan: ExportPlanItem[] = [
  { step: 1, name: "TextInput", level: "atom", context: "standalone input field" },
  { step: 2, name: "Icon", level: "atom", context: "search icon, 16x16" },
  { step: 3, name: "Button", level: "atom", context: "submit trigger" },
  { step: 4, name: "SearchBar", level: "molecule", context: "uses: TextInput, Icon, Button" },
];

export const Molecule: Story = {
  args: {
    info: moleculeInfo,
    exportPlan: moleculeExportPlan,
  },
};

/* ── Organism ── */

const organismInfo: AtomicInfo = {
  name: "Header",
  nodeId: "1:300",
  level: "organism",
  isComponentized: true,
  componentCount: 6,
  instanceCount: 6,
  depth: 4,
  subComponents: ["Logo", "NavLink", "SearchBar", "Button", "TextInput", "Icon"],
  significantFrames: [],
  dependencyTree: {
    name: "Header",
    level: "organism",
    children: [
      { name: "Logo", level: "atom", children: [] },
      {
        name: "Nav",
        level: "molecule",
        children: [{ name: "NavLink", level: "atom", children: [] }],
      },
      {
        name: "SearchBar",
        level: "molecule",
        children: [
          { name: "TextInput", level: "atom", children: [] },
          { name: "Button", level: "atom", children: [] },
        ],
      },
    ],
  },
};

const organismExportPlan: ExportPlanItem[] = [
  { step: 1, name: "Logo", level: "atom", context: "no dependencies", nodeId: "1:10" },
  { step: 2, name: "NavLink", level: "atom", context: "no dependencies", nodeId: "1:11" },
  { step: 3, name: "TextInput", level: "atom", context: "no dependencies", nodeId: "1:12" },
  { step: 4, name: "Button", level: "atom", context: "no dependencies", nodeId: "1:13" },
  { step: 5, name: "Nav", level: "molecule", context: "uses: <NavLink>", nodeId: "1:14" },
  { step: 6, name: "SearchBar", level: "molecule", context: "uses: <TextInput>, <Button>", nodeId: "1:15" },
  { step: 7, name: "Header", level: "organism", context: "uses: <Logo>, <Nav>, <SearchBar>", nodeId: "1:300" },
];

export const Organism: Story = {
  args: {
    info: organismInfo,
    exportPlan: organismExportPlan,
  },
};

/* ── Unclassified ── */

const unclassifiedInfo: AtomicInfo = {
  name: "hero-section",
  nodeId: "1:400",
  level: "unclassified",
  isComponentized: false,
  componentCount: 0,
  instanceCount: 5,
  depth: 3,
  subComponents: [],
  significantFrames: ["headline-block", "image-wrapper", "cta-row", "badge-group"],
  dependencyTree: {
    name: "hero-section",
    level: "unclassified",
    children: [
      { name: "headline-block", level: "unclassified", children: [] },
      { name: "image-wrapper", level: "unclassified", children: [] },
      { name: "cta-row", level: "unclassified", children: [] },
    ],
  },
};

export const Unclassified: Story = {
  args: {
    info: unclassifiedInfo,
  },
};
