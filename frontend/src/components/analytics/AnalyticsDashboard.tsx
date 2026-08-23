import { useId, useMemo, useRef, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, MousePointerClick, Users } from "lucide-react";

import { useActiveUsers, useClicksTrend, useTopProjects } from "@/hooks/useProjects";
import type { ClickTrendPoint } from "@/types";

type Direction = "rtl" | "ltr";
type Interval = "daily" | "weekly" | "monthly";
type ActiveRange = "7d" | "30d" | "all";

export function AnalyticsDashboard({ direction }: { direction: Direction }) {
  const [interval, setInterval] = useState<Interval>("daily");
  const [activeRange, setActiveRange] = useState<ActiveRange>("7d");
  const trend = useClicksTrend(interval);
  const active = useActiveUsers(activeRange);
  const projects = useTopProjects();
  const rtl = direction === "rtl";

  return (
    <div className="space-y-5">
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.7fr)_minmax(290px,.7fr)]">
        <AnalyticsCard>
          <CardHeader
            icon={MousePointerClick}
            title={rtl ? "מספר לחיצות" : "Click volume"}
            subtitle={rtl ? "לחיצות ב-30 הימים האחרונים" : "Workspace traffic over the last 30 days"}
          >
            <Segmented
              value={interval}
              onChange={(value) => setInterval(value as Interval)}
              items={rtl ? [["daily", "יומי"], ["weekly", "שבועי"], ["monthly", "חודשי"]] : [["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"]]}
            />
          </CardHeader>
          {trend.isLoading ? <ChartSkeleton /> : trend.data?.some((point) => point.clicks > 0) ? <TrafficChart data={trend.data} direction={direction} /> : <Empty icon={BarChart3} text={rtl ? "לא נרשמו לחיצות." : "No clicks have been recorded in this period yet."} />}
        </AnalyticsCard>

        <AnalyticsCard>
          <CardHeader icon={Users} title={rtl ? "משתמשים פעילים ייחודיים" : "Unique active users"} subtitle={rtl ? "עובדים שהקליקו על קישור" : "Employees who clicked a link"} />
          <Segmented
            value={activeRange}
            onChange={(value) => setActiveRange(value as ActiveRange)}
            items={rtl ? [["7d", "7 ימים"], ["30d", "30 ימים"], ["all", "הכול"]] : [["7d", "7 days"], ["30d", "30 days"], ["all", "All time"]]}
          />
          {active.isLoading ? <KpiSkeleton /> : (
            <div className="mt-8">
              <p className="text-5xl font-black tracking-tight text-slate-950">{active.data?.active_users ?? 0}</p>
              {active.data?.delta_percent != null && (
                <div className={`mt-4 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${active.data.delta_percent >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {active.data.delta_percent >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                  {active.data.delta_percent > 0 ? "+" : ""}{active.data.delta_percent}% {rtl ? "לעומת התקופה הקודמת" : "vs previous period"}
                </div>
              )}
              <div className="mt-8 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-xs text-slate-500">{rtl ? "משתמשים פעילים היום (DAU)" : "Daily active users (DAU)"}</span>
                <strong className="text-lg text-slate-900">{active.data?.dau ?? 0}</strong>
              </div>
            </div>
          )}
        </AnalyticsCard>
      </div>

      <AnalyticsCard>
        <CardHeader icon={Activity} title={rtl ? "הפרויקטים הפעילים ביותר" : "Top projects"} subtitle={rtl ? "דירוג לפי כלל האינטראקציות עם קישורים" : "Ranked by total link interactions"} />
        {projects.isLoading ? <TableSkeleton /> : projects.data?.some((project) => project.clicks > 0) ? <Leaderboard projects={projects.data} rtl={rtl} /> : <Empty icon={Activity} text={rtl ? "אין עדיין פעילות בפרויקטים להצגה." : "There is no project activity to rank yet."} />}
      </AnalyticsCard>
    </div>
  );
}

function TrafficChart({ data, direction }: { data: ClickTrendPoint[]; direction: Direction }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const gradientId = useId().replace(/:/g, "");
  const width = 900, height = 300, padX = 24, padY = 24;
  const max = Math.max(...data.map((point) => point.clicks), 1);
  const coordinates = data.map((point, index) => ({
    ...point,
    x: padX + (index / Math.max(data.length - 1, 1)) * (width - padX * 2),
    y: padY + (1 - point.clicks / max) * (height - padY * 2),
  }));
  const line = coordinates.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const area = `${line} L${coordinates.at(-1)?.x ?? padX},${height - padY} L${padX},${height - padY} Z`;
  const locale = direction === "rtl" ? "he-IL" : "en-US";
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }), [locale]);

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * width;
    const index = Math.round(((x - padX) / (width - padX * 2)) * (data.length - 1));
    setHovered(Math.max(0, Math.min(data.length - 1, index)));
  }

  const active = hovered == null ? null : coordinates[hovered];
  return <div ref={wrap} className="relative mt-6 h-72 w-full overflow-hidden" onPointerLeave={() => setHovered(null)}>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full touch-none" onPointerMove={onMove} role="img" aria-label={direction === "rtl" ? "גרף הקלקות לפי זמן" : "Clicks over time chart"}>
      <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6366f1" stopOpacity=".34" /><stop offset="1" stopColor="#6366f1" stopOpacity=".02" /></linearGradient></defs>
      {[0, .25, .5, .75, 1].map((value) => <line key={value} x1={padX} x2={width - padX} y1={padY + value * (height - padY * 2)} y2={padY + value * (height - padY * 2)} stroke="#e2e8f0" strokeDasharray="4 7" />)}
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="#4f46e5" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      {active && <><line x1={active.x} x2={active.x} y1={padY} y2={height - padY} stroke="#818cf8" strokeDasharray="4 5" /><circle cx={active.x} cy={active.y} r="6" fill="white" stroke="#4f46e5" strokeWidth="3" vectorEffect="non-scaling-stroke" /></>}
    </svg>
    {active && <div className="pointer-events-none absolute top-2 z-10 min-w-36 -translate-x-1/2 rounded-xl border border-slate-200 bg-slate-950 px-3 py-2 text-white shadow-xl" style={{ left: `${active.x / width * 100}%` }}><p className="text-[10px] text-slate-400">{dateFormatter.format(new Date(`${active.date}T00:00:00Z`))}</p><p className="mt-1 text-sm font-bold">{active.clicks.toLocaleString(locale)} {direction === "rtl" ? "הקלקות" : "clicks"}</p></div>}
  </div>;
}

function Leaderboard({ projects, rtl }: { projects: NonNullable<ReturnType<typeof useTopProjects>["data"]>; rtl: boolean }) {
  return <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-start"><thead><tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><th className="px-3 py-3 text-start">#</th><th className="px-3 py-3 text-start">{rtl ? "פרויקט" : "Project"}</th><th className="px-3 py-3 text-start">{rtl ? "קישורים" : "Links"}</th><th className="px-3 py-3 text-start">{rtl ? "הקלקות" : "Clicks"}</th><th className="px-3 py-3 text-start">{rtl ? "מבקרים ייחודיים" : "Unique visitors"}</th><th className="w-48 px-3 py-3 text-start">{rtl ? "נתח תנועה" : "Traffic share"}</th></tr></thead><tbody>{projects.filter((project) => project.clicks > 0).map((project, index) => <tr key={project.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80"><td className="px-3 py-4 text-sm font-black text-slate-300">{index + 1}</td><td className="px-3 py-4"><div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">{initials(project.creator_name)}</span><div><p className="font-bold text-slate-900">{project.name}</p><p className="text-[11px] text-slate-400">{project.creator_name}</p></div></div></td><td className="px-3 py-4 text-sm font-semibold">{project.links_count}</td><td className="px-3 py-4 text-sm font-semibold">{project.clicks}</td><td className="px-3 py-4 text-sm font-semibold">{project.unique_visitors}</td><td className="px-3 py-4"><div className="flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-[width] duration-500" style={{ width: `${Math.min(project.traffic_share, 100)}%` }} /></div><span className="w-11 text-end text-xs font-bold text-slate-600">{project.traffic_share}%</span></div></td></tr>)}</tbody></table></div>;
}

function AnalyticsCard({ children }: { children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md lg:p-6">{children}</section>; }
function CardHeader({ icon: Icon, title, subtitle, children }: { icon: typeof Activity; title: string; subtitle: string; children?: React.ReactNode }) { return <div className="flex flex-wrap items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Icon className="size-5" /></span><div><h2 className="font-black text-slate-900">{title}</h2><p className="mt-0.5 text-xs text-slate-400">{subtitle}</p></div>{children && <div className="ms-auto">{children}</div>}</div>; }
function Segmented({ value, onChange, items }: { value: string; onChange: (value: string) => void; items: string[][] }) { return <div className="flex rounded-xl bg-slate-100 p-1">{items.map(([key, label]) => <button key={key} onClick={() => onChange(key)} className={`rounded-lg px-3 py-1.5 text-xs transition ${value === key ? "bg-white font-bold text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{label}</button>)}</div>; }
function Empty({ icon: Icon, text }: { icon: typeof Activity; text: string }) { return <div className="mt-6 grid min-h-56 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-center"><div><Icon className="mx-auto size-8 text-slate-300" /><p className="mt-3 text-sm text-slate-400">{text}</p></div></div>; }
function Pulse({ className }: { className: string }) { return <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />; }
function ChartSkeleton() { return <div className="mt-6 space-y-3"><Pulse className="h-52 w-full" /><Pulse className="h-3 w-2/3" /></div>; }
function KpiSkeleton() { return <div className="mt-8 space-y-4"><Pulse className="h-14 w-28" /><Pulse className="h-7 w-40" /><Pulse className="mt-8 h-14 w-full" /></div>; }
function TableSkeleton() { return <div className="mt-5 space-y-3">{[1,2,3,4].map((item) => <Pulse key={item} className="h-16 w-full" />)}</div>; }
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?"; }
