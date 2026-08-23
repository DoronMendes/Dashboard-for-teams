import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BarChart3, Bookmark, Check, Copy, ExternalLink, GripVertical, Link2, Pencil, Share2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { useSetLinkBookmark } from "@/hooks/useProjects";
import { recordLinkVisit } from "@/services/api";
import { CATEGORY_LABELS, type Link } from "@/types";

interface LinkRowProps { link: Link; onEdit: (link: Link) => void; onDelete: (link: Link) => void; }
export function LinkRow({ link, onEdit, onDelete }: LinkRowProps) {
  const [copied, setCopied] = useState(false);
  const bookmark = useSetLinkBookmark();
  const timer = useRef<number | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
    transition: { duration: 100, easing: "cubic-bezier(0.2, 0, 0, 1)" },
  });
  const rowStyle: CSSProperties = { transform: CSS.Transform.toString(transform), transition: isDragging ? "none" : transition, zIndex: isDragging ? 30 : undefined, opacity: isDragging ? .7 : 1 };
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);
  async function copy(event: MouseEvent<HTMLButtonElement>) { event.stopPropagation(); await navigator.clipboard.writeText(link.url); setCopied(true); if (timer.current !== null) window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setCopied(false), 1800); }
  async function openTracked(event: MouseEvent<HTMLAnchorElement>) { event.preventDefault(); const target = window.open("about:blank", "_blank"); try { const url = await recordLinkVisit(link.id); if (target) target.location.href = url; else window.location.assign(url); } catch { target?.close(); window.open(link.url, "_blank", "noopener,noreferrer"); } }
  let host = "link"; try { host = new URL(link.url).hostname.replace(/^www\./, ""); } catch { /* fallback */ }
  let favicon = ""; try { favicon = `${new URL(link.url).origin}/favicon.ico`; } catch { /* fallback */ }
  return <li ref={setNodeRef} style={rowStyle} className={`group/link relative flex min-h-12 w-full items-center gap-2 border-b border-slate-100 px-1.5 py-1.5 transition-colors last:border-b-0 hover:bg-slate-50 ${isDragging ? "rounded-md bg-white shadow-lg ring-1 ring-indigo-200" : ""}`}>
    <button type="button" {...attributes} {...listeners} aria-label={`שינוי מיקום הקישור ${link.title}`} className="w-3 shrink-0 cursor-grab touch-none text-slate-300 opacity-0 transition-opacity hover:text-slate-600 group-hover/link:opacity-100 focus:opacity-100"><GripVertical className="size-3.5" /></button>
    <span className="relative grid size-7 shrink-0 place-items-center overflow-hidden rounded-md border border-slate-200/60 bg-slate-100 text-slate-500"><Link2 className="size-4" />{favicon && <img src={favicon} alt="" className="absolute inset-0 size-full bg-white object-contain p-1" onError={(event) => { event.currentTarget.style.display = "none"; }} />}</span>
    <div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-1.5"><a href={link.url} onClick={(event) => void openTracked(event)} target="_blank" rel="noreferrer noopener" className="truncate text-sm font-semibold text-slate-800 hover:text-indigo-600">{link.title}</a><ExternalLink className="size-3 shrink-0 text-slate-300" /><span className="max-w-[140px] truncate font-mono text-xs text-slate-400" dir="ltr">{host}</span><button onClick={(event) => void copy(event)} aria-label="Copy URL" className={`shrink-0 ${copied ? "text-emerald-500" : "text-slate-300 hover:text-indigo-600"}`}>{copied ? <Check className="size-3" /> : <Copy className="size-3" />}</button></div><div className="mt-0.5 flex min-w-0 items-center gap-1 overflow-hidden"><span className="shrink-0 rounded-full border border-blue-200/50 bg-blue-50 px-2 py-0.5 text-[11px] font-medium leading-none text-blue-700">#{CATEGORY_LABELS[link.category]}</span>{link.tags.slice(0, 2).map((tag) => <span key={tag} className="max-w-24 truncate rounded-full border border-violet-200/50 bg-violet-50 px-2 py-0.5 text-[11px] font-medium leading-none text-violet-700">#{tag}</span>)}{link.tags.length > 2 && <span className="text-[10px] text-slate-400">+{link.tags.length - 2}</span>}</div></div>
    <button onClick={() => bookmark.mutate({ id: link.id, enabled: !link.is_bookmarked })} aria-label="Bookmark" className={`shrink-0 rounded-md p-1.5 ${link.is_bookmarked ? "bg-amber-50 text-amber-500" : "text-slate-300 hover:bg-slate-100"}`}><Bookmark className={`size-3.5 ${link.is_bookmarked ? "fill-current" : ""}`} /></button>
    <div className="invisible absolute end-9 top-1/2 flex -translate-y-1/2 items-center rounded-md border border-slate-200 bg-white p-0.5 opacity-0 shadow-sm transition group-hover/link:visible group-hover/link:opacity-100 group-focus-within/link:visible group-focus-within/link:opacity-100"><Action icon={Share2} label="Share" onClick={() => void shareLink(link)} /><Action icon={BarChart3} label="Analytics" onClick={() => window.location.assign(`/analytics?link=${link.id}`)} /><button onClick={() => onEdit(link)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100"><Pencil className="size-3.5" /></button><button onClick={() => onDelete(link)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="size-3.5" /></button></div>
  </li>;
}
async function shareLink(link: Link) { if (navigator.share) await navigator.share({ title: link.title, url: link.url }); else await navigator.clipboard.writeText(link.url); }
function Action({ icon: Icon, label, onClick }: { icon: typeof Share2; label: string; onClick: () => void }) { return <button onClick={onClick} aria-label={label} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"><Icon className="size-3.5" /></button>; }
