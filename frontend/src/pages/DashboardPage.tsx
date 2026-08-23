import { useEffect, useState } from "react";
import { Activity, ChevronLeft, ChevronRight, LayoutGrid, List } from "lucide-react";
import { useLocation } from "react-router";

import { useToast } from "@/components/feedback/Toast";
import { LinkForm } from "@/components/forms/LinkForm";
import { ProjectForm } from "@/components/forms/ProjectForm";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { ContextPanel } from "@/components/layout/ContextPanel";
import { AdminPanel } from "@/components/layout/AdminPanel";
import { SettingsPanel } from "@/components/layout/FeaturePanels";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { ProjectGrid } from "@/components/projects/ProjectGrid";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useDialogs } from "@/hooks/useDialogs";
import { useActivity, useAnalytics, useDeleteLink, useDeleteProject, useNotifications, useProjects, useUnreadNotificationCount, useUpdateProject, useWorkspaces } from "@/hooks/useProjects";
import { ApiError } from "@/services/apiClient";

export function DashboardPage() {
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState<"rtl" | "ltr">(() => localStorage.getItem("dashboard-direction") === "ltr" ? "ltr" : "rtl");
  const [theme, setTheme] = useState<"light" | "dark">(() => localStorage.getItem("dashboard-theme") === "dark" ? "dark" : "light");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [contextOpen, setContextOpen] = useState(true);
  const [tagFilter, setTagFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => localStorage.getItem("dashboard-view") === "list" ? "list" : "grid");
  const location = useLocation();
  const debouncedSearch = useDebouncedValue(search, 250);
  const dialogs = useDialogs();
  const { notify } = useToast();
  const deleteProject = useDeleteProject();
  const deleteLink = useDeleteLink();
  const updateProject = useUpdateProject();
  const { data: projects } = useProjects(debouncedSearch);
  const { data: activity } = useActivity();
  const { data: analytics } = useAnalytics();
  const { data: notifications } = useNotifications();
  const { data: unreadCount } = useUnreadNotificationCount();
  const { data: workspaces } = useWorkspaces();
  const route = location.pathname;
  const pageTitles: Record<string, [string, string]> = { "/": ["הפרויקטים שלנו", "Our projects"], "/bookmarks": ["הסימניות שלי", "My bookmarks"], "/analytics": ["אנליטיקס", "Analytics"], "/settings": ["הגדרות", "Settings"], "/admin": ["הרשאות וניהול", "Permissions / Admin"] };
  const pageTitle = pageTitles[route] ?? pageTitles["/"];
  const showProjects = route === "/" || route === "/bookmarks";
  const availableTags = [...new Set((projects ?? []).flatMap((project) => project.links.flatMap((link) => link.tags)))].sort();

  useEffect(() => { document.documentElement.dir = direction; document.documentElement.lang = direction === "rtl" ? "he" : "en"; localStorage.setItem("dashboard-direction", direction); }, [direction]);
  useEffect(() => { document.documentElement.classList.toggle("dark", theme === "dark"); document.documentElement.style.colorScheme = theme; localStorage.setItem("dashboard-theme", theme); }, [theme]);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.ctrlKey && event.key.toLowerCase() === "k") { event.preventDefault(); document.querySelector<HTMLInputElement>('input[type="search"]')?.focus(); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, []);

  const reportFailure = (error: unknown, fallback: string) => {
    notify(error instanceof ApiError ? error.message : fallback, "error");
  };

  const { dialog } = dialogs;

  return (
    <div className="flex min-h-dvh bg-slate-50" dir={direction}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} direction={direction} workspaces={workspaces ?? []} teamFilter={teamFilter} onTeamFilterChange={setTeamFilter} />
      <div className="min-w-0 flex-1">
      <Header
        search={search}
        onSearchChange={setSearch}
        onNewProject={dialogs.createProject}
        onNewLink={() => projects?.length ? dialogs.addGlobalLink() : dialogs.createProject()}
        direction={direction}
        onDirectionChange={() => setDirection((value) => value === "rtl" ? "ltr" : "rtl")}
        tagFilter={tagFilter}
        onTagFilterChange={setTagFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        tags={availableTags}
        unreadCount={unreadCount ?? 0}
        notifications={notifications ?? []}
        theme={theme}
        onThemeChange={() => setTheme((value) => value === "dark" ? "light" : "dark")}
      />
      <div className="flex flex-col xl:flex-row">
      <main className="workspace-canvas min-w-0 flex-1 bg-[#F8FAFC] px-4 py-6 lg:px-8 lg:py-10">
        <div className="mb-8 flex flex-wrap items-end gap-4"><h1 className="text-2xl font-black tracking-tight text-slate-950 lg:text-3xl">{direction === "rtl" ? pageTitle[0] : pageTitle[1]}</h1>{showProjects && <div className="ms-auto flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5"><button onClick={() => { setViewMode("grid"); localStorage.setItem("dashboard-view", "grid"); }} className={`grid size-7 place-items-center rounded-md ${viewMode === "grid" ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:bg-slate-50"}`} aria-label="Grid view"><LayoutGrid className="size-3.5" /></button><button onClick={() => { setViewMode("list"); localStorage.setItem("dashboard-view", "list"); }} className={`grid size-7 place-items-center rounded-md ${viewMode === "list" ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:bg-slate-50"}`} aria-label="List view"><List className="size-3.5" /></button></div>}</div>
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
                      ? `הפרויקט „${project.name}” הוצמד לראש הרשימה.`
                      : `ההצמדה של „${project.name}” בוטלה.`,
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
        /> : route === "/admin" ? <AdminPanel workspaces={workspaces ?? []} direction={direction} /> : route === "/analytics" ? <AnalyticsDashboard direction={direction} /> : route === "/settings" ? <SettingsPanel direction={direction} onDirectionChange={() => setDirection((value) => value === "rtl" ? "ltr" : "rtl")} viewMode={viewMode} onViewModeChange={(value) => { setViewMode(value); localStorage.setItem("dashboard-view", value); }} theme={theme} onThemeChange={() => setTheme((value) => value === "dark" ? "light" : "dark")} /> : <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-20 text-center text-sm text-slate-400">{direction === "rtl" ? "אין עדיין נתונים להצגה." : "No data to display yet."}</div>}
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
          title={`למחוק את „${dialog.project.name}”?`}
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
                notify(`הפרויקט „${name}” נמחק.`);
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
          title={`למחוק את „${dialog.link.title}”?`}
          body="לא ניתן לבטל את הפעולה."
          confirmLabel="מחיקת הקישור"
          busy={deleteLink.isPending}
          onCancel={dialogs.close}
          onConfirm={() => {
            const { title, id } = dialog.link;
            deleteLink.mutate(id, {
              onSuccess: () => {
                notify(`הקישור „${title}” נמחק.`);
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
