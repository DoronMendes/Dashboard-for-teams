import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function ActionTooltip({ label, children }: { label: ReactNode; children: ReactNode }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8 });

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const estimatedWidth = typeof label === "string" ? Math.min(Math.max(label.length * 7 + 24, 90), 190) : 190;
    const edgeGap = 8;
    setPosition({
      left: Math.max(edgeGap, Math.min(rect.left + rect.width / 2 - estimatedWidth / 2, window.innerWidth - estimatedWidth - edgeGap)),
      top: rect.bottom + 8,
    });
  }, [label]);

  function show() {
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
      className="inline-flex"
      aria-describedby={visible ? tooltipId : undefined}
      onMouseEnter={show}
      onMouseLeave={() => setVisible(false)}
      onFocusCapture={show}
      onBlurCapture={() => setVisible(false)}
    >
      {children}
      {visible && createPortal(
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none fixed z-[250] w-max max-w-[190px] rounded-xl border border-white/10 bg-slate-950/95 px-2.5 py-1.5 text-center text-[11px] font-semibold leading-4 text-white shadow-[0_10px_28px_rgba(15,23,42,0.24)] backdrop-blur-sm"
          style={{ left: position.left, top: position.top }}
          dir="rtl"
        >
          {label}
        </span>,
        document.body,
      )}
    </span>
  );
}
