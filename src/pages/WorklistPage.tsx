import { Fragment, useEffect, useRef, useState } from "react";
import {
  type Patient,
  type Filters,
  filterPatients,
} from "../services/dischargeService";
import {
  activityService,
  currentActivity,
  type Activity,
} from "../services/activityService";
import { getPatientDisplayData } from "../presentation/reference";
import { truthy } from "../presentation/format";
import { DashboardPage } from "./DashboardPage";
import { FilterBar } from "../components/FilterBar";
import { StatusBadge } from "../components/StatusBadge";
import { ActivityTimeline } from "../components/ActivityTimeline";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
export const worklistColumns = [
  ["Status", "status"],
  ["Current Step", "currentStep"],
  ["Patient Name", "patientName"],
  ["Home Medications Flag", "homeMedicationsFlag"],
  ["File Scan Status", "fileScanStatus"],
  ["Discharge Type", "dischargeType"],
  ["Cancellation Reason", "cancellationReason"],
  ["Alert Flag", "alertFlag"],
  ["Pending On", "pendingOn"],
  ["Team Name", "businessUnit"],
  ["Patient ID", "patientId"],
  ["Visit ID", "visitId"],
  ["Room", "room"],
  ["Bed", "bed"],
  ["Nurse Station", "nurseStation"],
  ["Last Activity", "lastActivity"],
  ["Physician Name", "physician"],
  ["Admission Doctor", "admissionDoctor"],
  ["Physician Discharge Date", "physicianDischargeDate"],
  ["Admission Date", "admissionDate"],
  ["Floor", "floor"],
  ["Age", "age"],
  ["Payment Type", "paymentType"],
  ["Contract", "contract"],
  ["Contractor", "contractor"],
  ["Specialty", "specialty"],
  ["Has Home Medications", "hasHomeMedications"],
  ["Home Medications Date", "homeMedicationsDate"],
  ["Created Date", "createdDate"],
  ["Physical Discharge TAT", "physicalDischargeTAT"],
  ["SLA Category", "slaCategory"],
] as const;
export const columnWidths: Record<string, string> = {
  status: "130px",
  currentStep: "250px",
  patientName: "220px",
  homeMedicationsFlag: "160px",
  fileScanStatus: "140px",
  dischargeType: "140px",
  cancellationReason: "180px",
  alertFlag: "110px",
  pendingOn: "140px",
  businessUnit: "140px",
  patientId: "130px",
  visitId: "130px",
  room: "100px",
  bed: "100px",
  nurseStation: "160px",
  lastActivity: "160px",
  physician: "200px",
  admissionDoctor: "200px",
  physicianDischargeDate: "180px",
  admissionDate: "160px",
  floor: "120px",
  age: "80px",
  paymentType: "140px",
  contract: "240px",
  contractor: "240px",
  specialty: "200px",
  hasHomeMedications: "160px",
  homeMedicationsDate: "160px",
  createdDate: "160px",
  physicalDischargeTAT: "160px",
  slaCategory: "140px",
};

const PAGE_SIZE = 40;

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "...", total];
  }
  if (current >= total - 3) {
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, "...", current - 1, current, current + 1, "...", total];
}

export function WorklistPage({
  rows,
  loading,
  backgroundLoading,
  statusMessage,
  loaded,
  error,
  refresh,
  open,
  filters,
  setFilters,
}: {
  rows: Patient[];
  loading: boolean;
  backgroundLoading?: boolean;
  statusMessage?: string;
  loaded?: number;
  error: unknown;
  refresh: () => void;
  open: (id: string) => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
}) {
  const visible = filterPatients(rows, filters);
  const [page, setPage] = useState(1);
  const [scrollWidth, setScrollWidth] = useState(4644);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [steps, setSteps] = useState<Record<string, Activity[]>>({});
  const [stepErrors, setStepErrors] = useState<Record<string, unknown>>({});
  const cache = useRef(new Map<string, Promise<Activity[]>>());

  const worklistRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingTop = useRef(false);
  const isSyncingWorklist = useRef(false);

  // Reset to first page when search/filter criteria change
  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.status, filters.dischargeDate]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, visible.length);
  const pagedRows = visible.slice(startIndex, endIndex);

  // Synchronize scroll width of top scrollbar with table content scrollWidth
  useEffect(() => {
    const el = worklistRef.current;
    if (!el) return;
    const updateWidth = () => {
      if (el.scrollWidth) setScrollWidth(el.scrollWidth);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, [pagedRows.length, visible.length]);

  const handleTopScroll = () => {
    if (isSyncingTop.current) {
      isSyncingTop.current = false;
      return;
    }
    if (worklistRef.current && topScrollRef.current) {
      isSyncingWorklist.current = true;
      worklistRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleWorklistScroll = () => {
    if (isSyncingWorklist.current) {
      isSyncingWorklist.current = false;
      return;
    }
    if (topScrollRef.current && worklistRef.current) {
      isSyncingTop.current = true;
      topScrollRef.current.scrollLeft = worklistRef.current.scrollLeft;
    }
  };

  const getSteps = (id: string) => {
    const existing = cache.current.get(id);
    if (existing) return existing;
    const request = activityService.list(id).catch((error) => {
      cache.current.delete(id);
      throw error;
    });
    cache.current.set(id, request);
    return request;
  };

  useEffect(() => {
    let cancelled = false;
    if (loading) return;
    const timers = pagedRows.map((r, i) =>
      setTimeout(
        () => {
          getSteps(r.crad2_patientdischargeid)
            .then((a) => {
              if (!cancelled)
                setSteps((s) => ({ ...s, [r.crad2_patientdischargeid]: a }));
            })
            .catch((e) => console.error("Step enrichment failed", e));
        },
        80 + i * 90,
      ),
    );
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [rows, loading, filters.search, filters.status, filters.dischargeDate, currentPage]);

  async function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    if (!steps[id])
      try {
        const a = await getSteps(id);
        setSteps((s) => ({ ...s, [id]: a }));
      } catch (e) {
        setStepErrors((s) => ({ ...s, [id]: e }));
      }
  }

  return (
    <section className="tab-panel">
      {!loading && !error && (
        <DashboardPage rows={visible} selectedDate={filters.dischargeDate} />
      )}
      <FilterBar
        filters={filters}
        change={setFilters}
        refresh={refresh}
        rows={rows}
      />
      {backgroundLoading && (
        <div style={{ padding: "6px 12px", background: "rgba(30, 107, 72, 0.08)", borderLeft: "3px solid #1e6b48", margin: "8px 0", fontSize: "0.85rem", color: "#1e6b48" }}>
          {statusMessage || "Loading earlier records in background..."}
        </div>
      )}
      {loading ? (
        <LoadingState
          message={
            statusMessage ||
            (loaded
              ? `Loading today's discharges... ${loaded.toLocaleString()} records retrieved.`
              : "Loading today's discharges...")
          }
        />
      ) : error ? (
        <ErrorState error={error} retry={refresh} />
      ) : (
        <>
          {visible.length > 0 && (
            <div
              className="worklist-top-scroll"
              ref={topScrollRef}
              onScroll={handleTopScroll}
              title="Scroll table horizontally"
            >
              <div
                className="worklist-top-scroll-inner"
                style={{ width: `${scrollWidth}px` }}
              />
            </div>
          )}
          <div
            className="worklist"
            ref={worklistRef}
            onScroll={handleWorklistScroll}
          >
            {!visible.length ? (
              <div className="empty-state">No active discharge cases found.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th className="expand-cell" style={{ width: "44px" }} />
                    {worklistColumns.map(([title, key]) => (
                      <th key={title} style={{ width: columnWidths[key], minWidth: columnWidths[key] }}>
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((r) => {
                    const p = getPatientDisplayData(r) as Record<string, string>;
                    const id = r.crad2_patientdischargeid;
                    const current = steps[id] && currentActivity(steps[id]);
                    return (
                      <Fragment key={id}>
                        <tr
                          className={truthy(p.delayed) ? "delayed" : ""}
                          onClick={() => open(id)}
                        >
                          <td className="expand-cell">
                            <button
                              className="expand-btn"
                              aria-label={
                                expanded.has(id)
                                  ? "Hide discharge steps"
                                  : "Show discharge steps"
                              }
                              aria-expanded={expanded.has(id)}
                              onClick={(e) => {
                                e.stopPropagation();
                                void toggle(id);
                              }}
                            >
                              {expanded.has(id) ? "⌄" : "›"}
                            </button>
                          </td>
                          {worklistColumns.map(([, key]) => {
                            const val =
                              key === "status"
                                ? p.status
                                : key === "patientName"
                                  ? p.patientName
                                  : key === "currentStep"
                                    ? current?.crad2_subject || p.currentStep || "-"
                                    : p[key] || "-";
                            return (
                              <td
                                key={key}
                                style={{
                                  width: columnWidths[key],
                                  minWidth: columnWidths[key],
                                  maxWidth: columnWidths[key],
                                }}
                                className={
                                  key === "patientName" ? "patient-cell" : "small"
                                }
                                title={val !== "-" ? String(val) : undefined}
                              >
                                {key === "status" ? (
                                  <StatusBadge label={p.status} />
                                ) : key === "patientName" ? (
                                  <button
                                    className="patient-link name"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      open(id);
                                    }}
                                  >
                                    {p.patientName || "-"}
                                  </button>
                                ) : (
                                  val
                                )}
                              </td>
                            );
                          })}
                        </tr>
                        {expanded.has(id) && (
                          <tr className="steps-row">
                            <td colSpan={32}>
                              {stepErrors[id] ? (
                                <ErrorState error={stepErrors[id]} />
                              ) : steps[id] ? (
                                <ActivityTimeline
                                  activities={steps[id]}
                                  compact
                                />
                              ) : (
                                <LoadingState message="Loading steps..." />
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {visible.length > 0 && (
            <div className="pagination-bar">
              <div className="pagination-info">
                Showing {startIndex + 1}–{endIndex} of {visible.length} records
                <span className="pagination-badge">40 per page</span>
              </div>
              <div className="pagination-controls">
                <button
                  className="page-btn nav-btn"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(1)}
                  title="First Page"
                >
                  « First
                </button>
                <button
                  className="page-btn nav-btn"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  title="Previous Page"
                >
                  ‹ Previous
                </button>

                <div className="page-numbers">
                  {getPageNumbers(currentPage, totalPages).map((p, idx) =>
                    p === "..." ? (
                      <span key={`ellipsis-${idx}`} className="page-ellipsis">
                        ...
                      </span>
                    ) : (
                      <button
                        key={p}
                        className={`page-btn num-btn ${currentPage === p ? "active" : ""}`}
                        onClick={() => setPage(Number(p))}
                      >
                        {p}
                      </button>
                    )
                  )}
                </div>

                <button
                  className="page-btn nav-btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  title="Next Page"
                >
                  Next ›
                </button>
                <button
                  className="page-btn nav-btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(totalPages)}
                  title="Last Page"
                >
                  Last »
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

