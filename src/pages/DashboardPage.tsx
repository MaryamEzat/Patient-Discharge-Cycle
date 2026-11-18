import type { Patient } from "../services/dischargeService";
import {
  dateKey,
  truthy,
  type Row,
} from "../presentation/format";
import { egyptDischargeDelayState } from "../services/egyptDischargeDelay";

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

type KpiTone = "primary" | "info" | "warning" | "success" | "danger";

const kpiIcons = {
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  check: "M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  alert: "M12 8v4M12 16h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
};

function KpiCard({
  label,
  value,
  caption,
  tone,
  icon,
}: {
  label: string;
  value: number | string;
  caption: string;
  tone: KpiTone;
  icon: keyof typeof kpiIcons;
}) {
  return (
    <div className={`kpi kpi-tone-${tone}`}>
      <span className="kpi-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={kpiIcons[icon]} />
        </svg>
      </span>
      <div className="kpi-body">
        <div className="kpi-title">{label}</div>
        <div className="kpi-value">{value}</div>
        <p className="kpi-caption">{caption}</p>
      </div>
    </div>
  );
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
      {(
        [
          [isSelected ? "Discharges" : "Today Discharges", isSelected ? "On the selected date" : "Discharge requests today", "primary", "list"],
          [isSelected ? "Pending / Delayed" : "Today Pending / Delayed", "Awaiting action or delayed", "warning", "clock"],
          [isSelected ? "Completed" : "Completed Today", "Discharge completed", "success", "check"],
          [isSelected ? "Priority" : "Today Priority", "Delayed, or pending if none delayed", "danger", "alert"],
        ] as const
      ).map(([label, caption, tone, icon], i) => (
        <KpiCard key={label} label={label} value={values[i]} caption={caption} tone={tone} icon={icon} />
      ))}
    </div>
  );
}

export function DelayedDashboardPage({ rows }: { rows: Patient[] }) {
  const states = rows.map((row) => egyptDischargeDelayState(row));
  const values = [
    rows.length.toLocaleString(),
    states
      .filter((state) => state.dischargeType === "early")
      .length.toLocaleString(),
    states
      .filter((state) => state.dischargeType === "planned")
      .length.toLocaleString(),
    states
      .filter((state) => state.isPhysicalDischargeDelayReasonRequired)
      .length.toLocaleString(),
  ];
  return (
    <div className="kpi-grid">
      {(
        [
          ["Clinical Discharge Delays", "Past the clinical threshold", "primary", "clock"],
          ["Early Delays", "Early discharges after 10:00", "info", "clock"],
          ["Planned Delays", "Planned discharges after 16:00", "warning", "calendar"],
          ["Physical Reason Required", "Delay reason now mandatory", "danger", "alert"],
        ] as const
      ).map(([label, caption, tone, icon], index) => (
        <KpiCard key={label} label={label} value={values[index]} caption={caption} tone={tone} icon={icon} />
      ))}
    </div>
  );
}
