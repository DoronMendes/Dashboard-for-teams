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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";

import { LinkRow } from "@/components/links/LinkRow";
import type { Link, Project } from "@/types";

interface ProjectCardProps {
  project: Project;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onTogglePin: (project: Project) => void;
  onReorderLinks: (projectId: string, ids: string[]) => void;
  onAddLink: (project: Project) => void;
  onEditLink: (project: Project, link: Link) => void;
  onDeleteLink: (project: Project, link: Link) => void;
}

export function ProjectCard({
  project,
  onEditProject,
  onDeleteProject,
  onTogglePin,
  onReorderLinks,
  onAddLink,
  onEditLink,
  onDeleteLink,
}: ProjectCardProps) {
  const links = project.links;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: project.id,
    transition: {
      duration: 120,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
    },
  });
  const linkSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : transition,
    zIndex: isDragging ? 20 : undefined,
    opacity: isDragging ? 0.72 : 1,
  };

  function handleLinkDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = links.findIndex((link) => link.id === active.id);
    const newIndex = links.findIndex((link) => link.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderLinks(
      project.id,
      arrayMove(links, oldIndex, newIndex).map((link) => link.id),
    );
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`group/card relative flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-slate-300 ${links.length ? "h-[22rem]" : "h-auto"} ${
        isDragging ? "rotate-1 shadow-xl ring-2 ring-indigo-200" : ""
      }`}
    >
      <header className="project-card-header border-b border-slate-100 px-3 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xs font-bold tracking-tight text-slate-900">
            {project.name}
          </h2>

          <span className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              {...attributes}
              {...listeners}
              aria-label={`שינוי מיקום הפרויקט ${project.name}`}
              title="גרירה לשינוי מיקום"
              className="cursor-grab touch-none rounded-md p-1 text-slate-400 transition-colors hover:bg-white hover:text-slate-700 active:cursor-grabbing"
            >
              <GripVertical className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onTogglePin(project)}
              aria-label={
                project.is_pinned
                  ? `ביטול הצמדת הפרויקט ${project.name}`
                  : `הצמדת הפרויקט ${project.name}`
              }
              aria-pressed={project.is_pinned}
              title={project.is_pinned ? "ביטול הצמדה" : "הצמדת הפרויקט לראש הרשימה"}
              className={`p-1.5 transition-colors ${
                project.is_pinned
                  ? "rounded-md bg-white text-indigo-600 shadow-sm"
                  : "rounded-md text-slate-400 hover:bg-white hover:text-indigo-600"
              }`}
            >
              <Pin className={`size-4 ${project.is_pinned ? "fill-current" : ""}`} />
            </button>
            <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={() => onEditProject(project)}
                aria-label={`עריכת הפרויקט ${project.name}`}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-white hover:text-slate-900"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDeleteProject(project)}
                aria-label={`מחיקת הפרויקט ${project.name}`}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-white hover:text-rose-600"
              >
                <Trash2 className="size-3.5" />
              </button>
            </span>
          </span>
        </div>

        {project.description && <p className="mt-1.5 line-clamp-2 max-w-[28rem] whitespace-pre-line text-[10px] leading-4 text-slate-500">{project.description}</p>}
      </header>

      {links.length > 0 ? (<div className="flex min-h-0 flex-1 flex-col">
          <DndContext
            sensors={linkSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleLinkDragEnd}
          >
            <SortableContext
              items={links.map((link) => link.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="project-links-scroll flex min-h-0 flex-1 flex-col items-start overflow-y-auto px-2 pe-1">
                {links.map((link) => (
                  <LinkRow
                    key={link.id}
                    link={link}
                    onEdit={(target) => onEditLink(project, target)}
                    onDelete={(target) => onDeleteLink(project, target)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      ) : (
        <button type="button" onClick={() => onAddLink(project)} className="m-3 flex items-center justify-between rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-400 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600"><span>אין קישורים זמינים כרגע</span><span className="flex items-center gap-1 font-medium text-indigo-600"><Plus className="size-3.5" />הוסף קישור</span></button>
      )}

      {links.length > 0 && <footer className="mt-auto border-t border-slate-100 px-2 py-1.5">
        <button
          type="button"
          onClick={() => onAddLink(project)}
          className="flex w-full items-center justify-start gap-1.5 rounded-lg px-2 py-2 text-[10px] font-medium text-slate-500 transition hover:bg-white hover:text-indigo-600"
        >
          הוסף קישור
          <Plus className="size-3.5" aria-hidden="true" />
        </button>
      </footer>}
    </article>
  );
}
