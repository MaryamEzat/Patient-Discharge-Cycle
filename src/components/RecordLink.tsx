import type { ReactNode } from "react";
import { platformService } from "../services/platformService";
import { useResource } from "../hooks/useResource";
export function RecordLink({
  table,
  id,
  defaults,
  className,
  children,
}: {
  table: string;
  id?: string;
  defaults?: Record<string, string>;
  className?: string;
  children: ReactNode;
}) {
  const result = useResource(
    () => platformService.recordUrl(table, id, defaults),
    [table, id, JSON.stringify(defaults)],
  );
  const cls = className || "record-link";
  return result.data ? (
    <a
      className={cls}
      href={result.data}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ) : (
    <button
      className={cls}
      type="button"
      disabled
      title="The full record form is unavailable in this session."
    >
      {children}
    </button>
  );
}
