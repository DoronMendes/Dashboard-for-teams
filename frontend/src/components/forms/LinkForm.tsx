import { useState, type FormEvent } from "react";

import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { RoundedSelect } from "@/components/ui/RoundedSelect";
import { useCreateLink, useUpdateLink } from "@/hooks/useProjects";
import { normalizeUrl, validateLinkTitle, validateUrl } from "@/lib/validation";
import { ApiError } from "@/services/apiClient";
import { CATEGORY_LABELS, LINK_CATEGORIES, type Link, type LinkCategory, type Project } from "@/types";

interface LinkFormProps {
  open: boolean;
  projectId?: string;
  projectName?: string;
  projects?: Project[];
  /** Absent = adding; present = editing that link. */
  link?: Link;
  onClose: () => void;
}

export function LinkForm({ open, projectId, projectName, projects, link, onClose }: LinkFormProps) {
  const isEdit = link !== undefined;
  const { notify } = useToast();

  const [title, setTitle] = useState(link?.title ?? "");
  const [url, setUrl] = useState(link?.url ?? "");
  const [category, setCategory] = useState<LinkCategory>(link?.category ?? "environment");
  const [tags, setTags] = useState(link?.tags.join(", ") ?? "");
  const [selectedProjectId, setSelectedProjectId] = useState(projectId ?? projects?.[0]?.id ?? "");
  const [errors, setErrors] = useState<{ title?: string; url?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const createLink = useCreateLink();
  const updateLink = useUpdateLink();
  const busy = createLink.isPending || updateLink.isPending;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const nextErrors = { title: validateLinkTitle(title), url: validateUrl(url) };
    setErrors(nextErrors);
    if (nextErrors.title || nextErrors.url || (!isEdit && !selectedProjectId)) return;

    const payload = {
      title: title.trim(),
      url: normalizeUrl(url), // adds https:// when the scheme was left off
      category,
      tags: tags.split(",").map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean),
    };

    const onError = (error: unknown) => {
      setFormError(
        error instanceof ApiError ? error.message : "השמירה נכשלה. נסו שוב.",
      );
    };

    if (isEdit) {
      updateLink.mutate(
        { id: link.id, payload },
        {
          onSuccess: () => {
            notify(`הקישור "${payload.title}" נשמר.`);
            onClose();
          },
          onError,
        },
      );
    } else {
      const selectedProject = projects?.find((project) => project.id === selectedProjectId);
      createLink.mutate(
        { projectId: selectedProjectId, payload },
        {
          onSuccess: () => {
            notify(`הקישור "${payload.title}" נוסף לפרויקט "${selectedProject?.name ?? projectName ?? ""}".`);
            onClose();
          },
          onError,
        },
      );
    }
  }

  return (
    <Modal
      open={open}
      title={isEdit ? "עריכת קישור" : projectName ? `הוספת קישור לפרויקט "${projectName}"` : "הוספת קישור חדש"}
      onClose={busy ? () => {} : onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {!isEdit && projects && (
          <Field label="פרויקט" error={!selectedProjectId ? "יש לבחור פרויקט." : undefined}>
            {({ id, describedBy }) => <RoundedSelect id={id} ariaDescribedBy={describedBy} value={selectedProjectId} onChange={setSelectedProjectId} disabled={busy} options={[{ value: "", label: "בחירת פרויקט" }, ...projects.map((project) => ({ value: project.id, label: project.name }))]} />}
          </Field>
        )}
        <Field label="כותרת" error={errors.title}>
          {({ id, describedBy }) => (
            <input
              id={id}
              aria-describedby={describedBy}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="סביבת בדיקות"
              className={inputClass}
              disabled={busy}
              autoComplete="off"
            />
          )}
        </Field>

        <Field
          label="כתובת URL"
          hint="אם לא יוזן פרוטוקול, https:// יתווסף אוטומטית."
          error={errors.url}
        >
          {({ id, describedBy }) => (
            <input
              id={id}
              aria-describedby={describedBy}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="stg.pay.internal"
              className={`${inputClass} text-left font-mono`}
              dir="ltr"
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
            />
          )}
        </Field>

        <Field label="קטגוריה">
          {({ id }) => <RoundedSelect id={id} value={category} onChange={(value) => setCategory(value as LinkCategory)} disabled={busy} options={LINK_CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }))} />}
        </Field>

        <Field label="תגיות" hint="הפרידו בין תגיות באמצעות פסיק.">
          {({ id, describedBy }) => <input id={id} aria-describedby={describedBy} value={tags} onChange={(event) => setTags(event.target.value)} placeholder="תיעוד, קליטה" className={inputClass} disabled={busy} autoComplete="off" />}
        </Field>

        {formError && <p className="text-sm text-cat-monitoring">{formError}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            ביטול
          </Button>
          <Button type="submit" busy={busy} className={`rounded-xl ${isEdit ? "" : "bg-[#0B3FC1] text-white shadow-[0_8px_20px_rgba(11,63,193,0.2)] hover:bg-[#0936A6]"}`}>
            {isEdit ? "שמירת שינויים" : "הוספת קישור"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
