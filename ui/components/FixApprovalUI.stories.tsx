import { useState, useCallback } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FixApprovalUI } from "./FixApprovalUI";
import type { RefactorProposal } from "../../web/src/lib/agents/v6/self-improve/RefactorAgent";
import type { ProposalDecision, ProposalEntry } from "../../web/src/lib/agents/v6/fix/useFixApproval";

// ─── Mock data ───

function makeProposal(
  id: string,
  kind: RefactorProposal["kind"],
  file: string,
  line: number,
  before: string,
  after: string,
  risk: "low" | "medium" | "high",
  rationale: string,
): RefactorProposal {
  return { id, kind, file, line, before, after, risk, rationale };
}

const MOCK_PROPOSALS: RefactorProposal[] = [
  makeProposal(
    "ref:1",
    "any-to-unknown",
    "src/api/handler.ts",
    12,
    "export function handle(req: any): any {",
    "export function handle(req: unknown): unknown {",
    "low",
    "Replace unsafe `any` with `unknown` to catch type errors at usage site",
  ),
  makeProposal(
    "ref:2",
    "any-to-unknown",
    "src/api/handler.ts",
    28,
    "  const data: any = await parseBody(req);",
    "  const data: unknown = await parseBody(req);",
    "medium",
    "Return value should be narrowed explicitly rather than assumed as any",
  ),
  makeProposal(
    "ref:3",
    "remove-unused-disable",
    "src/utils/format.ts",
    1,
    "// eslint-disable-next-line @typescript-eslint/no-unused-vars",
    "",
    "low",
    "The next line no longer triggers the disabled rule",
  ),
  makeProposal(
    "ref:4",
    "extract-large-function",
    "src/core/engine.ts",
    45,
    "export function processDesign(/* ... 120 lines ... */) {",
    "export function processDesign(/* extracted into 3 helpers */) {",
    "high",
    "Function exceeds 80-line threshold. Extract validation, transformation, and output steps.",
  ),
];

const MOCK_DIFF = `diff --git a/src/api/handler.ts b/src/api/handler.ts
--- a/src/api/handler.ts
+++ b/src/api/handler.ts
@@ -10,7 +10,7 @@
 import { Router } from "express";

-export function handle(req: any): any {
+export function handle(req: unknown): unknown {
   const router = Router();

@@ -26,7 +26,7 @@
   try {
-  const data: any = await parseBody(req);
+  const data: unknown = await parseBody(req);
     return transform(data);

diff --git a/src/utils/format.ts b/src/utils/format.ts
--- a/src/utils/format.ts
+++ b/src/utils/format.ts
@@ -1,2 +1,1 @@
-// eslint-disable-next-line @typescript-eslint/no-unused-vars
 export function formatDate(d: Date): string {
`;

const MOCK_UNAPPLIABLE = [
  { id: "ref:stale-1", reason: 'line drift — expected "const old = true;" got "const updated = true;"' },
];

// ─── Stateful wrapper for interactive stories ───

function StatefulFixApproval(props: {
  proposals: RefactorProposal[];
  diff: string;
  files: string[];
  unappliable: { id: string; reason: string }[];
}) {
  const [entries, setEntries] = useState<ProposalEntry[]>(
    props.proposals.map((p) => ({ proposal: p, decision: "pending" as const })),
  );
  const [applying, setApplying] = useState(false);

  const decide = useCallback((id: string, decision: ProposalDecision) => {
    setEntries((prev) => prev.map((e) => (e.proposal.id === id ? { ...e, decision } : e)));
  }, []);

  const approveAll = useCallback(() => {
    setEntries((prev) => prev.map((e) => ({ ...e, decision: "approved" as const })));
  }, []);

  const rejectAll = useCallback(() => {
    setEntries((prev) => prev.map((e) => ({ ...e, decision: "rejected" as const })));
  }, []);

  const reset = useCallback(() => {
    setEntries((prev) => prev.map((e) => ({ ...e, decision: "pending" as const })));
  }, []);

  const counts = entries.reduce(
    (acc, e) => {
      acc[e.decision]++;
      return acc;
    },
    { pending: 0, approved: 0, rejected: 0, total: entries.length },
  );

  const approvedProposals = entries.filter((e) => e.decision === "approved").map((e) => e.proposal);

  const handleApply = useCallback(
    (_approved: RefactorProposal[]) => {
      setApplying(true);
      setTimeout(() => setApplying(false), 2000);
    },
    [],
  );

  return (
    <FixApprovalUI
      entries={entries}
      diff={props.diff}
      files={props.files}
      unappliable={props.unappliable}
      counts={counts}
      approvedProposals={approvedProposals}
      onDecide={decide}
      onApproveAll={approveAll}
      onRejectAll={rejectAll}
      onReset={reset}
      onApply={handleApply}
      applying={applying}
    />
  );
}

// ─── Meta ───

const meta: Meta<typeof FixApprovalUI> = {
  component: FixApprovalUI,
  title: "Agent Fleet v6/FixApprovalUI",
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
};
export default meta;

type Story = StoryObj<typeof FixApprovalUI>;

// ─── Stories ───

export const Default: Story = {
  render: () => (
    <StatefulFixApproval
      proposals={MOCK_PROPOSALS}
      diff={MOCK_DIFF}
      files={["src/api/handler.ts", "src/utils/format.ts", "src/core/engine.ts"]}
      unappliable={MOCK_UNAPPLIABLE}
    />
  ),
};

export const AllApproved: Story = {
  render: () => {
    const entries: ProposalEntry[] = MOCK_PROPOSALS.map((p) => ({
      proposal: p,
      decision: "approved" as const,
    }));
    return (
      <FixApprovalUI
        entries={entries}
        diff={MOCK_DIFF}
        files={["src/api/handler.ts", "src/utils/format.ts"]}
        unappliable={[]}
        counts={{ pending: 0, approved: 4, rejected: 0, total: 4 }}
        approvedProposals={MOCK_PROPOSALS}
        onDecide={() => {}}
        onApproveAll={() => {}}
        onRejectAll={() => {}}
        onReset={() => {}}
        onApply={() => {}}
      />
    );
  },
};

export const MixedDecisions: Story = {
  render: () => {
    const entries: ProposalEntry[] = MOCK_PROPOSALS.map((p, i) => ({
      proposal: p,
      decision: (i % 3 === 0 ? "approved" : i % 3 === 1 ? "rejected" : "pending") as ProposalDecision,
    }));
    return (
      <FixApprovalUI
        entries={entries}
        diff={MOCK_DIFF}
        files={["src/api/handler.ts", "src/utils/format.ts"]}
        unappliable={MOCK_UNAPPLIABLE}
        counts={{ pending: 1, approved: 2, rejected: 1, total: 4 }}
        approvedProposals={entries.filter((e) => e.decision === "approved").map((e) => e.proposal)}
        onDecide={() => {}}
        onApproveAll={() => {}}
        onRejectAll={() => {}}
        onReset={() => {}}
        onApply={() => {}}
      />
    );
  },
};

export const Empty: Story = {
  render: () => (
    <FixApprovalUI
      entries={[]}
      diff=""
      files={[]}
      unappliable={[]}
      counts={{ pending: 0, approved: 0, rejected: 0, total: 0 }}
      approvedProposals={[]}
      onDecide={() => {}}
      onApproveAll={() => {}}
      onRejectAll={() => {}}
      onReset={() => {}}
      onApply={() => {}}
    />
  ),
};

export const SingleProposal: Story = {
  render: () => (
    <StatefulFixApproval
      proposals={[MOCK_PROPOSALS[0]]}
      diff={MOCK_DIFF.split("\n").slice(0, 10).join("\n")}
      files={["src/api/handler.ts"]}
      unappliable={[]}
    />
  ),
};
