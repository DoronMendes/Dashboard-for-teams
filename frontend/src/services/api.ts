/**
 * One function per backend endpoint. Components and hooks import from here and
 * never touch axios directly, so a transport change stays in this folder.
 */

import { apiBaseURL, apiClient } from "@/services/apiClient";
import type {
  Link,
  LinkCreate,
  LinkUpdate,
  ListProjectsParams,
  Project,
  ProjectCreate,
  ProjectUpdate,
  User,
  UserPreferences,
  ActivityEvent,
  Analytics,
  Notification,
  Workspace,
  Team,
  ClickTrendPoint,
  ActiveUsersMetric,
  TopProjectMetric,
  HealthSummary,
} from "@/types";

export function getGoogleLoginUrl(): string {
  const nonce = crypto.randomUUID();
  return `${apiBaseURL}/auth/google/login?frontend=true&nonce=${encodeURIComponent(nonce)}`;
}

export async function getCurrentUser(): Promise<User> {
  const { data } = await apiClient.get<User>("/auth/me");
  return data;
}

export async function updateUserAvatar(avatar: string | null): Promise<User> {
  return (await apiClient.put<User>("/auth/me/avatar", { avatar })).data;
}

export async function updateUserPreferences(preferences: UserPreferences): Promise<User> {
  return (await apiClient.put<User>("/auth/me/preferences", preferences)).data;
}

export async function getProjects(params: ListProjectsParams = {}): Promise<Project[]> {
  const { data } = await apiClient.get<Project[]>("/projects", {
    // Drop empty values so the query string stays clean.
    params: {
      q: params.q?.trim() || undefined,
      skip: params.skip,
      limit: params.limit,
    },
  });
  return data;
}

export async function getProject(projectId: string): Promise<Project> {
  const { data } = await apiClient.get<Project>(`/projects/${projectId}`);
  return data;
}

export async function createProject(payload: ProjectCreate): Promise<Project> {
  const { data } = await apiClient.post<Project>("/projects", payload);
  return data;
}

export async function updateProject(
  projectId: string,
  payload: ProjectUpdate,
): Promise<Project> {
  const { data } = await apiClient.put<Project>(`/projects/${projectId}`, payload);
  return data;
}

export async function deleteProject(projectId: string): Promise<void> {
  await apiClient.delete(`/projects/${projectId}`);
}

export async function reorderProjects(ids: string[]): Promise<void> {
  await apiClient.put("/projects/reorder", { ids });
}

export async function createLink(projectId: string, payload: LinkCreate): Promise<Link> {
  const { data } = await apiClient.post<Link>(`/projects/${projectId}/links`, payload);
  return data;
}

export async function updateLink(linkId: string, payload: LinkUpdate): Promise<Link> {
  const { data } = await apiClient.put<Link>(`/links/${linkId}`, payload);
  return data;
}

export async function deleteLink(linkId: string): Promise<void> {
  await apiClient.delete(`/links/${linkId}`);
}

export async function checkLinkHealth(linkId: string): Promise<Link> {
  return (await apiClient.post<Link>(`/links/${linkId}/check-health`)).data;
}

export async function checkAllLinkHealth(): Promise<number> {
  return (await apiClient.post<{ queued: number }>("/links/check-all-health")).data.queued;
}

export async function setLinkBookmark(linkId: string, enabled: boolean): Promise<Link> {
  const { data } = enabled ? await apiClient.put<Link>(`/links/${linkId}/bookmark`) : await apiClient.delete<Link>(`/links/${linkId}/bookmark`);
  return data;
}

export async function reorderLinks(projectId: string, ids: string[]): Promise<void> {
  await apiClient.put(`/projects/${projectId}/links/reorder`, { ids });
}

export async function getActivity(): Promise<ActivityEvent[]> { return (await apiClient.get<ActivityEvent[]>("/activity")).data; }
export async function getAnalytics(): Promise<Analytics> { return (await apiClient.get<Analytics>("/analytics")).data; }
export async function getClicksTrend(interval: "daily" | "weekly" | "monthly"): Promise<ClickTrendPoint[]> { return (await apiClient.get<ClickTrendPoint[]>("/analytics/clicks-trend", { params: { interval, range: "30d" } })).data; }
export async function getActiveUsers(range: "7d" | "30d" | "all"): Promise<ActiveUsersMetric> { return (await apiClient.get<ActiveUsersMetric>("/analytics/active-users", { params: { range } })).data; }
export async function getTopProjects(limit = 5): Promise<TopProjectMetric[]> { return (await apiClient.get<TopProjectMetric[]>("/analytics/top-projects", { params: { limit } })).data; }
export async function getHealthSummary(): Promise<HealthSummary> { return (await apiClient.get<HealthSummary>("/analytics/health-summary")).data; }
export async function getNotifications(): Promise<Notification[]> { return (await apiClient.get<Notification[]>("/notifications")).data; }
export async function getUnreadNotificationCount(): Promise<number> { return (await apiClient.get<{ count: number }>("/notifications/unread-count")).data.count; }
export async function markAllNotificationsRead(): Promise<void> { await apiClient.put("/notifications/read-all"); }
export async function recordLinkVisit(linkId: string): Promise<string> { return (await apiClient.post<{ url: string }>(`/links/${linkId}/visit`)).data.url; }
export async function getWorkspaces(): Promise<Workspace[]> { return (await apiClient.get<Workspace[]>("/workspaces")).data; }
export async function createTeam(workspaceId: string, name: string): Promise<Team> { return (await apiClient.post<Team>(`/workspaces/${workspaceId}/teams`, { name })).data; }
export async function addWorkspaceMember(workspaceId: string, email: string, role: string): Promise<void> { await apiClient.post(`/workspaces/${workspaceId}/invitations`, { email, role }); }
export async function removeWorkspaceMember(workspaceId: string, memberId: string): Promise<void> { await apiClient.delete(`/workspaces/${workspaceId}/members/${memberId}`); }
