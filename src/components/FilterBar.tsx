import type { Filters, Patient } from "../services/dischargeService";
import { choiceOptions, tables } from "../config/schema";
import { useEffect, useState } from "react";
export function FilterBar({
  filters,
  change,
  refresh,
  rows,
}: {
  filters: Filters;
  change: (f: Filters) => void;
  refresh: () => void;
  rows: Patient[];
}) {
  const [search, setSearch] = useState(filters.search);
  useEffect(() => {
    if (search === filters.search) return;
    const timer = setTimeout(() => change({ ...filters, search }), 400);
    return () => clearTimeout(timer);
  }, [search, filters, change]);
  return (
    <div className="toolbar">
      <input
        aria-label="Search patients"
        placeholder="Search by Patient Name / MRN / Visit ID / Phone"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select
        aria-label="Status"
        value={filters.status}
        onChange={(e) => change({ ...filters, status: e.target.value })}
      >
        <option value="">All Statuses</option>
        {Object.entries(choiceOptions(tables.patient, "crad2_status"))
          .filter(([v]) => rows.some((r) => String(r.crad2_status) === v))
          .map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
      </select>
      <input
        type="date"
        aria-label="Filter by Discharge Date"
        value={filters.dischargeDate}
        onChange={(e) => change({ ...filters, dischargeDate: e.target.value })}
      />
      <button onClick={() => change({ ...filters, dischargeDate: "" })}>
        Clear Date
      </button>
      <button id="refreshWorklist" onClick={refresh}>
        Refresh
      </button>
    </div>
  );
}
