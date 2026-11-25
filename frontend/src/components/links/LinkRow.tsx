import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpLeft, BarChart3, Bookmark, Check, Copy, GripVertical, MoreVertical, Pencil, RefreshCw, Share2, Trash2, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { StatusBadge } from "@/components/links/StatusBadge";
import { useCheckLinkHealth, useSetLinkBookmark } from "@/hooks/useProjects";
import { recordLinkVisit } from "@/services/api";
import { CATEGORY_LABELS, type Link } from "@/types";

interface LinkRowProps { link: Link; onEdit: (link: Link) => void; onDelete: (link: Link) => void; }

export function LinkRow({ link, onEdit, onDelete }: LinkRowProps) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bookmark = useSetLinkBookmark();
  const health = useCheckLinkHealth();
  const timer = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
    transition: { duration: 100, easing: "cubic-bezier(0.2, 0, 0, 1)" },
  });
  const rowStyle: CSSProperties = { transform: CSS.Transform.toString(transform), transition: isDragging ? "none" : transition, zIndex: isDragging ? 30 : undefined, opacity: isDragging ? 0.7 : 1 };

  useEffect(() => {
    function closeMenu(event: PointerEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !popupRef.current?.contains(target)) setMenuOpen(false);
    }
    document.addEventListener("pointerdown", closeMenu);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  async function copy() {
    await navigator.clipboard.writeText(link.url);
    setCopied(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  }
  async function openTracked(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const target = window.open("about:blank", "_blank");
    try {
      const url = await recordLinkVisit(link.id);
      if (target) target.location.href = url;
      else window.location.assign(url);
    } catch {
      target?.close();
      window.open(link.url, "_blank", "noopener,noreferrer");
    }
  }

  function toggleMenu() {
    if (!menuOpen && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const menuWidth = 160;
      const gap = 8;
      const opensToLeft = document.documentElement.dir === "rtl";
      const preferredLeft = opensToLeft ? rect.left - menuWidth - gap : rect.right + gap;
      setMenuPosition({
        left: Math.max(gap, Math.min(preferredLeft, window.innerWidth - menuWidth - gap)),
        top: Math.max(gap, Math.min(rect.top, window.innerHeight - 224)),
      });
    }
    setMenuOpen((open) => !open);
  }

  let host = "link";
  try { host = new URL(link.url).hostname.replace(/^www\./, ""); } catch { /* Legacy URL fallback. */ }

  return <li ref={setNodeRef} style={rowStyle} className={`group/link relative flex min-h-[4.5rem] w-full items-center gap-2 border-b border-slate-100/80 px-2 py-2.5 transition-colors last:border-b-0 hover:bg-slate-50/80 ${isDragging ? "rounded-xl bg-white shadow-lg ring-1 ring-blue-200" : ""}`}>
    <button type="button" {...attributes} {...listeners} aria-label={`שינוי מיקום הקישור ${link.title}`} className="w-3 shrink-0 cursor-grab touch-none text-slate-300 opacity-0 transition-opacity hover:text-slate-600 group-hover/link:opacity-100 focus:opacity-100"><GripVertical className="size-3.5" /></button>

    <a href={link.url} onClick={(event) => void openTracked(event)} target="_blank" rel="noreferrer noopener" aria-label={`פתיחת ${link.title}`} className="group/open min-w-0 flex-1 rounded-xl px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5"><StatusBadge link={link} /><strong className="truncate text-sm font-bold text-slate-900 transition-colors group-hover/open:text-[#0B3FC1]">{link.title}</strong><span className="grid size-5 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-400 transition group-hover/open:bg-blue-50 group-hover/open:text-[#0B3FC1]"><ArrowUpLeft className="size-3" strokeWidth={2.2} /></span></span>
        <span className="mt-0.5 block max-w-full truncate font-mono text-[10px] text-slate-400" dir="ltr">{host}</span>
        <span className="mt-1.5 flex min-w-0 items-center gap-1 overflow-hidden"><span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold leading-none text-blue-700">{CATEGORY_LABELS[link.category]}</span>{link.tags.slice(0, 2).map((tag) => <span key={tag} className="max-w-20 truncate rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium leading-none text-violet-700">{tag}</span>)}{link.tags.length > 2 && <span className="text-[10px] text-slate-400">+{link.tags.length - 2}</span>}</span>
      </span>
    </a>

    <button type="button" onClick={() => bookmark.mutate({ id: link.id, enabled: !link.is_bookmarked })} aria-label={link.is_bookmarked ? "הסרה מהסימניות" : "שמירה בסימניות"} className={`grid size-8 shrink-0 place-items-center rounded-full transition-colors ${link.is_bookmarked ? "bg-amber-50 text-amber-500" : "text-slate-300 hover:bg-white hover:text-slate-500 hover:shadow-sm"}`}><Bookmark className={`size-3.5 ${link.is_bookmarked ? "fill-current" : ""}`} /></button>

    <div ref={menuRef} className="relative shrink-0">
      <button type="button" onClick={toggleMenu} aria-label="פעולות נוספות" aria-expanded={menuOpen} className={`grid size-8 place-items-center rounded-full transition-colors ${menuOpen ? "bg-slate-100 text-slate-700" : "text-slate-300 hover:bg-white hover:text-slate-600 hover:shadow-sm"}`}><MoreVertical className="size-3.5" /></button>
      {menuOpen && createPortal(<div ref={popupRef} className="fixed z-[100] w-40 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-lg" style={menuPosition} dir="rtl">
        <MenuAction icon={copied ? Check : Copy} label={copied ? "הקישור הועתק" : "העתקת קישור"} onClick={() => void copy()} success={copied} />
        <MenuAction icon={Share2} label="שיתוף" onClick={() => void shareLink(link)} />
        <MenuAction icon={BarChart3} label="צפייה באנליטיקה" onClick={() => window.location.assign(`/analytics?link=${link.id}`)} />
        <MenuAction icon={RefreshCw} label={health.isPending && health.variables === link.id ? "בודק זמינות..." : "בדיקת זמינות"} onClick={() => health.mutate(link.id)} />
        <MenuAction icon={Pencil} label="עריכת קישור" onClick={() => { setMenuOpen(false); onEdit(link); }} />
        <div className="my-1 border-t border-slate-100" />
        <MenuAction icon={Trash2} label="מחיקת קישור" onClick={() => { setMenuOpen(false); onDelete(link); }} destructive />
      </div>, document.body)}
    </div>
  </li>;
}

async function shareLink(link: Link) { if (navigator.share) await navigator.share({ title: link.title, url: link.url }); else await navigator.clipboard.writeText(link.url); }

function MenuAction({ icon: Icon, label, onClick, destructive = false, success = false }: { icon: LucideIcon; label: string; onClick: () => void; destructive?: boolean; success?: boolean }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-right text-xs transition-colors ${destructive ? "text-rose-600 hover:bg-rose-50" : success ? "text-emerald-600" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}><Icon className="size-3.5 shrink-0" /><span>{label}</span></button>;
}
