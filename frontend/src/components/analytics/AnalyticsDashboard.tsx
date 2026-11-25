import { useId, useMemo, useRef, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, FolderX, Gauge, HeartPulse, MousePointerClick, RefreshCw, Trophy, UserRoundCheck, Users } from "lucide-react";

import { useActiveUsers, useAnalytics, useCheckAllLinkHealth, useClicksTrend, useHealthSummary, useTopProjects } from "@/hooks/useProjects";
import { ActionTooltip } from "@/components/ui/ActionTooltip";
import type { ClickTrendPoint } from "@/types";

type Direction = "rtl" | "ltr";
type Interval = "daily" | "weekly" | "monthly";
type ActiveRange = "7d" | "30d" | "all";

export function AnalyticsDashboard({ direction }: { direction: Direction }) {
  const [interval, setInterval] = useState<Interval>("daily");
  const [activeRange, setActiveRange] = useState<ActiveRange>("7d");
  const trend = useClicksTrend(interval);
  const analytics = useAnalytics();
  const active = useActiveUsers(activeRange);
  const projects = useTopProjects();
  const health = useHealthSummary();
  const checkAllHealth = useCheckAllLinkHealth();
  const rtl = direction === "rtl";

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InsightCard
          icon={Gauge}
          label={rtl ? "קישורים איטיים" : "Slow links"}
          value={analytics.data?.slow_links ?? 0}
          detail={rtl ? "זמן תגובה מעל 2.5 שניות" : "Response time above 2.5 seconds"}
          loading={analytics.isLoading}
          tone="amber"
        />
        <InsightCard
          icon={UserRoundCheck}
          label={rtl ? "משתמשים פעילים השבוע" : "Active users this week"}
          value={analytics.data?.weekly_active_users ?? 0}
          detail={rtl ? "משתמשים ייחודיים ב־7 ימים" : "Unique users over 7 days"}
          loading={analytics.isLoading}
          tone="blue"
        />
        <InsightCard
          icon={FolderX}
          label={rtl ? "הפרויקט עם הכי הרבה שגיאות" : "Project with most errors"}
          value={analytics.data?.project_with_most_errors?.name ?? (rtl ? "אין שגיאות" : "No errors")}
          detail={analytics.data?.project_with_most_errors ? `${analytics.data.project_with_most_errors.errors} ${rtl ? "קישורים עם שגיאה" : "links with errors"}` : (rtl ? "כל הפרויקטים תקינים" : "All projects are healthy")}
          loading={analytics.isLoading}
          tone="rose"
        />
        <InsightCard
          icon={Trophy}
          label={rtl ? "הקישור הנצפה ביותר" : "Most viewed link"}
          value={analytics.data?.most_visited?.title ?? (rtl ? "אין צפיות" : "No views")}
          detail={analytics.data?.most_visited ? `${analytics.data.most_visited.visits} ${rtl ? "צפיות" : "views"}` : (rtl ? "טרם נרשמו צפיות" : "No views recorded yet")}
          loading={analytics.isLoading}
          tone="emerald"
        />
      </div>

      <AnalyticsCard>
        <CardHeader icon={HeartPulse} title={rtl ? "תקינות קישורים" : "Link health"} subtitle={rtl ? "מצב הזמינות האחרון בכל סביבת העבודה" : "Latest availability across the workspace"}>
          <button type="button" onClick={() => checkAllHealth.mutate()} disabled={checkAllHealth.isPending} className="inline-flex items-center gap-2 rounded-xl bg-[#0B3FC1] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0936a6] disabled:opacity-50">
            <RefreshCw className={`size-3.5 ${checkAllHealth.isPending ? "animate-spin" : ""}`} />
            {rtl ? "בדיקת כל הקישורים" : "Check all links"}
          </button>
        </CardHeader>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <HealthMetric color="bg-emerald-500" label={rtl ? "תקינים" : "Healthy"} value={health.data?.healthy ?? 0} loading={health.isLoading} />
          <HealthMetric color="bg-amber-500" label={rtl ? "אזהרות" : "Warnings"} value={health.data?.warning ?? 0} loading={health.isLoading} />
          <HealthMetric color="bg-rose-500" label={rtl ? "שגיאות" : "Errors"} value={health.data?.error ?? 0} loading={health.isLoading} />
        </div>
        <HealthDistribution healthy={health.data?.healthy ?? 0} warning={health.data?.warning ?? 0} error={health.data?.error ?? 0} rtl={rtl} />
      </AnalyticsCard>

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
      <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0B3FC1" stopOpacity=".28" /><stop offset="1" stopColor="#0B3FC1" stopOpacity=".02" /></linearGradient></defs>
      {[0, .25, .5, .75, 1].map((value) => <line key={value} x1={padX} x2={width - padX} y1={padY + value * (height - padY * 2)} y2={padY + value * (height - padY * 2)} stroke="#e2e8f0" strokeDasharray="4 7" />)}
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="#0B3FC1" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      {active && <><line x1={active.x} x2={active.x} y1={padY} y2={height - padY} stroke="#60a5fa" strokeDasharray="4 5" /><circle cx={active.x} cy={active.y} r="6" fill="white" stroke="#0B3FC1" strokeWidth="3" vectorEffect="non-scaling-stroke" /></>}
    </svg>
    {active && <div className="pointer-events-none absolute top-2 z-10 min-w-36 -translate-x-1/2 rounded-xl border border-slate-200 bg-slate-950 px-3 py-2 text-white shadow-xl" style={{ left: `${active.x / width * 100}%` }}><p className="text-[10px] text-slate-400">{dateFormatter.format(new Date(`${active.date}T00:00:00Z`))}</p><p className="mt-1 text-sm font-bold">{active.clicks.toLocaleString(locale)} {direction === "rtl" ? "הקלקות" : "clicks"}</p></div>}
  </div>;
}

function Leaderboard({ projects, rtl }: { projects: NonNullable<ReturnType<typeof useTopProjects>["data"]>; rtl: boolean }) {
  return <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-start"><thead><tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><th className="px-3 py-3 text-start">#</th><th className="px-3 py-3 text-start">{rtl ? "פרויקט" : "Project"}</th><th className="px-3 py-3 text-start">{rtl ? "קישורים" : "Links"}</th><th className="px-3 py-3 text-start">{rtl ? "הקלקות" : "Clicks"}</th><th className="px-3 py-3 text-start">{rtl ? "מבקרים ייחודיים" : "Unique visitors"}</th><th className="w-48 px-3 py-3 text-start">{rtl ? "נתח תנועה" : "Traffic share"}</th></tr></thead><tbody>{projects.filter((project) => project.clicks > 0).map((project, index) => <tr key={project.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80"><td className="px-3 py-4 text-sm font-black text-slate-300">{index + 1}</td><td className="px-3 py-4"><div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">{initials(project.creator_name)}</span><div><p className="font-bold text-slate-900">{project.name}</p><p className="text-[11px] text-slate-400">{project.creator_name}</p></div></div></td><td className="px-3 py-4 text-sm font-semibold">{project.links_count}</td><td className="px-3 py-4 text-sm font-semibold">{project.clicks}</td><td className="px-3 py-4 text-sm font-semibold"><ActionTooltip label={<span className="block min-w-40 text-start"><strong className="mb-1.5 block text-xs">{rtl ? "מבקרים ייחודיים" : "Unique visitors"}</strong>{project.visitors.map((visitor) => <span key={visitor.id} className="block border-t border-white/10 py-1.5 first:border-0"><span className="block">{visitor.name}</span><span className="block text-[10px] font-normal text-slate-300" dir="ltr">{visitor.email}</span></span>)}</span>}><button type="button" className="rounded-lg px-2 py-1 font-bold text-[#0B3FC1] underline decoration-blue-200 decoration-dotted underline-offset-4">{project.unique_visitors}</button></ActionTooltip></td><td className="px-3 py-4"><div className="flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-[width] duration-500" style={{ width: `${Math.min(project.traffic_share, 100)}%` }} /></div><span className="w-11 text-end text-xs font-bold text-slate-600">{project.traffic_share}%</span></div></td></tr>)}</tbody></table></div>;
}

function AnalyticsCard({ children }: { children: React.ReactNode }) { return <section className="rounded-[20px] bg-white p-6 shadow-[0_12px_38px_rgba(15,23,42,0.055)] lg:p-7">{children}</section>; }
function InsightCard({ icon: Icon, label, value, detail, loading, tone }: { icon: typeof Activity; label: string; value: number | string; detail: string; loading: boolean; tone: "amber" | "blue" | "rose" | "emerald" }) { const tones = { amber: "bg-amber-50 text-amber-600", blue: "bg-blue-50 text-[#0B3FC1]", rose: "bg-rose-50 text-rose-600", emerald: "bg-emerald-50 text-emerald-600" }; return <section className="min-w-0 rounded-[20px] bg-white p-5 shadow-[0_12px_38px_rgba(15,23,42,0.055)]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold text-slate-500">{label}</p>{loading ? <Pulse className="mt-4 h-9 w-24" /> : <p className="mt-3 truncate font-display text-2xl font-extrabold tracking-tight text-slate-950" title={String(value)}>{value}</p>}</div><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="size-5" /></span></div><p className="mt-3 truncate text-xs text-slate-400" title={detail}>{detail}</p></section>; }
function HealthMetric({ color, label, value, loading }: { color: string; label: string; value: number; loading: boolean }) { return <div className="rounded-2xl bg-[#F7F8F6] px-5 py-5"><div className="flex items-center gap-2"><span className={`size-2.5 rounded-full ${color}`} /><span className="text-sm font-semibold text-slate-500">{label}</span></div>{loading ? <Pulse className="mt-4 h-10 w-20" /> : <strong className="mt-4 block font-display text-4xl font-extrabold tracking-tight text-slate-950">{value}</strong>}</div>; }
function HealthDistribution({ healthy, warning, error, rtl }: { healthy: number; warning: number; error: number; rtl: boolean }) { const total = healthy + warning + error; const percent = (value: number) => total ? `${value / total * 100}%` : "0%"; return <div className="mt-6 rounded-2xl bg-[#F7F8F6] p-4"><div className="mb-3 flex items-center justify-between text-xs"><strong className="text-slate-700">{rtl ? "התפלגות תקינות" : "Health distribution"}</strong><span className="text-slate-400">{total} {rtl ? "קישורים שנבדקו" : "checked links"}</span></div><div className="flex h-3 overflow-hidden rounded-full bg-slate-200"><span className="bg-emerald-500" style={{ width: percent(healthy) }} /><span className="bg-amber-400" style={{ width: percent(warning) }} /><span className="bg-rose-500" style={{ width: percent(error) }} /></div></div>; }
function CardHeader({ icon: Icon, title, subtitle, children }: { icon: typeof Activity; title: string; subtitle: string; children?: React.ReactNode }) { return <div className="flex flex-wrap items-start gap-3"><span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-[#0B3FC1]"><Icon className="size-5.5" /></span><div><h2 className="font-display text-lg font-extrabold text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-400">{subtitle}</p></div>{children && <div className="ms-auto">{children}</div>}</div>; }
function Segmented({ value, onChange, items }: { value: string; onChange: (value: string) => void; items: string[][] }) { return <div className="flex rounded-xl bg-slate-100 p-1">{items.map(([key, label]) => <button key={key} onClick={() => onChange(key)} className={`rounded-lg px-3 py-1.5 text-xs transition ${value === key ? "bg-white font-bold text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{label}</button>)}</div>; }
function Empty({ icon: Icon, text }: { icon: typeof Activity; text: string }) { return <div className="mt-6 grid min-h-56 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-center"><div><Icon className="mx-auto size-8 text-slate-300" /><p className="mt-3 text-sm text-slate-400">{text}</p></div></div>; }
function Pulse({ className }: { className: string }) { return <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />; }
function ChartSkeleton() { return <div className="mt-6 space-y-3"><Pulse className="h-52 w-full" /><Pulse className="h-3 w-2/3" /></div>; }
function KpiSkeleton() { return <div className="mt-8 space-y-4"><Pulse className="h-14 w-28" /><Pulse className="h-7 w-40" /><Pulse className="mt-8 h-14 w-full" /></div>; }
function TableSkeleton() { return <div className="mt-5 space-y-3">{[1,2,3,4].map((item) => <Pulse key={item} className="h-16 w-full" />)}</div>; }
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?"; }
