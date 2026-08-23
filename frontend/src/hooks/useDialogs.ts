import { useCallback, useState } from "react";

import type { Link, Project } from "@/types";

/**
 * One piece of state for every dialog on the page, so two can never be open at
 * once and closing always returns to the same place.
 */
export type Dialog =
  | { kind: "none" }
  | { kind: "project-create" }
  | { kind: "project-edit"; project: Project }
  | { kind: "project-delete"; project: Project }
  | { kind: "link-create"; project: Project }
  | { kind: "link-create-global" }
  | { kind: "link-edit"; project: Project; link: Link }
  | { kind: "link-delete"; project: Project; link: Link };

export function useDialogs() {
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });
  const close = useCallback(() => setDialog({ kind: "none" }), []);

  return {
    dialog,
    close,
    createProject: useCallback(() => setDialog({ kind: "project-create" }), []),
    editProject: useCallback(
      (project: Project) => setDialog({ kind: "project-edit", project }),
      [],
    ),
    deleteProject: useCallback(
      (project: Project) => setDialog({ kind: "project-delete", project }),
      [],
    ),
    addLink: useCallback(
      (project: Project) => setDialog({ kind: "link-create", project }),
      [],
    ),
    addGlobalLink: useCallback(() => setDialog({ kind: "link-create-global" }), []),
    editLink: useCallback(
      (project: Project, link: Link) => setDialog({ kind: "link-edit", project, link }),
      [],
    ),
    deleteLink: useCallback(
      (project: Project, link: Link) => setDialog({ kind: "link-delete", project, link }),
      [],
    ),
  };
}
