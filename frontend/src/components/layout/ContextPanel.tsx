import { ChevronDown, Eye, Link2, TrendingUp, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ActivityEvent, Analytics } from "@/types";

interface Props { open: boolean; onClose: () => void; direction: "rtl" | "ltr"; activity?: ActivityEvent[]; analytics?: Analytics; }
export function ContextPanel({ open, onClose, direction, activity = [], analytics }: Props) {
  const [activityFilter, setActivityFilter] = useState("all");
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) { setRendered(true); setClosing(false); return; }
    if (!rendered) return;
    setClosing(true);
    const timer = window.setTimeout(() => { setRendered(false); setClosing(false); }, 220);
    return () => window.clearTimeout(timer);
  }, [open, rendered]);
  if (!rendered) return null;
  const rtl = direction === "rtl";
  const actionLabel = (item: ActivityEvent) => rtl ? ({ created: "יצר/ה פריט חדש", updated: "עדכן/ה פריט", deleted: "מחק/ה פריט" }[item.action] ?? item.action) : ({ created: "created a new item", updated: "updated an item", deleted: "deleted an item" }[item.action] ?? item.action);
  const visibleActivity = activity.filter((item) => activityFilter === "all" || item.entity_type === activityFilter).slice(0, 8);
  return <aside className={`context-panel w-full shrink-0 border-t border-slate-200 bg-slate-50/60 p-4 xl:sticky xl:top-18 xl:h-[calc(100dvh-4.5rem)] xl:w-80 xl:overflow-y-auto xl:border-s xl:border-t-0 ${closing ? "context-panel-closing" : ""}`}>
    <button onClick={onClose} className="mb-2 ms-auto grid size-7 place-items-center text-slate-400 transition-colors hover:text-slate-700" aria-label={rtl ? "סגירת חלונית הפעילות" : "Close activity panel"} title={rtl ? "סגירת חלונית הפעילות" : "Close activity panel"}><X className="size-4" /></button>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-4"><div><h3 className="text-sm font-black text-slate-900">{rtl ? "פעילות אחרונה" : "Recent activity"}</h3><p className="mt-0.5 text-[10px] text-slate-400">{rtl ? "אירועים אמיתיים בסביבת העבודה" : "Recorded workspace events"}</p></div><label className="relative mt-3 inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white ps-2.5 text-[10px] font-semibold text-slate-500"><select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)} className="h-full appearance-none bg-transparent pe-7 outline-none"><option value="all">{rtl ? "כל הפעילות" : "All activity"}</option><option value="project">{rtl ? "פרויקטים" : "Projects"}</option><option value="link">{rtl ? "קישורים" : "Links"}</option></select><ChevronDown className="pointer-events-none absolute end-2 size-3" /></label></div>
      {visibleActivity.length ? <div>{visibleActivity.map((item) => <div key={item.id} className="group flex gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50/50"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-950 text-[9px] font-black uppercase text-white ring-2 ring-slate-100">{item.user.name.split(" ").map((part) => part[0]).join("").slice(0,2)}</span><div className="min-w-0 flex-1"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-black text-slate-900">{item.user.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{actionLabel(item)}</p></div><time className="shrink-0 text-[9px] text-slate-400">{new Intl.DateTimeFormat(rtl ? "he-IL" : "en-US", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(item.created_at))}</time></div>{Boolean(item.details.name ?? item.details.title) && <p className="mt-1 truncate text-[11px] font-semibold text-indigo-600">{String(item.details.name ?? item.details.title)}</p>}</div></div>)}</div> : <Empty text={rtl ? "אין פעילות להצגה." : "No activity to display."} />}
    </section>
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center gap-2"><TrendingUp className="size-4 text-emerald-500" /><h3 className="text-sm font-bold">{rtl ? "נתונים מהירים" : "Quick stats"}</h3></div><div className="grid grid-cols-2 gap-2"><Stat icon={Link2} value={String(analytics?.total_links ?? 0)} label={rtl ? "קישורים" : "Total links"} /><Stat icon={Eye} value={String(analytics?.weekly_visits ?? 0)} label={rtl ? "כניסות השבוע" : "Weekly visits"} /></div><div className="mt-4 rounded-xl border border-dashed border-slate-200 p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{rtl ? "הנצפה ביותר" : "Most visited"}</p>{analytics?.most_visited ? <><p className="mt-2 truncate text-sm font-bold">{analytics.most_visited.title}</p><p className="mt-1 text-xs text-slate-400">{analytics.most_visited.visits} {rtl ? "צפיות" : "visits"}</p></> : <p className="mt-3 text-xs text-slate-400">{rtl ? "אין עדיין נתוני צפייה." : "No visit data yet."}</p>}</div></section>
  </aside>;
}
function Empty({ text }: { text: string }) { return <div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-xs text-slate-400">{text}</div>; }
function Stat({ icon: Icon, value, label }: { icon: typeof Link2; value: string; label: string }) { return <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><Icon className="mb-2 size-4 text-indigo-500" /><b className="block text-xl text-slate-900">{value}</b><span className="text-[10px] text-slate-500">{label}</span></div>; }
