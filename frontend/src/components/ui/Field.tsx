import { useId, type ReactNode } from "react";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; describedBy: string | undefined }) => ReactNode;
}

/** Label, control, and message wired together so screen readers follow along. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;

  return (
    <div>
      <label htmlFor={id} className="label-mono mb-2 block text-slate-600">
        {label}
      </label>

      {children({ id, describedBy: message ? messageId : undefined })}

      {message && (
        <p
          id={messageId}
          className={`mt-1.5 text-xs ${error ? "text-cat-monitoring" : "text-muted"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink shadow-[inset_0_1px_2px_rgba(15,23,42,0.025)] transition-[border-color,box-shadow,background-color] placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0B3FC1] focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100/70 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60";
