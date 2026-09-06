import { useEffect, useRef, useState } from "react";
import { Activity, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, FolderKanban, LayoutGrid, List, XCircle } from "lucide-react";
import { useLocation } from "react-router";

import { useToast } from "@/components/feedback/Toast";
import { IssueReportModal } from "@/components/feedback/IssueReportModal";
import { LinkForm } from "@/components/forms/LinkForm";
import { ProjectForm } from "@/components/forms/ProjectForm";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { ContextPanel } from "@/components/layout/ContextPanel";
import { AdminPanel } from "@/components/layout/AdminPanel";
import { SettingsPanel } from "@/components/layout/FeaturePanels";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { SpreadsheetImportPanel } from "@/components/imports/SpreadsheetImportPanel";
import { ProjectGrid } from "@/components/projects/ProjectGrid";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useDialogs } from "@/hooks/useDialogs";
import { useActivity, useAnalytics, useCheckAllLinkHealth, useDeleteLink, useDeleteProject, useMarkAllNotificationsRead, useNotifications, useProjects, useUnreadNotificationCount, useUpdateProject, useWorkspaces } from "@/hooks/useProjects";
import { ApiError } from "@/services/apiClient";
import { useAuth } from "@/auth/AuthContext";
import type { UserPreferences } from "@/types";

function preferenceStorageKey(userId: string): string {
  return `dashboard-preferences:${userId}`;
}

function readCachedPreferences(userId: string): UserPreferences {
  try {
    return JSON.parse(localStorage.getItem(preferenceStorageKey(userId)) ?? "{}") as UserPreferences;
  } catch {
    return {};
  }
}

function cachePreferences(userId: string, preferences: UserPreferences): void {
  const current = readCachedPreferences(userId);
  localStorage.setItem(preferenceStorageKey(userId), JSON.stringify({ ...current, ...preferences }));
}

export function DashboardPage() {
  const { user, setPreferences } = useAuth();
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState<"rtl" | "ltr">(() => user?.direction ?? "rtl");
  const [theme, setTheme] = useState<"light" | "dark">(() => user?.theme ?? "light");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => user?.sidebar_collapsed ?? false);
  const [contextOpen, setContextOpen] = useState(false);
  const [issueReportOpen, setIssueReportOpen] = useState(false);
  const [tagFilter, setTagFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => user?.view_mode ?? "grid");
  const location = useLocation();
  const debouncedSearch = useDebouncedValue(search, 250);
  const dialogs = useDialogs();
  const { notify } = useToast();
  const deleteProject = useDeleteProject();
  const deleteLink = useDeleteLink();
  const updateProject = useUpdateProject();
  const { mutateAsync: checkAllLinkHealth } = useCheckAllLinkHealth();
  const automaticHealthCheckRunning = useRef(false);
  const { data: projects } = useProjects(debouncedSearch);
  const { data: activity } = useActivity();
  const { data: analytics } = useAnalytics();
  const { data: notifications } = useNotifications();
  const { data: unreadCount } = useUnreadNotificationCount();
  const markAllNotificationsRead = useMarkAllNotificationsRead();
  const { data: workspaces } = useWorkspaces();
  const route = location.pathname;
  const pageTitles: Record<string, [string, string]> = { "/": ["הפרויקטים שלנו", "Our projects"], "/bookmarks": ["הסימניות שלי", "My bookmarks"], "/analytics": ["אנליטיקס", "Analytics"], "/excel-import": ["ייבוא מאקסל", "Excel Import"], "/settings": ["הגדרות", "Settings"], "/admin": ["הרשאות וניהול", "Permissions / Admin"] };
  const pageTitle = pageTitles[route] ?? pageTitles["/"];
  const showProjects = route === "/" || route === "/bookmarks";
  const availableTags = [...new Set((projects ?? []).flatMap((project) => project.links.flatMap((link) => link.tags)))].sort();
  const dashboardLinks = (projects ?? []).flatMap((project) => project.links);
  const dashboardSummary = {
    projects: projects?.length ?? 0,
    healthy: dashboardLinks.filter((link) => link.health_status === "healthy").length,
    error: dashboardLinks.filter((link) => link.health_status === "error").length,
    unchecked: dashboardLinks.filter((link) => link.health_status === "checking" || !link.last_checked_at).length,
  };

  useEffect(() => {
    if (!user) return;
    const cached = readCachedPreferences(user.id);
    setDirection(user.direction === "ltr" ? "ltr" : user.direction === "rtl" ? "rtl" : cached.direction === "ltr" ? "ltr" : "rtl");
    setTheme(user.theme === "dark" ? "dark" : user.theme === "light" ? "light" : cached.theme === "dark" ? "dark" : "light");
    setViewMode(user.view_mode === "list" ? "list" : user.view_mode === "grid" ? "grid" : cached.view_mode === "list" ? "list" : "grid");
    setSidebarCollapsed(typeof user.sidebar_collapsed === "boolean" ? user.sidebar_collapsed : cached.sidebar_collapsed === true);
  }, [user]);
  useEffect(() => { document.documentElement.dir = direction; document.documentElement.lang = direction === "rtl" ? "he" : "en"; }, [direction]);
  useEffect(() => { document.documentElement.classList.toggle("dark", theme === "dark"); document.documentElement.style.colorScheme = theme; }, [theme]);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.ctrlKey && event.key.toLowerCase() === "k") { event.preventDefault(); document.querySelector<HTMLInputElement>('input[type="search"]')?.focus(); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, []);
  useEffect(() => {
    const runAutomaticHealthCheck = async () => {
      if (automaticHealthCheckRunning.current) return;
      automaticHealthCheckRunning.current = true;
      try {
        await checkAllLinkHealth();
      } catch {
        // A later scheduled run will retry without interrupting the dashboard.
      } finally {
        automaticHealthCheckRunning.current = false;
      }
    };

    const initialCheck = window.setTimeout(() => void runAutomaticHealthCheck(), 2_000);
    const halfHourlyCheck = window.setInterval(
      () => void runAutomaticHealthCheck(),
      30 * 60 * 1_000,
    );

    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(halfHourlyCheck);
    };
  }, [checkAllLinkHealth]);

  const reportFailure = (error: unknown, fallback: string) => {
    notify(error instanceof ApiError ? error.message : fallback, "error");
  };

  const changeDirection = () => {
    const next = direction === "rtl" ? "ltr" : "rtl";
    setDirection(next);
    if (user) cachePreferences(user.id, { direction: next });
    void setPreferences({ direction: next }).catch((error) => reportFailure(error, "לא ניתן היה לשמור את כיוון הממשק."));
  };
  const changeTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (user) cachePreferences(user.id, { theme: next });
    void setPreferences({ theme: next }).catch((error) => reportFailure(error, "לא ניתן היה לשמור את ערכת הנושא."));
  };
  const changeViewMode = (next: "grid" | "list") => {
    setViewMode(next);
    if (user) cachePreferences(user.id, { view_mode: next });
    void setPreferences({ view_mode: next }).catch((error) => reportFailure(error, "לא ניתן היה לשמור את מצב התצוגה."));
  };
  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    if (user) cachePreferences(user.id, { sidebar_collapsed: next });
    void setPreferences({ sidebar_collapsed: next }).catch((error) => reportFailure(error, "לא ניתן היה לשמור את מצב סרגל הצד."));
  };

  const { dialog } = dialogs;

  return (
    <div className="flex min-h-dvh bg-[#EEF0ED]" dir={direction}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} onReportIssue={() => setIssueReportOpen(true)} direction={direction} workspaces={workspaces ?? []} teamFilter={teamFilter} onTeamFilterChange={setTeamFilter} />
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
      <Header
        search={search}
        onSearchChange={setSearch}
        onNewProject={dialogs.createProject}
        onNewLink={() => projects?.length ? dialogs.addGlobalLink() : dialogs.createProject()}
        direction={direction}
        onDirectionChange={changeDirection}
        tagFilter={tagFilter}
        onTagFilterChange={setTagFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        tags={availableTags}
        unreadCount={unreadCount ?? 0}
        notifications={notifications ?? []}
        onNotificationsOpen={() => {
          if ((unreadCount ?? 0) > 0 && !markAllNotificationsRead.isPending) markAllNotificationsRead.mutate();
        }}
        theme={theme}
        onThemeChange={changeTheme}
      />
      <div className="flex flex-1 flex-col xl:flex-row">
      <main className="workspace-canvas min-w-0 flex-1 bg-[#EEF0ED] px-4 py-6 lg:px-8 lg:py-10">
        <div className="mb-8 flex flex-wrap items-end gap-4"><h1 className="font-display text-3xl font-extrabold tracking-[-0.035em] text-slate-950 lg:text-4xl">{direction === "rtl" ? pageTitle[0] : pageTitle[1]}</h1>{showProjects && <div className="ms-auto flex items-center gap-0.5 rounded-xl border border-black/[0.05] bg-white p-0.5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]"><button onClick={() => changeViewMode("grid")} className={`grid size-7 place-items-center rounded-lg ${viewMode === "grid" ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:bg-slate-50"}`} aria-label="Grid view"><LayoutGrid className="size-3.5" /></button><button onClick={() => changeViewMode("list")} className={`grid size-7 place-items-center rounded-lg ${viewMode === "list" ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:bg-slate-50"}`} aria-label="List view"><List className="size-3.5" /></button></div>}</div>
        {showProjects && <div className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={FolderKanban} label={direction === "rtl" ? "כל הפרויקטים" : "Total projects"} value={dashboardSummary.projects} featured />
          <SummaryCard icon={CheckCircle2} label={direction === "rtl" ? "קישורים תקינים" : "Healthy links"} value={dashboardSummary.healthy} tone="emerald" />
          <SummaryCard icon={XCircle} label={direction === "rtl" ? "קישורים עם שגיאה" : "Links with errors"} value={dashboardSummary.error} tone="rose" />
          <SummaryCard icon={CircleHelp} label={direction === "rtl" ? "טרם נבדקו" : "Not checked yet"} value={dashboardSummary.unchecked} tone="slate" />
        </div>}
        {showProjects ? <ProjectGrid
          viewMode={viewMode}
          tagFilter={tagFilter}
          categoryFilter={categoryFilter}
          bookmarkedOnly={route === "/bookmarks"}
          teamFilter={teamFilter}
          search={debouncedSearch}
          onClearSearch={() => setSearch("")}
          onCreateProject={dialogs.createProject}
          onEditProject={dialogs.editProject}
          onDeleteProject={dialogs.deleteProject}
          onTogglePin={(project) => {
            const nextPinned = !project.is_pinned;
            updateProject.mutate(
              { id: project.id, payload: { is_pinned: nextPinned } },
              {
                onSuccess: () => {
                  notify(
                    nextPinned
                      ? `הפרויקט "${project.name}" הוצמד לראש הרשימה.`
                      : `ההצמדה של "${project.name}" בוטלה.`,
                  );
                },
                onError: (error) =>
                  reportFailure(error, "לא ניתן היה לעדכן את ההצמדה."),
              },
            );
          }}
          onAddLink={dialogs.addLink}
          onEditLink={dialogs.editLink}
          onDeleteLink={dialogs.deleteLink}
        /> : route === "/admin" ? <AdminPanel workspaces={workspaces ?? []} direction={direction} /> : route === "/analytics" ? <AnalyticsDashboard direction={direction} /> : route === "/excel-import" ? <SpreadsheetImportPanel workspaces={workspaces ?? []} direction={direction} /> : route === "/settings" ? <SettingsPanel direction={direction} onDirectionChange={changeDirection} viewMode={viewMode} onViewModeChange={changeViewMode} theme={theme} onThemeChange={changeTheme} /> : <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-20 text-center text-sm text-slate-400">{direction === "rtl" ? "אין עדיין נתונים להצגה." : "No data to display yet."}</div>}
      </main>
      <ContextPanel open={contextOpen} onClose={() => setContextOpen(false)} direction={direction} activity={activity} analytics={analytics} />
      </div>
      </div>

      {!contextOpen && (
        <button
          type="button"
          onClick={() => setContextOpen(true)}
          className={`fixed top-1/2 z-30 grid h-11 w-7 -translate-y-1/2 place-items-center border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:bg-indigo-50 hover:text-indigo-700 ${
            direction === "rtl"
              ? "left-0 rounded-r-xl border-l-0"
              : "right-0 rounded-l-xl border-r-0"
          }`}
          aria-label={direction === "rtl" ? "פתיחת פעילות אחרונה" : "Open recent activity"}
          title={direction === "rtl" ? "פתיחת פעילות אחרונה" : "Open recent activity"}
        >
          {direction === "rtl" ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
        </button>
      )}

      <IssueReportModal
        open={issueReportOpen}
        onClose={() => setIssueReportOpen(false)}
        direction={direction}
        workspaces={workspaces ?? []}
      />

      {dialog.kind === "project-create" && (
        <ProjectForm open onClose={dialogs.close} />
      )}

      {dialog.kind === "project-edit" && (
        <ProjectForm
          key={dialog.project.id}
          open
          project={dialog.project}
          onClose={dialogs.close}
        />
      )}

      {dialog.kind === "link-create" && (
        <LinkForm
          key={`new-${dialog.project.id}`}
          open
          projectId={dialog.project.id}
          projectName={dialog.project.name}
          onClose={dialogs.close}
        />
      )}

      {dialog.kind === "link-create-global" && (
        <LinkForm key="new-global" open projects={projects ?? []} onClose={dialogs.close} />
      )}

      {dialog.kind === "link-edit" && (
        <LinkForm
          key={dialog.link.id}
          open
          projectId={dialog.project.id}
          projectName={dialog.project.name}
          link={dialog.link}
          onClose={dialogs.close}
        />
      )}

      {dialog.kind === "project-delete" && (
        <ConfirmDialog
          open
          title={`למחוק את "${dialog.project.name}"?`}
          body={
            dialog.project.links.length > 0
              ? `הפעולה תמחק גם ${
                  dialog.project.links.length === 1
                    ? "קישור אחד"
                    : `${dialog.project.links.length} קישורים`
                } המשויכים לפרויקט. לא ניתן לבטל את הפעולה.`
              : "לא ניתן לבטל את הפעולה."
          }
          confirmLabel="מחיקת הפרויקט"
          busy={deleteProject.isPending}
          onCancel={dialogs.close}
          onConfirm={() => {
            const { name, id } = dialog.project;
            deleteProject.mutate(id, {
              onSuccess: () => {
                notify(`הפרויקט "${name}" נמחק.`);
                dialogs.close();
              },
              onError: (error) => {
                reportFailure(error, "לא ניתן היה למחוק את הפרויקט.");
                dialogs.close();
              },
            });
          }}
        />
      )}

      {dialog.kind === "link-delete" && (
        <ConfirmDialog
          open
          title={`למחוק את "${dialog.link.title}"?`}
          body="לא ניתן לבטל את הפעולה."
          confirmLabel="מחיקת הקישור"
          busy={deleteLink.isPending}
          onCancel={dialogs.close}
          onConfirm={() => {
            const { title, id } = dialog.link;
            deleteLink.mutate(id, {
              onSuccess: () => {
                notify(`הקישור "${title}" נמחק.`);
                dialogs.close();
              },
              onError: (error) => {
                reportFailure(error, "לא ניתן היה למחוק את הקישור.");
                dialogs.close();
              },
            });
          }}
        />
      )}
      <button className="fixed bottom-5 end-5 z-20 grid size-12 place-items-center rounded-2xl bg-slate-900 text-white shadow-xl md:hidden" aria-label="Activity"><Activity className="size-5" /></button>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, featured = false, tone = "slate" }: { icon: typeof Activity; label: string; value: number; featured?: boolean; tone?: "emerald" | "rose" | "slate" }) {
  const toneClasses = tone === "emerald" ? "bg-emerald-50 text-emerald-700" : tone === "rose" ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500";
  return <section className={`rounded-[18px] p-5 ${featured ? "bg-[#0B3FC1] text-white shadow-[0_16px_34px_rgba(11,63,193,0.22)]" : "border border-black/[0.045] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.045)]"}`}>
    <div className="flex min-h-20 items-center justify-between gap-4">
      <span className={`self-start pt-2 text-xs font-bold ${featured ? "text-blue-100" : "text-slate-400"}`}>{label}</span>
      <div className="flex shrink-0 items-center gap-3">
        <p className={`font-display text-4xl font-extrabold tracking-tight ${featured ? "text-white" : "text-slate-950"}`}>{value}</p>
        <span className={`grid size-10 place-items-center rounded-xl ${featured ? "bg-white/15 text-white" : toneClasses}`}><Icon className="size-5" /></span>
      </div>
    </div>
  </section>;
}
