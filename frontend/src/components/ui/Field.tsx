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
      <label htmlFor={id} className="label-mono mb-1.5 block text-muted">
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
  "w-full border border-hairline bg-board/40 px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-signal focus:bg-panel focus:outline-none disabled:opacity-60";
