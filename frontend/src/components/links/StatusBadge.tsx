import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Globe2 } from "lucide-react";

import type { Link } from "@/types";

const ORB_COLORS = { healthy: "#00c86f", warning: "#ffad00", error: "#ff2054", checking: "#64748b" } as const;

const STATUS_LABELS = {
  healthy: "תקין",
  warning: "אזהרה",
  error: "שגיאה",
  checking: "בבדיקה / טרם נבדק",
} as const;

const HTTP_REASONS: Record<number, string> = {
  200: "OK",
  201: "Created",
  204: "No Content",
  301: "Moved Permanently",
  302: "Found",
  307: "Temporary Redirect",
  308: "Permanent Redirect",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  408: "Request Timeout",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

function relativeTime(value: string | null): string {
  if (!value) return "טרם נבדק";
  const elapsedSeconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("he", { numeric: "auto" });
  if (Math.abs(elapsedSeconds) < 60) return formatter.format(elapsedSeconds, "second");
  const minutes = Math.round(elapsedSeconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

export function StatusBadge({ link, overlay = false }: { link: Link; overlay?: boolean }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8, above: true });
  const statusDetail = link.status_code
    ? `${STATUS_LABELS[link.health_status]} (${link.status_code} ${HTTP_REASONS[link.status_code] ?? "HTTP"})`
    : link.health_status === "error"
      ? "פסק זמן או שגיאת חיבור"
      : STATUS_LABELS[link.health_status];

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const tooltipWidth = 248;
    const edgeGap = 8;
    setPosition({
      left: Math.max(edgeGap, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - edgeGap)),
      top: rect.top > 90 ? rect.top - 8 : rect.bottom + 8,
      above: rect.top > 90,
    });
  }, []);

  function showTooltip() {
    updatePosition();
    setVisible(true);
  }

  useEffect(() => {
    if (!visible) return;
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [visible, updatePosition]);

  return (
    <span
      ref={anchorRef}
      className={overlay ? "absolute -bottom-0.5 -end-0.5 inline-flex rounded-full bg-white p-[2px]" : "status-orb-anchor relative inline-flex shrink-0 items-center"}
      tabIndex={0}
      aria-label={statusDetail}
      aria-describedby={visible ? tooltipId : undefined}
      onMouseEnter={showTooltip}
      onMouseLeave={() => setVisible(false)}
      onFocus={showTooltip}
      onBlur={() => setVisible(false)}
    >
      {overlay ? <span style={{ backgroundColor: ORB_COLORS[link.health_status] }} className="inline-block size-2.5 rounded-full" /> : <span style={{ "--orb-color": ORB_COLORS[link.health_status] } as CSSProperties} className="status-globe mr-1.5 grid size-3.5 place-items-center rounded-full"><Globe2 className="size-3" strokeWidth={2.1} /></span>}
      {visible && createPortal(
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none fixed z-[200] w-max max-w-[248px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-right text-[11px] leading-5 text-white"
          style={{ left: position.left, top: position.top, transform: position.above ? "translateY(-100%)" : undefined }}
          dir="rtl"
        >
          <strong className="block font-semibold">{statusDetail}</strong>
          {link.response_time_ms !== null && <span className="block text-slate-300">זמן תגובה: {link.response_time_ms}ms</span>}
          <span className="block text-slate-300">נבדק לאחרונה: {relativeTime(link.last_checked_at)}</span>
        </span>,
        document.body,
      )}
    </span>
  );
}
