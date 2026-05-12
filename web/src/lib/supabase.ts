import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Screen } from "../../../shared/designContext";

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
  console.warn("Supabase not configured. Project versions will save to localStorage only.");
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

function getLocalStorageKey(projectId: string): string {
  return `pv-${projectId}`;
}

function saveLocalProjectVersion(projectId: string, designMd: string, screens: Screen[]): void {
  const version: ProjectVersion = {
    id: `local-${Date.now()}`,
    projectId,
    designMd,
    screens,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(getLocalStorageKey(projectId), JSON.stringify(version));
}

function loadLocalProjectVersion(projectId: string): ProjectVersion | null {
  try {
    const raw = localStorage.getItem(getLocalStorageKey(projectId));
    return raw ? JSON.parse(raw) as ProjectVersion : null;
  } catch {
    return null;
  }
}

export async function saveProjectVersion(projectId: string, designMd: string, screens: Screen[]): Promise<void> {
  if (!supabase) {
    saveLocalProjectVersion(projectId, designMd, screens);
    return;
  }

  try {
    const { error } = await supabase.from("project_versions").insert({
      project_id: projectId,
      design_md: designMd,
      screens,
    });

    if (error) throw error;
  } catch (error) {
    console.warn("Could not save Supabase project version. Falling back to localStorage.", error);
    saveLocalProjectVersion(projectId, designMd, screens);
  }
}

export async function loadLatestVersion(projectId: string): Promise<ProjectVersion | null> {
  if (!supabase) return loadLocalProjectVersion(projectId);

  try {
    const { data, error } = await supabase
      .from("project_versions")
      .select("id, project_id, design_md, screens, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<ProjectVersionRow>();

    if (error) throw error;
    return data ? toProjectVersion(data) : loadLocalProjectVersion(projectId);
  } catch (error) {
    console.warn("Could not load Supabase project version. Falling back to localStorage.", error);
    return loadLocalProjectVersion(projectId);
  }
}

export async function listVersions(projectId: string): Promise<ProjectVersion[]> {
  if (!supabase) {
    const version = loadLocalProjectVersion(projectId);
    return version ? [version] : [];
  }

  try {
    const { data, error } = await supabase
      .from("project_versions")
      .select("id, project_id, design_md, screens, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .returns<ProjectVersionRow[]>();

    if (error) throw error;
    return (data ?? []).map(toProjectVersion);
  } catch (error) {
    console.warn("Could not list Supabase project versions. Falling back to localStorage.", error);
    const version = loadLocalProjectVersion(projectId);
    return version ? [version] : [];
  }
}
