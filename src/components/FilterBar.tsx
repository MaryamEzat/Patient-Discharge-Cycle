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
    <div className="filter-card">
      <div className="filter-search-box">
        <svg
          className="search-icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          aria-label="Search patients"
          className="search-input"
          placeholder="Search by Patient Name, MRN, Visit ID, or Phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            type="button"
            className="clear-search-btn"
            title="Clear search"
            onClick={() => {
              setSearch("");
              change({ ...filters, search: "" });
            }}
          >
            ✕
          </button>
        )}
      </div>

      <div className="filter-controls-group">
        <div className="select-wrapper">
          <svg
            className="filter-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <select
            aria-label="Status"
            className="modern-select"
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
        </div>

        <div className="date-input-group">
          <input
            type="date"
            aria-label="Filter by Discharge Date"
            className="modern-date-input"
            value={filters.dischargeDate}
            onChange={(e) => change({ ...filters, dischargeDate: e.target.value })}
          />
          {filters.dischargeDate && (
            <button
              type="button"
              className="btn-clear-date"
              title="Clear Date"
              onClick={() => change({ ...filters, dischargeDate: "" })}
            >
              Clear Date
            </button>
          )}
        </div>

        <button
          type="button"
          id="refreshWorklist"
          className="btn-refresh-worklist"
          onClick={refresh}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>
    </div>
  );
}
