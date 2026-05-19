-- Migration 004: Agent run history for SelfAuditAgent + BenchmarkAgent
-- Stores every agent execution for performance tracking and self-improvement.

CREATE TABLE IF NOT EXISTS agent_runs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id        TEXT NOT NULL,                        -- orchestration run ID
  project_id    UUID REFERENCES project_versions(id) ON DELETE CASCADE,
  agent_id      TEXT NOT NULL,                        -- e.g. "self-improve.refactor"
  fleet         TEXT NOT NULL,                        -- e.g. "self-improve"
  success       BOOLEAN NOT NULL DEFAULT false,
  cost_usd      NUMERIC(10, 6) NOT NULL DEFAULT 0,
  latency_ms    INTEGER NOT NULL DEFAULT 0,
  error         TEXT,
  input_summary TEXT,                                 -- truncated input for debugging
  output_summary TEXT,                                -- truncated output
  evidence      JSONB DEFAULT '[]'::jsonb,            -- evidence references
  files_modified TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_id   ON agent_runs (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_run_id     ON agent_runs (run_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_project_id ON agent_runs (project_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created_at ON agent_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_fleet      ON agent_runs (fleet);

-- RLS: users can only see runs for their projects
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their project agent runs"
  ON agent_runs FOR SELECT
  USING (
    project_id IN (
      SELECT pv.id FROM project_versions pv
      JOIN project_members pm ON pm.project_id = pv.project_id
      WHERE pm.user_id = auth.uid()
    )
  );

-- Service role can insert (agents run server-side)
CREATE POLICY "Service role can insert agent runs"
  ON agent_runs FOR INSERT
  WITH CHECK (true);

-- Aggregation view: agent health metrics
CREATE OR REPLACE VIEW agent_health_summary AS
SELECT
  agent_id,
  fleet,
  COUNT(*)                                              AS total_runs,
  COUNT(*) FILTER (WHERE success)                       AS successful_runs,
  ROUND(COUNT(*) FILTER (WHERE success)::numeric / NULLIF(COUNT(*), 0), 4) AS success_rate,
  ROUND(AVG(latency_ms))                                AS avg_latency_ms,
  ROUND(SUM(cost_usd)::numeric, 6)                      AS total_cost_usd,
  ROUND(AVG(cost_usd)::numeric, 6)                       AS avg_cost_per_run,
  MAX(created_at)                                        AS last_run_at
FROM agent_runs
GROUP BY agent_id, fleet
ORDER BY success_rate ASC, total_runs DESC;

COMMENT ON TABLE agent_runs IS 'Agent Fleet v6 execution history for self-audit and benchmarking';
COMMENT ON VIEW agent_health_summary IS 'Aggregated agent health metrics for SelfAuditAgent';
