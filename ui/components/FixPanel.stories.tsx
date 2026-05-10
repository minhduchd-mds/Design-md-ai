import type { Meta, StoryObj } from "@storybook/react-vite";
import { FixPanel } from "./FixPanel";
import type { ScanIssue } from "../../shared/types";

const meta: Meta<typeof FixPanel> = {
  component: FixPanel,
  title: "Components/FixPanel",
  args: {
    onFixesApplied: () => undefined,
  },
};
export default meta;

type Story = StoryObj<typeof FixPanel>;

const mockIssues: ScanIssue[] = [
  {
    id: "naming-generic-1",
    category: "naming",
    severity: "critical",
    message: "Layer uses generic name 'Frame 42'",
    path: "Page > Section > Frame 42",
    suggestion: "Rename to a descriptive name like 'hero-card'",
    nodeId: "1:42",
  },
  {
    id: "naming-generic-2",
    category: "naming",
    severity: "warning",
    message: "Layer uses generic name 'Group 7'",
    path: "Page > Section > Group 7",
    suggestion: "Rename to describe its purpose",
    nodeId: "1:43",
  },
  {
    id: "meta-empty-1",
    category: "meta",
    severity: "warning",
    message: "Empty placeholder frame with no content",
    path: "Page > Section > Empty Frame",
    nodeId: "1:50",
  },
  {
    id: "meta-hidden-1",
    category: "meta",
    severity: "info",
    message: "Hidden layer adds unnecessary weight",
    path: "Page > Section > Old Header",
    nodeId: "1:51",
  },
  {
    id: "meta-hidden-2",
    category: "meta",
    severity: "info",
    message: "Hidden layer adds unnecessary weight",
    path: "Page > Footer > Debug Overlay",
    nodeId: "1:52",
  },
  {
    id: "meta-divider-frame-1",
    category: "meta",
    severity: "warning",
    message: "Thin frame used as divider — convert to line",
    path: "Page > Section > Divider",
    nodeId: "1:60",
  },
];

export const WithIssues: Story = {
  args: {
    issues: mockIssues,
  },
};

export const NoIssues: Story = {
  args: {
    issues: [],
  },
};

export const AfterFix: Story = {
  args: {
    issues: [
      {
        id: "naming-generic-1",
        category: "naming",
        severity: "critical",
        message: "Layer uses generic name 'Rectangle 1'",
        path: "Page > Card > Rectangle 1",
        suggestion: "Rename to 'card-background'",
        nodeId: "2:10",
      },
    ],
  },
};

export const Embedded: Story = {
  args: {
    issues: mockIssues,
    embedded: true,
  },
};
