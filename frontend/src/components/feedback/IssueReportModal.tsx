import { useEffect, useState, type FormEvent } from "react";

import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useCreateIssueReport } from "@/hooks/useProjects";
import { ApiError } from "@/services/apiClient";
import type { IssueReportCreate, Workspace } from "@/types";

export function IssueReportModal({ open, onClose, direction, workspaces }: { open: boolean; onClose: () => void; direction: "rtl" | "ltr"; workspaces: Workspace[] }) {
  const rtl = direction === "rtl";
  const submitReport = useCreateIssueReport();
  const { notify } = useToast();
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<IssueReportCreate["category"]>("other");
  const [urgency, setUrgency] = useState<IssueReportCreate["urgency"]>("normal");

  useEffect(() => { if (!workspaceId && workspaces[0]) setWorkspaceId(workspaces[0].id); }, [workspaceId, workspaces]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!workspaceId || title.trim().length < 3 || description.trim().length < 10) return;
    submitReport.mutate({ workspace_id: workspaceId, title: title.trim(), description: description.trim(), category, urgency, page_url: window.location.href }, {
      onSuccess: () => { notify(rtl ? "הדיווח נשלח לבעלי סביבת העבודה." : "The report was sent to the workspace managers."); setTitle(""); setDescription(""); setCategory("other"); setUrgency("normal"); onClose(); },
    });
  };
  const error = submitReport.error instanceof ApiError ? submitReport.error.message : submitReport.isError ? (rtl ? "שליחת הדיווח נכשלה." : "Could not send the report.") : null;

  return <Modal open={open} onClose={onClose} title={rtl ? "דיווח על תקלה" : "Report an issue"}>
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm leading-6 text-slate-500">{rtl ? "הדיווח יישמר ויישלח כהתראה לבעלי סביבת העבודה." : "The report will be saved and sent as a notification to workspace managers."}</p>
      <Field label={rtl ? "סביבת עבודה" : "Workspace"}>{({ id }) => <select id={id} value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)} className={inputClass}>{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select>}</Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={rtl ? "סוג התקלה" : "Issue type"}>{({ id }) => <select id={id} value={category} onChange={(event) => setCategory(event.target.value as IssueReportCreate["category"])} className={inputClass}><option value="display">{rtl ? "תצוגה" : "Display"}</option><option value="link">{rtl ? "קישור" : "Link"}</option><option value="permissions">{rtl ? "הרשאות" : "Permissions"}</option><option value="login">{rtl ? "התחברות" : "Login"}</option><option value="other">{rtl ? "אחר" : "Other"}</option></select>}</Field>
        <Field label={rtl ? "דחיפות" : "Urgency"}>{({ id }) => <select id={id} value={urgency} onChange={(event) => setUrgency(event.target.value as IssueReportCreate["urgency"])} className={inputClass}><option value="low">{rtl ? "נמוכה" : "Low"}</option><option value="normal">{rtl ? "רגילה" : "Normal"}</option><option value="high">{rtl ? "גבוהה" : "High"}</option></select>}</Field>
      </div>
      <Field label={rtl ? "כותרת" : "Title"} hint={rtl ? "לפחות 3 תווים" : "At least 3 characters"}>{({ id, describedBy }) => <input id={id} aria-describedby={describedBy} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} className={inputClass} placeholder={rtl ? "מה לא עובד?" : "What is not working?"} />}</Field>
      <Field label={rtl ? "תיאור התקלה" : "Description"} hint={rtl ? "לפחות 10 תווים" : "At least 10 characters"}>{({ id, describedBy }) => <textarea id={id} aria-describedby={describedBy} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} rows={5} className={`${inputClass} resize-y`} placeholder={rtl ? "תארו מה קרה ומה ציפיתם שיקרה" : "Describe what happened and what you expected"} />}</Field>
      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
      <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="secondary" onClick={onClose}>{rtl ? "ביטול" : "Cancel"}</Button><Button type="submit" busy={submitReport.isPending} disabled={!workspaceId || title.trim().length < 3 || description.trim().length < 10}>{rtl ? "שליחת הדיווח" : "Send report"}</Button></div>
    </form>
  </Modal>;
}
