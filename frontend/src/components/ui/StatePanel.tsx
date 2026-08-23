import type { ReactNode } from "react";

interface StatePanelProps {
  title: string;
  detail?: string;
  action?: ReactNode;
}

/**
 * Loading, empty and error all land here. An empty screen is an invitation to
 * act, and an error says what happened and what to do about it.
 */
export function StatePanel({ title, detail, action }: StatePanelProps) {
  return (
    <div className="border border-hairline bg-panel px-6 py-14 text-center">
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      {detail && <p className="mx-auto mt-2 max-w-md text-sm text-muted">{detail}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/** Panel-shaped placeholders keep the grid from jumping when data lands. */
export function ProjectCardSkeleton() {
  return (
    <div className="min-h-[22rem] animate-pulse rounded-[1.25rem] border border-hairline bg-panel px-8 py-8 sm:px-10 sm:py-9">
      <div className="h-8 w-40 rounded bg-board" />
      <div className="mt-10 space-y-3">
        <div className="h-4 w-full rounded bg-board" />
        <div className="h-4 w-4/5 rounded bg-board" />
      </div>
      <div className="mt-12 h-4 w-28 rounded bg-board" />
      <div className="mt-5 h-4 w-36 rounded bg-board" />
    </div>
  );
}
