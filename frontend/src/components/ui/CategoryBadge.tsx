import { CATEGORY_LABELS, CATEGORY_STYLES, type LinkCategory } from "@/types";

interface CategoryBadgeProps {
  category: LinkCategory;
  count?: number;
}

/** A status LED plus its label. Colour carries the category; nothing else does. */
export function CategoryBadge({ category, count }: CategoryBadgeProps) {
  const style = CATEGORY_STYLES[category];

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      <span className={`label-mono ${style.text}`}>
        {CATEGORY_LABELS[category]}
        {count !== undefined && <span className="text-muted"> {count}</span>}
      </span>
    </span>
  );
}
