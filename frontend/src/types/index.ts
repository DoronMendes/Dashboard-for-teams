/**
 * Mirrors the backend Pydantic schemas.
 *
 * Wire values are lower-case (`"environment"`), matching app/models/enums.py;
 * the capitalised forms are display labels only. Keeping the two apart means a
 * copy change never breaks a request.
 */

export const LINK_CATEGORIES = [
  "environment",
  "docs",
  "code",
  "logs",
  "monitoring",
  "other",
] as const;

export type LinkCategory = (typeof LINK_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<LinkCategory, string> = {
  environment: "סביבה",
  docs: "תיעוד",
  code: "קוד",
  logs: "לוגים",
  monitoring: "ניטור",
  other: "אחר",
};

/** Tailwind classes per category. Written out in full so the compiler can see them. */
export const CATEGORY_STYLES: Record<LinkCategory, { dot: string; text: string }> = {
  environment: { dot: "bg-cat-environment", text: "text-cat-environment" },
  docs: { dot: "bg-cat-docs", text: "text-cat-docs" },
  code: { dot: "bg-cat-code", text: "text-cat-code" },
  logs: { dot: "bg-cat-logs", text: "text-cat-logs" },
  monitoring: { dot: "bg-cat-monitoring", text: "text-cat-monitoring" },
  other: { dot: "bg-cat-other", text: "text-cat-other" },
};

export interface Link {
  id: string;
  project_id: string;
  title: string;
  url: string;
  category: LinkCategory;
  position: number;
  created_at: string;
  updated_at: string;
  tags: string[];
  creator: { id: string; name: string; email: string };
  is_bookmarked: boolean;
}

export interface LinkCreate {
  title: string;
  url: string;
  category?: LinkCategory;
  tags?: string[];
}

export interface LinkUpdate {
  title?: string;
  url?: string;
  category?: LinkCategory;
  tags?: string[];
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  is_pinned: boolean;
  position: number;
  links: Link[];
  created_at: string;
  updated_at: string;
  workspace_id: string;
  team_id: string | null;
}

export interface ProjectCreate {
  name: string;
  description?: string | null;
  is_pinned?: boolean;
  workspace_id?: string;
  team_id?: string | null;
}

export interface ProjectUpdate {
  name?: string;
  description?: string | null;
  is_pinned?: boolean;
  team_id?: string | null;
}

export interface ListProjectsParams {
  q?: string;
  skip?: number;
  limit?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityEvent { id: string; action: string; entity_type: string; entity_id: string | null; project_id: string | null; details: Record<string, unknown>; user: { id: string; name: string; email: string }; created_at: string; updated_at: string; }
export interface Analytics { total_projects: number; total_links: number; total_visits: number; weekly_visits: number; most_visited: { id: string; title: string; url: string; visits: number } | null; }
export interface ClickTrendPoint { date: string; clicks: number; }
export interface ActiveUsersMetric { active_users: number; previous_period_users: number | null; delta_percent: number | null; dau: number; }
export interface TopProjectMetric { id: string; name: string; creator_name: string; creator_email: string; links_count: number; clicks: number; unique_visitors: number; traffic_share: number; }
export interface Notification { id: string; kind: string; message: string; target_path: string | null; is_read: boolean; created_at: string; updated_at: string; }
export interface Team { id: string; workspace_id: string; name: string; created_at: string; updated_at: string; }
export interface Workspace { id: string; name: string; role: "owner" | "admin" | "editor" | "viewer"; teams: Team[]; members: Array<{ id: string; name: string; email: string; role: string }>; created_at: string; updated_at: string; }
