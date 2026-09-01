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
import { ActionTooltip } from "@/components/ui/ActionTooltip";
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
      className={`group/card relative flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-black/[0.055] bg-white shadow-[0_10px_35px_rgba(15,23,42,0.055)] transition-[border-color,box-shadow,transform] duration-200 hover:border-black/[0.09] hover:shadow-[0_16px_42px_rgba(15,23,42,0.085)] ${links.length ? "h-[22rem]" : "h-auto"} ${
        isDragging ? "rotate-1 shadow-xl ring-2 ring-indigo-200" : ""
      }`}
    >
      <header className="project-card-header border-b border-slate-100 px-4 py-3">
        <div className="mb-1 flex h-4 items-center justify-end">
          <span className="flex shrink-0 items-center gap-0.5">
            <ActionTooltip label="גרירה לשינוי מיקום"><button
              type="button"
              {...attributes}
              {...listeners}
              aria-label={`שינוי מיקום הפרויקט ${project.name}`}
              className="cursor-grab touch-none rounded-md p-1 text-slate-400 transition-colors hover:bg-white hover:text-slate-700 active:cursor-grabbing"
            >
              <GripVertical className="size-4" aria-hidden="true" />
            </button></ActionTooltip>
            <ActionTooltip label={project.is_pinned ? "ביטול הצמדה" : "הצמדה לראש הרשימה"}><button
              type="button"
              onClick={() => onTogglePin(project)}
              aria-label={
                project.is_pinned
                  ? `ביטול הצמדת הפרויקט ${project.name}`
                  : `הצמדת הפרויקט ${project.name}`
              }
              aria-pressed={project.is_pinned}
              className={`p-1 transition-colors ${
                project.is_pinned
                  ? "rounded-md bg-white text-indigo-600 shadow-sm"
                  : "rounded-md text-slate-400 hover:bg-white hover:text-indigo-600"
              }`}
            >
              <Pin className={`size-4 ${project.is_pinned ? "fill-current" : ""}`} />
            </button></ActionTooltip>
            <span className="flex items-center gap-0.5">
              <ActionTooltip label="עריכת הפרויקט"><button
                type="button"
                onClick={() => onEditProject(project)}
                aria-label={`עריכת הפרויקט ${project.name}`}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-white hover:text-slate-900"
              >
                <Pencil className="size-3.5" />
              </button></ActionTooltip>
              <ActionTooltip label="מחיקת הפרויקט"><button
                type="button"
                onClick={() => onDeleteProject(project)}
                aria-label={`מחיקת הפרויקט ${project.name}`}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-white hover:text-rose-600"
              >
                <Trash2 className="size-3.5" />
              </button></ActionTooltip>
            </span>
          </span>
        </div>
        <h2 className="flex min-w-0 items-center gap-3 font-display text-lg font-extrabold tracking-[-0.025em] text-slate-950 lg:text-xl">
          {project.icon && (project.icon.startsWith("data:image/") ? (
            <img src={project.icon} alt="" className="size-10 shrink-0 rounded-xl bg-white object-cover shadow-sm ring-1 ring-slate-200/70" />
          ) : (
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-xl shadow-sm ring-1 ring-slate-200/70" aria-hidden="true">{project.icon}</span>
          ))}
          <span className="min-w-0 break-words leading-tight">{project.name}</span>
        </h2>

        {project.description && <p className="mt-2 line-clamp-2 max-w-[28rem] whitespace-pre-line text-sm leading-5 text-slate-500">{project.description}</p>}
        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span>{links.length} {links.length === 1 ? "קישור" : "קישורים"}</span>
          <span className="text-slate-300">•</span>
          <span className="text-emerald-700">{links.filter((link) => link.health_status === "healthy").length} תקינים</span>
          {links.some((link) => link.health_status === "error") && <><span className="text-slate-300">•</span><span className="text-rose-600">{links.filter((link) => link.health_status === "error").length} שגיאות</span></>}
        </div>
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
        <button type="button" onClick={() => onAddLink(project)} className="m-4 flex min-h-28 flex-col items-center justify-center rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 p-4 text-sm text-slate-500 transition hover:border-blue-300 hover:bg-blue-50"><span className="grid size-9 place-items-center rounded-full bg-white text-[#0B3FC1] shadow-sm"><Plus className="size-5" /></span><strong className="mt-2 text-[#0B3FC1]">הוסף קישור ראשון</strong><span className="mt-1 text-xs text-slate-400">רכז כאן סביבת עבודה, מסמך או כלי</span></button>
      )}

      {links.length > 0 && <footer className="mt-auto px-3 py-3">
        <button
          type="button"
          onClick={() => onAddLink(project)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-200 bg-blue-50/50 px-3 py-2.5 text-xs font-bold text-[#0B3FC1] transition hover:border-blue-300 hover:bg-blue-50"
        >
          הוסף קישור
          <Plus className="size-3.5" aria-hidden="true" />
        </button>
      </footer>}
    </article>
  );
}
