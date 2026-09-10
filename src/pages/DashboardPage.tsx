import type { Patient } from "../services/dischargeService";
import { dateKey, truthy, type Row } from "../presentation/format";

export function getTodayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function calculateKpis(rows: Patient[], selectedDate?: string) {
  const targetDateKey = selectedDate || getTodayDateKey();
  const dateMatchedRows = rows.filter((r) => {
    const key =
      dateKey(r.createdon) ||
      dateKey(r.crad2_dischargedate) ||
      dateKey(r.and_physiciandischargedate);
    return key === targetDateKey;
  });

  // Fallback to all filtered rows if date filter is active or date matching produces empty set during streaming
  const targetRows = dateMatchedRows.length > 0 ? dateMatchedRows : rows;

  const pending = targetRows.filter((r) => r.crad2_status === 408520000).length;
  const delayed = targetRows.filter((r) =>
    truthy((r as unknown as Row).and_isdelayed),
  ).length;

  return [
    targetRows.length,
    pending + delayed,
    targetRows.filter((r) => r.crad2_status === 408520002).length,
    delayed || pending,
  ];
}

// The source dashboard is embedded above the worklist; preserve its location and formulas.
export function DashboardPage({
  rows,
  selectedDate,
}: {
  rows: Patient[];
  selectedDate?: string;
}) {
  const values = calculateKpis(rows, selectedDate);
  const isSelected = Boolean(selectedDate);
  return (
    <div className="kpi-grid">
      {[
        isSelected ? "Discharges" : "Today Discharges",
        isSelected ? "Pending / Delayed" : "Today Pending / Delayed",
        isSelected ? "Completed" : "Completed Today",
        isSelected ? "Priority" : "Today Priority",
      ].map((label, i) => (
        <div className="kpi" key={label}>
          <div className="kpi-title">{label}</div>
          <div className="kpi-value">{values[i]}</div>
        </div>
      ))}
    </div>
  );
}
