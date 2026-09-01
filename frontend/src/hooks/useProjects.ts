import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryClient";
import * as api from "@/services/api";
import type {
  LinkCreate,
  Link,
  LinkUpdate,
  Project,
  ProjectCreate,
  ProjectUpdate,
} from "@/types";

/**
 * Search runs server-side (the backend's `q` matches name and description),
 * so results stay correct once the list outgrows a single page.
 */
export function useProjects(search: string) {
  return useQuery({
    queryKey: queryKeys.projects(search),
    queryFn: () => api.getProjects({ q: search }),
    placeholderData: (previous) => previous, // keep the grid steady while refetching
    refetchInterval: 30_000,
  });
}

/** Every mutation invalidates the project list, which carries links nested. */
function useInvalidateProjects() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["projects"] });
}

export function useCreateProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (payload: ProjectCreate) => api.createProject(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProjectUpdate }) =>
      api.updateProject(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: invalidate,
  });
}

function reorderByIds<T extends { id: string }>(items: T[], ids: string[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const selected = ids.map((id) => byId.get(id)).filter((item): item is T => Boolean(item));
  if (selected.length !== ids.length) return items;

  const selectedIds = new Set(ids);
  let index = 0;
  return items.map((item) => (selectedIds.has(item.id) ? selected[index++] : item));
}

export function useReorderProjects(search: string) {
  const client = useQueryClient();
  const queryKey = queryKeys.projects(search);

  return useMutation({
    mutationFn: (ids: string[]) => api.reorderProjects(ids),
    scope: { id: "project-order" },
    onMutate: async (ids) => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData<Project[]>(queryKey);
      client.setQueryData<Project[]>(queryKey, (current = []) => reorderByIds(current, ids));
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) client.setQueryData(queryKey, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useCreateLink() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: ({ projectId, payload }: { projectId: string; payload: LinkCreate }) =>
      api.createLink(projectId, payload),
    onSuccess: invalidate,
  });
}

export function useUpdateLink() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: LinkUpdate }) =>
      api.updateLink(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteLink() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (id: string) => api.deleteLink(id),
    onSuccess: invalidate,
  });
}

export function useSetLinkBookmark() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.setLinkBookmark(id, enabled),
    onSuccess: invalidate,
  });
}

export function useCheckLinkHealth() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.checkLinkHealth(id),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: ["projects"] });
      client.setQueriesData<Project[]>({ queryKey: ["projects"] }, (projects) =>
        projects?.map((project) => ({
          ...project,
          links: project.links.map((link) =>
            link.id === id ? { ...link, health_status: "checking" as const } : link,
          ),
        })),
      );
    },
    onSuccess: (checked: Link) => {
      client.setQueriesData<Project[]>({ queryKey: ["projects"] }, (projects) =>
        projects?.map((project) => ({
          ...project,
          links: project.links.map((link) => (link.id === checked.id ? checked : link)),
        })),
      );
      void client.invalidateQueries({ queryKey: ["analytics", "health-summary"] });
    },
    onError: () => client.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useCheckAllLinkHealth() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.checkAllLinkHealth,
    onMutate: () => {
      client.setQueriesData<Project[]>({ queryKey: ["projects"] }, (projects) =>
        projects?.map((project) => ({
          ...project,
          links: project.links.map((link) => ({ ...link, health_status: "checking" as const })),
        })),
      );
    },
    onSuccess: () => {
      window.setTimeout(() => {
        void client.invalidateQueries({ queryKey: ["projects"] });
        void client.invalidateQueries({ queryKey: ["analytics", "health-summary"] });
      }, 6_000);
    },
  });
}

export function useActivity() { return useQuery({ queryKey: ["activity"], queryFn: api.getActivity }); }
export function useAnalytics() { return useQuery({ queryKey: ["analytics"], queryFn: api.getAnalytics }); }
export function useClicksTrend(interval: "daily" | "weekly" | "monthly") { return useQuery({ queryKey: ["analytics", "clicks-trend", interval], queryFn: () => api.getClicksTrend(interval) }); }
export function useActiveUsers(range: "7d" | "30d" | "all") { return useQuery({ queryKey: ["analytics", "active-users", range], queryFn: () => api.getActiveUsers(range) }); }
export function useTopProjects() { return useQuery({ queryKey: ["analytics", "top-projects", 5], queryFn: () => api.getTopProjects(5) }); }
export function useHealthSummary() { return useQuery({ queryKey: ["analytics", "health-summary"], queryFn: api.getHealthSummary, refetchInterval: 30_000 }); }
export function useNotifications() { return useQuery({ queryKey: ["notifications"], queryFn: api.getNotifications }); }
export function useUnreadNotificationCount() { return useQuery({ queryKey: ["notifications", "unread"], queryFn: api.getUnreadNotificationCount }); }
export function useWorkspaces() { return useQuery({ queryKey: ["workspaces"], queryFn: api.getWorkspaces }); }
export function useCreateTeam() { const client = useQueryClient(); return useMutation({ mutationFn: ({ workspaceId, name }: { workspaceId: string; name: string }) => api.createTeam(workspaceId, name), onSuccess: () => client.invalidateQueries({ queryKey: ["workspaces"] }) }); }
export function useAddWorkspaceMember() { const client = useQueryClient(); return useMutation({ mutationFn: ({ workspaceId, email, role }: { workspaceId: string; email: string; role: string }) => api.addWorkspaceMember(workspaceId, email, role), onSuccess: () => client.invalidateQueries({ queryKey: ["workspaces"] }) }); }
export function useRemoveWorkspaceMember() { const client = useQueryClient(); return useMutation({ mutationFn: ({ workspaceId, memberId }: { workspaceId: string; memberId: string }) => api.removeWorkspaceMember(workspaceId, memberId), onSuccess: () => client.invalidateQueries({ queryKey: ["workspaces"] }) }); }

export function useReorderLinks(search: string) {
  const client = useQueryClient();
  const queryKey = queryKeys.projects(search);

  return useMutation({
    mutationFn: ({ projectId, ids }: { projectId: string; ids: string[] }) =>
      api.reorderLinks(projectId, ids),
    scope: { id: "link-order" },
    onMutate: async ({ projectId, ids }) => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData<Project[]>(queryKey);
      client.setQueryData<Project[]>(queryKey, (current = []) =>
        current.map((project) =>
          project.id === projectId
            ? { ...project, links: reorderByIds(project.links, ids) }
            : project,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) client.setQueryData(queryKey, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: ["projects"] }),
  });
}
