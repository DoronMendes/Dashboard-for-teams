import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { inputClass } from "@/components/ui/Field";

export function RoundedSelect({ id, value, options, onChange, disabled = false, ariaDescribedBy }: { id?: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void; disabled?: boolean; ariaDescribedBy?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return <div ref={rootRef} className="relative">
    <button id={id} type="button" aria-haspopup="listbox" aria-expanded={open} aria-describedby={ariaDescribedBy} disabled={disabled} onClick={() => setOpen((current) => !current)} className={`${inputClass} flex items-center justify-between text-start`}>
      <span>{selected?.label}</span><ChevronDown className={`size-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {open && <div role="listbox" className="absolute inset-x-0 top-full z-[260] mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_45px_rgba(15,23,42,0.18)] animate-[modal-panel-in_160ms_cubic-bezier(0.16,1,0.3,1)]">
      {options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); setOpen(false); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-start text-sm transition-colors ${option.value === value ? "bg-blue-50 font-bold text-[#0B3FC1]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}><span>{option.label}</span>{option.value === value && <Check className="size-4" />}</button>)}
    </div>}
  </div>;
}
