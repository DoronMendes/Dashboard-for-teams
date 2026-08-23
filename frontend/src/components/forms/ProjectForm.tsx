import { useState, type FormEvent } from "react";

import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useCreateProject, useUpdateProject, useWorkspaces } from "@/hooks/useProjects";
import { validateDescription, validateProjectName } from "@/lib/validation";
import { ApiError } from "@/services/apiClient";
import type { Project } from "@/types";

interface ProjectFormProps {
  open: boolean;
  /** Absent = creating; present = editing that project. */
  project?: Project;
  onClose: () => void;
}

export function ProjectForm({ open, project, onClose }: ProjectFormProps) {
  const isEdit = project !== undefined;
  const { notify } = useToast();

  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [teamId, setTeamId] = useState(project?.team_id ?? "");
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const busy = createProject.isPending || updateProject.isPending;
  const { data: workspaces } = useWorkspaces();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const nextErrors = {
      name: validateProjectName(name),
      description: validateDescription(description),
    };
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.description) return;

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      ...(!isEdit ? { workspace_id: workspaces?.[0]?.id } : {}),
      team_id: teamId || null,
    };

    const onError = (error: unknown) => {
      const message =
        error instanceof ApiError ? error.message : "השמירה נכשלה. נסו שוב.";
      // A name clash belongs on the field; anything else sits above the buttons.
      if (error instanceof ApiError && error.isConflict) {
        setErrors((current) => ({
          ...current,
          name: "כבר קיים בחשבון שלך פרויקט בשם הזה.",
        }));
      } else {
        setFormError(message);
      }
    };

    if (isEdit) {
      updateProject.mutate(
        { id: project.id, payload },
        {
          onSuccess: () => {
            notify(`הפרויקט „${payload.name}” נשמר.`);
            onClose();
          },
          onError,
        },
      );
    } else {
      createProject.mutate(payload, {
        onSuccess: () => {
          notify(`הפרויקט „${payload.name}” נוצר.`);
          onClose();
        },
        onError,
      });
    }
  }

  return (
    <Modal
      open={open}
      title={isEdit ? "עריכת פרויקט" : "פרויקט חדש"}
      onClose={busy ? () => {} : onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="שם" error={errors.name}>
          {({ id, describedBy }) => (
            <input
              id={id}
              aria-describedby={describedBy}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="מערכת תשלומים"
              className={inputClass}
              disabled={busy}
              autoComplete="off"
            />
          )}
        </Field>

        <Field label="צוות">
          {({ id }) => <select id={id} value={teamId} onChange={(event) => setTeamId(event.target.value)} className={inputClass} disabled={busy}><option value="">ללא צוות</option>{(workspaces ?? []).flatMap((workspace) => workspace.teams).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>}
        </Field>

        <Field
          label="תיאור"
          hint="שדה אופציונלי. החיפוש מתבצע גם בתיאור."
          error={errors.description}
        >
          {({ id, describedBy }) => (
            <textarea
              id={id}
              aria-describedby={describedBy}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="תיאור קצר של הפרויקט"
              rows={3}
              className={`${inputClass} resize-y`}
              disabled={busy}
            />
          )}
        </Field>

        {formError && <p className="text-sm text-cat-monitoring">{formError}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            ביטול
          </Button>
          <Button type="submit" busy={busy}>
            {isEdit ? "שמירת שינויים" : "יצירת פרויקט"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
