import { CheckCircle2, Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { RoundedSelect } from "@/components/ui/RoundedSelect";
import { useImportSpreadsheet } from "@/hooks/useProjects";
import { ApiError } from "@/services/apiClient";
import type { SpreadsheetImportResult, Workspace } from "@/types";

export function SpreadsheetImportPanel({
  workspaces,
  direction,
}: {
  workspaces: Workspace[];
  direction: "rtl" | "ltr";
}) {
  const rtl = direction === "rtl";
  const editableWorkspaces = workspaces.filter((workspace) => workspace.role !== "viewer");
  const [workspaceId, setWorkspaceId] = useState(editableWorkspaces[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<SpreadsheetImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const importer = useImportSpreadsheet();

  useEffect(() => {
    if (!workspaceId && editableWorkspaces[0]) setWorkspaceId(editableWorkspaces[0].id);
  }, [editableWorkspaces, workspaceId]);

  const chooseFile = (selected: File | undefined) => {
    setResult(null);
    importer.reset();
    setFile(selected?.name.toLowerCase().endsWith(".xlsx") ? selected : null);
  };

  const submit = async () => {
    if (!file || !workspaceId) return;
    setResult(await importer.mutateAsync({ workspaceId, file }));
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const error = importer.error instanceof ApiError ? importer.error.message : null;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
      <section className="rounded-[20px] bg-white p-6 shadow-[0_12px_38px_rgba(15,23,42,0.055)] lg:p-8">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-[#0B3FC1]"><UploadCloud className="size-6" /></span>
          <div>
            <h2 className="font-display text-xl font-extrabold text-slate-950">{rtl ? "העלאת רשימת פרויקטים וקישורים" : "Upload projects and links"}</h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-500">{rtl ? "בחרו Workspace, העלו את התבנית המלאה וכל הרשומות ייווצרו בפעולה אחת." : "Choose a workspace and upload the completed template to create all records in one operation."}</p>
          </div>
        </div>

        <label className="mt-7 block text-xs font-bold text-slate-600">{rtl ? "Workspace יעד" : "Target workspace"}</label>
        <div className="mt-2">
          <RoundedSelect
            value={workspaceId}
            onChange={setWorkspaceId}
            disabled={importer.isPending}
            options={editableWorkspaces.map((workspace) => ({ value: workspace.id, label: workspace.name }))}
          />
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }}
          className={`mt-5 flex min-h-56 w-full flex-col items-center justify-center rounded-[18px] border-2 border-dashed px-6 text-center transition ${dragging ? "border-[#0B3FC1] bg-blue-50" : "border-slate-200 bg-[#F8F9F7] hover:border-blue-300 hover:bg-blue-50/40"}`}
        >
          <FileSpreadsheet className="size-10 text-[#0B3FC1]" />
          <strong className="mt-4 text-sm text-slate-800">{file?.name ?? (rtl ? "גררו לכאן קובץ XLSX או לחצו לבחירה" : "Drop an XLSX file here or click to browse")}</strong>
          <span className="mt-2 text-xs text-slate-400">{rtl ? "עד 5MB · רק תבנית Excel בפורמט XLSX" : "Up to 5MB · XLSX template only"}</span>
        </button>
        <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />

        {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
        {result && <div className="mt-4 flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><CheckCircle2 className="size-5" /><span>{rtl ? `הייבוא הושלם: ${result.projects_created} פרויקטים ו־${result.links_created} קישורים נוצרו.` : `Import complete: ${result.projects_created} projects and ${result.links_created} links created.`}</span></div>}

        <div className="mt-5 flex justify-end">
          <Button onClick={() => void submit()} disabled={!file || !workspaceId || importer.isPending} busy={importer.isPending}>{rtl ? "ייבוא הנתונים" : "Import data"}</Button>
        </div>
      </section>

      <section className="rounded-[20px] bg-[#0B3FC1] p-6 text-white shadow-[0_18px_42px_rgba(11,63,193,0.2)] lg:p-8">
        <span className="grid size-12 place-items-center rounded-2xl bg-white/15"><Download className="size-6" /></span>
        <h2 className="mt-6 font-display text-2xl font-extrabold">{rtl ? "הורדת תבנית Excel" : "Download Excel template"}</h2>
        <p className="mt-3 text-sm leading-6 text-blue-100">{rtl ? "התבנית כוללת לשונית Projects לפרויקטים ולשונית Links לקישורים, עם שורת דוגמה והסברים בתוך הקובץ." : "The template includes separate Projects and Links sheets, with an example row and guidance inside the workbook."}</p>
        <ol className="mt-7 space-y-4 text-sm text-blue-50">
          <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-black">1</span><span>{rtl ? "הורידו ופתחו ב־Excel. אם מופיעה תצוגה מוגנת, לחצו על „אפשר עריכה”." : "Download and open in Excel. If Protected View appears, click Enable Editing."}</span></li>
          <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-black">2</span><span>{rtl ? "כתבו את שם הפרויקט והשתמשו באותו שם גם בשורות הקישורים שלו." : "Enter the project name and use the same name for each of its links."}</span></li>
          <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-black">3</span><span>{rtl ? "שמרו כ־XLSX והעלו בעמוד זה." : "Save as XLSX and upload it on this page."}</span></li>
        </ol>
        <a href="/project-import-template.xlsx" download className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-extrabold text-[#0B3FC1] shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"><Download className="size-4" />{rtl ? "הורדת התבנית" : "Download template"}</a>
      </section>
    </div>
  );
}
