/**
 * Self-Improvement Fleet — barrel
 */
export { SelfDiagnosticAgent } from "./SelfDiagnosticAgent";
export type {
  SelfDiagnosticInput,
  SelfDiagnosticOutput,
  ImprovementCandidate,
  IssueSeverity,
} from "./SelfDiagnosticAgent";

export { TestGenAgent } from "./TestGenAgent";
export type { TestGenInput, TestGenOutput } from "./TestGenAgent";

export { RefactorAgent } from "./RefactorAgent";
export type { RefactorInput, RefactorOutput, RefactorProposal, RefactorKind } from "./RefactorAgent";

export { DependencyAuditAgent } from "./DependencyAuditAgent";
export type {
  DependencyAuditInput,
  DependencyAuditOutput,
  VulnerabilityInfo,
  OutdatedInfo,
} from "./DependencyAuditAgent";

export { SelfAuditAgent } from "./SelfAuditAgent";
export type {
  SelfAuditInput,
  SelfAuditOutput,
  AgentRunRecord,
  AgentHealthReport,
} from "./SelfAuditAgent";

export { BenchmarkAgent } from "./BenchmarkAgent";
export type {
  BenchmarkInput,
  BenchmarkOutput,
  MetricSnapshot,
  MetricDelta,
  ComputedRates,
} from "./BenchmarkAgent";
