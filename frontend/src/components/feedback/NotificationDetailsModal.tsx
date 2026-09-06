import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { getIssueReport } from "@/services/api";
import type { Notification } from "@/types";

const categoryLabels: Record<string, [string, string]> = {
  display: ["תצוגה", "Display"],
  link: ["קישור", "Link"],
  permissions: ["הרשאות", "Permissions"],
  login: ["התחברות", "Login"],
  other: ["אחר", "Other"],
};

const urgencyLabels: Record<string, [string, string]> = {
  low: ["נמוכה", "Low"],
  normal: ["רגילה", "Normal"],
  high: ["גבוהה", "High"],
};

export function NotificationDetailsModal({ notification, direction, onClose }: {
  notification: Notification | null;
  direction: "rtl" | "ltr";
  onClose: () => void;
}) {
  const rtl = direction === "rtl";
  const reportId = notification?.kind === "issue_report"
    ? notification.target_path?.match(/^\/issue-reports\/([0-9a-f-]+)$/i)?.[1]
    : undefined;
  const report = useQuery({
    queryKey: ["issue-report", reportId],
    queryFn: () => getIssueReport(reportId!),
    enabled: Boolean(reportId),
  });

  return <Modal open={Boolean(notification)} onClose={onClose} title={rtl ? "פרטי ההתראה" : "Notification details"} size="large">
    {!notification ? null : reportId && report.isPending ? (
      <p className="py-12 text-center text-sm text-slate-400">{rtl ? "טוען את הדיווח..." : "Loading report..."}</p>
    ) : report.data ? (
      <div className="space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-rose-600">{rtl ? "דיווח על תקלה" : "Issue report"}</p>
          <h3 className="mt-1 text-2xl font-extrabold text-slate-950">{report.data.title}</h3>
        </div>
        <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <Detail label={rtl ? "מדווח" : "Reporter"} value={`${report.data.reporter_name} (${report.data.reporter_email})`} />
          <Detail label={rtl ? "סביבת עבודה" : "Workspace"} value={report.data.workspace_name} />
          <Detail label={rtl ? "סוג" : "Category"} value={categoryLabels[report.data.category]?.[rtl ? 0 : 1] ?? report.data.category} />
          <Detail label={rtl ? "דחיפות" : "Urgency"} value={urgencyLabels[report.data.urgency]?.[rtl ? 0 : 1] ?? report.data.urgency} />
          <Detail label={rtl ? "נשלח בתאריך" : "Submitted"} value={new Date(report.data.created_at).toLocaleString(rtl ? "he-IL" : "en-US")} />
          <Detail label={rtl ? "סטטוס" : "Status"} value={report.data.status} />
        </div>
        <section>
          <h4 className="mb-2 text-sm font-bold text-slate-900">{rtl ? "תיאור מלא" : "Full description"}</h4>
          <p className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">{report.data.description}</p>
        </section>
        {report.data.page_url && <a href={report.data.page_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800"><ExternalLink className="size-4" />{rtl ? "פתיחת העמוד שממנו נשלח הדיווח" : "Open the page where the report was submitted"}</a>}
      </div>
    ) : (
      <div className="space-y-4">
        <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-5 text-sm leading-7 text-slate-700">{notification.message}</p>
        {report.isError && <p className="text-xs text-rose-600">{rtl ? "לא ניתן היה לטעון פרטים נוספים לדיווח." : "Additional report details could not be loaded."}</p>}
      </div>
    )}
  </Modal>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold text-slate-400">{label}</dt><dd className="mt-1 text-slate-700">{value}</dd></div>;
}
