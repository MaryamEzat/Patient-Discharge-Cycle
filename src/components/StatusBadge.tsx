export function StatusBadge({ label }: { label: string }) {
  const s = label.toLowerCase();
  const color = /complete|clear|submit/.test(s)
    ? "success"
    : /forward/.test(s)
      ? "forward"
      : /delay|cancel|miss/.test(s)
        ? "danger"
        : /pending/.test(s)
          ? "warning"
          : "info";
  return <span className={`status-badge status-${color}`}>{label || "-"}</span>;
}
