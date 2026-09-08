import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";

import { useToast } from "@/components/feedback/Toast";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/Button";
import { ProjectCardSkeleton, StatePanel } from "@/components/ui/StatePanel";
import { useProjects, useReorderLinks, useReorderProjects } from "@/hooks/useProjects";
import { ApiError } from "@/services/apiClient";
import type { Link, Project } from "@/types";

interface ProjectGridProps {
  viewMode?: "grid" | "list";
  tagFilter?: string;
  categoryFilter?: string;
  bookmarkedOnly?: boolean;
  teamFilter?: string;
  healthFilter: "all" | "healthy" | "error";
  search: string;
  onClearSearch: () => void;
  onCreateProject: () => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onTogglePin: (project: Project) => void;
  onAddLink: (project: Project) => void;
  onEditLink: (project: Project, link: Link) => void;
  onDeleteLink: (project: Project, link: Link) => void;
}

export function ProjectGrid({
  viewMode = "grid",
  tagFilter = "",
  categoryFilter = "",
  bookmarkedOnly = false,
  teamFilter = "",
  healthFilter,
  search,
  onClearSearch,
  onCreateProject,
  ...handlers
}: ProjectGridProps) {
  const { data: projects, isPending, isError, error, refetch } = useProjects(search);
  const reorderProjects = useReorderProjects(search);
  const reorderLinks = useReorderLinks(search);
  const { notify } = useToast();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const visibleProjects = (projects ?? [])
    .filter((project) => !teamFilter || project.team_id === teamFilter)
    .map((project) => ({
      ...project,
      links: project.links.filter((link) =>
        (!tagFilter || link.tags.includes(tagFilter))
        && (!categoryFilter || link.category === categoryFilter)
        && (!bookmarkedOnly || link.is_bookmarked)
        && (healthFilter === "all" || link.health_status === healthFilter)
      ),
    }))
    .filter((project) =>
      (!tagFilter && !categoryFilter && !bookmarkedOnly && healthFilter === "all")
      || project.links.length > 0
    );

  function handleProjectDragEnd(event: DragEndEvent) {
    if (!projects) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = projects.findIndex((project) => project.id === active.id);
    const newIndex = projects.findIndex((project) => project.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    if (projects[oldIndex].is_pinned !== projects[newIndex].is_pinned) {
      notify("ניתן לשנות סדר בתוך קבוצת הפרויקטים המוצמדים או הלא־מוצמדים.");
      return;
    }

    const ids = arrayMove(projects, oldIndex, newIndex).map((project) => project.id);
    reorderProjects.mutate(ids, {
      onError: () => notify("לא ניתן היה לשמור את סדר הפרויקטים.", "error"),
    });
  }

  if (isPending) {
    return (
      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <ProjectCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (isError) {
    const message =
      error instanceof ApiError ? error.message : "הבקשה לא הושלמה.";
    return (
      <StatePanel
        title="לא ניתן לטעון את הפרויקטים"
        detail={message}
        action={
          <Button variant="secondary" onClick={() => void refetch()}>
            ניסיון נוסף
          </Button>
        }
      />
    );
  }

  if (visibleProjects.length === 0) {
    if (search) {
      return (
        <StatePanel
          title={`לא נמצאו תוצאות עבור „${search}”`}
          detail="החיפוש מתבצע בשמות ובתיאורי הפרויקטים."
          action={
            <Button variant="secondary" onClick={onClearSearch}>
              ניקוי החיפוש
            </Button>
          }
        />
      );
    }

    if (bookmarkedOnly) {
      return (
        <StatePanel
          title="עדיין לא נשמרו סימניות"
          detail="קישורים שתסמן כסימניה יופיעו כאן לגישה מהירה."
        />
      );
    }

    if (healthFilter === "error") {
      return (
        <StatePanel
          title="לא נמצאו קישורים עם שגיאה"
          detail="כל הקישורים המוצגים כרגע תקינים או שטרם נבדקו."
        />
      );
    }

    if (healthFilter === "healthy") {
      return (
        <StatePanel
          title="לא נמצאו קישורים תקינים"
          detail="אין קישורים תקינים התואמים למסננים הנוכחיים."
        />
      );
    }

    return (
      <StatePanel
        title="עדיין אין פרויקטים"
        detail="צרו פרויקט ראשון כדי לרכז במקום אחד סביבות, תיעוד, מאגרים ולוחות בקרה."
        action={<Button onClick={onCreateProject}>יצירת הפרויקט הראשון</Button>}
      />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleProjectDragEnd}
    >
      <SortableContext
        items={visibleProjects.map((project) => project.id)}
        strategy={rectSortingStrategy}
      >
        <div className={`project-board grid items-start gap-5 lg:gap-6 ${viewMode === "grid" ? "md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" : "grid-cols-1"}`}>
          {visibleProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              {...handlers}
              onReorderLinks={(projectId, ids) => {
                reorderLinks.mutate(
                  { projectId, ids },
                  {
                    onError: () =>
                      notify("לא ניתן היה לשמור את סדר הקישורים.", "error"),
                  },
                );
              }}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
