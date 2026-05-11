import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Screen } from "../design/screenGenerator";

export interface ProjectVersion {
  id: string;
  projectId: string;
  designMd: string;
  screens: Screen[];
  createdAt: string;
}

interface ProjectVersionRow {
  id: string;
  project_id: string;
  design_md: string;
  screens: Screen[];
  created_at: string;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

if (!supabase) {
  console.warn("Supabase is not configured. Project persistence will use local-only behavior.");
}

function toProjectVersion(row: ProjectVersionRow): ProjectVersion {
  return {
    id: row.id,
    projectId: row.project_id,
    designMd: row.design_md,
    screens: row.screens,
    createdAt: row.created_at,
  };
}

export async function saveProjectVersion(projectId: string, markdown: string, screens: Screen[]): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from("project_versions").insert({
    project_id: projectId,
    design_md: markdown,
    screens,
  });

  if (error) throw error;
}

export async function loadLatestVersion(projectId: string): Promise<ProjectVersion | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("project_versions")
    .select("id, project_id, design_md, screens, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ProjectVersionRow>();

  if (error) throw error;
  return data ? toProjectVersion(data) : null;
}

export async function listVersions(projectId: string): Promise<ProjectVersion[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("project_versions")
    .select("id, project_id, design_md, screens, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .returns<ProjectVersionRow[]>();

  if (error) throw error;
  return (data ?? []).map(toProjectVersion);
}
