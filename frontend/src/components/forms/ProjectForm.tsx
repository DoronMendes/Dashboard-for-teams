import { useState, type ChangeEvent, type FormEvent } from "react";

import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { RoundedSelect } from "@/components/ui/RoundedSelect";
import { useCreateProject, useUpdateProject, useWorkspaces } from "@/hooks/useProjects";
import { PROJECT_ICON_FILE_MAX_BYTES, validateDescription, validateProjectIcon, validateProjectName } from "@/lib/validation";
import { ApiError } from "@/services/apiClient";
import type { Project } from "@/types";

interface ProjectFormProps {
  open: boolean;
  /** Absent = creating; present = editing that project. */
  project?: Project;
  onClose: () => void;
}

const PROJECT_ICONS = ["🚀", "💻", "📊", "🛠️", "🎨", "📱", "🌐", "💡", "📁", "⚙️", "🧪", "🔒"];

export function ProjectForm({ open, project, onClose }: ProjectFormProps) {
  const isEdit = project !== undefined;
  const { notify } = useToast();

  const [name, setName] = useState(project?.name ?? "");
  const [icon, setIcon] = useState(project?.icon ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [teamId, setTeamId] = useState(project?.team_id ?? "");
  const [errors, setErrors] = useState<{ name?: string; icon?: string; description?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const busy = createProject.isPending || updateProject.isPending;
  const { data: workspaces } = useWorkspaces();
  const uploadedIcon = icon.startsWith("data:image/");

  function handleIconFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setErrors((current) => ({ ...current, icon: "ניתן להעלות קובץ PNG, JPG או WebP בלבד." }));
      return;
    }
    if (file.size > PROJECT_ICON_FILE_MAX_BYTES) {
      setErrors((current) => ({ ...current, icon: "גודל האייקון יכול להיות עד 512KB." }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setIcon(reader.result);
      setErrors((current) => ({ ...current, icon: undefined }));
    };
    reader.onerror = () => setErrors((current) => ({ ...current, icon: "לא ניתן לקרוא את הקובץ שנבחר." }));
    reader.readAsDataURL(file);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const nextErrors = {
      name: validateProjectName(name),
      icon: validateProjectIcon(icon),
      description: validateDescription(description),
    };
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.icon || nextErrors.description) return;

    const payload = {
      name: name.trim(),
      icon: icon.trim() || null,
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
            notify(`הפרויקט "${payload.name}" נשמר.`);
            onClose();
          },
          onError,
        },
      );
    } else {
      createProject.mutate(payload, {
        onSuccess: () => {
          notify(`הפרויקט "${payload.name}" נוצר.`);
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

        <Field label="אייקון" hint="בחרו אימוג׳י או העלו תמונת PNG, JPG או WebP עד 512KB." error={errors.icon}>
          {({ id, describedBy }) => (
            <div aria-describedby={describedBy}>
              <div className="flex items-center gap-2">
                {uploadedIcon ? (
                  <img src={icon} alt="תצוגה מקדימה של האייקון" className="size-14 rounded-xl border border-slate-200 object-cover" />
                ) : (
                  <input
                    id={id}
                    value={icon}
                    onChange={(event) => setIcon(event.target.value)}
                    placeholder="🚀"
                    className={`${inputClass} w-20 text-center text-xl`}
                    disabled={busy}
                    autoComplete="off"
                    maxLength={32}
                  />
                )}
                <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50">
                  העלאת תמונה
                  <input id={uploadedIcon ? id : undefined} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleIconFile} className="sr-only" disabled={busy} />
                </label>
                {icon && (
                  <button type="button" onClick={() => setIcon("")} className="text-xs font-medium text-slate-500 hover:text-slate-900" disabled={busy}>
                    הסרת אייקון
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5" aria-label="בחירת אייקון">
                {PROJECT_ICONS.map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    onClick={() => { setIcon(candidate); setErrors((current) => ({ ...current, icon: undefined })); }}
                    aria-label={`בחירת האייקון ${candidate}`}
                    aria-pressed={icon === candidate}
                    className={`grid size-9 place-items-center rounded-lg border text-lg transition ${icon === candidate ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100" : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50"}`}
                    disabled={busy}
                  >
                    {candidate}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Field>

        <Field label="צוות">
          {({ id }) => <RoundedSelect id={id} value={teamId} onChange={setTeamId} disabled={busy} options={[{ value: "", label: "ללא צוות" }, ...(workspaces ?? []).flatMap((workspace) => workspace.teams).map((team) => ({ value: team.id, label: team.name }))]} />}
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
