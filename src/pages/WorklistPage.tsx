import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  type Patient,
  type Filters,
  type DischargeView,
  dischargeService,
  filterPatients,
  sortDelayedPatients,
} from "../services/dischargeService";
import {
  activityService,
  activitySequence,
  type Activity,
} from "../services/activityService";
import { getPatientDisplayData } from "../presentation/reference";
import {
  displayDateTime,
  formatDuration,
  truthy,
} from "../presentation/format";
import { DashboardPage, DelayedDashboardPage } from "./DashboardPage";
import { FilterBar } from "../components/FilterBar";
import { StatusBadge } from "../components/StatusBadge";
import { ActivityTimeline } from "../components/ActivityTimeline";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { egyptBusinessUnitFromEntityId, recordsForScope } from "../scope/scope";
import { useScope } from "../scope/ScopeContext";
import { ColumnHeaderMenu } from "../components/ColumnHeaderMenu";
import {
  applyColumnFiltersLocally,
  applyManualColumnSort,
  buildColumnFiltersOData,
  columnControlDefinitions,
  type ColumnFilter,
  type ColumnSort,
} from "../services/columnControls";
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
export const delayedWorklistColumns = [
  ["Status", "status"],
  ["Current Step", "currentStep"],
  ["Patient Name", "patientName"],
  ["Patient ID", "patientId"],
  ["Visit ID", "visitId"],
  ["Business Unit", "egyptBusinessUnit"],
  ["Unit / Nurse Station", "nurseStation"],
  ["Discharge Type", "dischargeType"],
  ["Physician Discharge", "physicianDischargeDate"],
  ["Current Discharge TAT", "currentDischargeTAT"],
  ["Longest Step", "longestStep"],
  ["Longest Step Duration", "longestStepDuration"],
  ["Physician Name", "physician"],
  ["Last Activity", "lastActivity"],
  ["File Scan Status", "fileScanStatus"],
  ["Home Medications Flag", "homeMedicationsFlag"],
  ["Admission Date", "admissionDate"],
  ["Floor", "floor"],
  ["Room", "room"],
  ["Bed", "bed"],
  ["Cancellation Reason", "cancellationReason"],
  ["Alert Flag", "alertFlag"],
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
  egyptBusinessUnit: "130px",
  currentDischargeTAT: "175px",
  longestStep: "220px",
  longestStepDuration: "175px",
};

const PAGE_SIZE = 15;

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
  view,
  dataRevision,
  setView,
  canViewDelayed,
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
  view: DischargeView;
  dataRevision: number;
  setView: (view: DischargeView) => void;
  canViewDelayed: boolean;
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
  const { value: scope } = useScope();
  const columns = view === "delayed" ? delayedWorklistColumns : worklistColumns;
  const [columnFiltersByView, setColumnFiltersByView] = useState<
    Record<DischargeView, Record<string, ColumnFilter>>
  >({ all: {}, delayed: {} });
  const [manualSortByView, setManualSortByView] = useState<
    Record<DischargeView, ColumnSort | null>
  >({ all: null, delayed: null });
  const [openColumnMenu, setOpenColumnMenu] = useState<string | null>(null);
  const [columnQueryRows, setColumnQueryRows] = useState<Patient[]>();
  const [columnQueryLoading, setColumnQueryLoading] = useState(false);
  const [columnQueryError, setColumnQueryError] = useState<unknown>(null);
  const [columnQueryRevision, setColumnQueryRevision] = useState(0);
  const columnScopeRef = useRef(scope);
  const columnFilters = columnFiltersByView[view];
  const manualSort = manualSortByView[view];
  const columnFilterOData = useMemo(
    () => buildColumnFiltersOData(columnFilters),
    [columnFilters],
  );

  useEffect(() => {
    if (columnScopeRef.current === scope) return;
    columnScopeRef.current = scope;
    setColumnFiltersByView({ all: {}, delayed: {} });
    setManualSortByView({ all: null, delayed: null });
    setOpenColumnMenu(null);
  }, [scope]);

  useEffect(() => {
    setOpenColumnMenu(null);
    setColumnQueryRows(undefined);
    setColumnQueryError(null);
    if (!columnFilterOData || !scope) {
      setColumnQueryLoading(false);
      return;
    }
    const controller = new AbortController();
    setColumnQueryLoading(true);
    dischargeService
      .listForColumnFilters(view, columnFilterOData, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted)
          setColumnQueryRows(recordsForScope(result, scope));
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          console.error("Column filter query failed", reason);
          setColumnQueryError(reason);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setColumnQueryLoading(false);
      });
    return () => controller.abort();
  }, [columnFilterOData, scope, view, columnQueryRevision, dataRevision]);

  const cachedColumnRows = useMemo(
    () => applyColumnFiltersLocally(rows, columnFilters),
    [rows, columnFilters],
  );
  const sourceRows = columnFilterOData
    ? (columnQueryRows ?? cachedColumnRows)
    : rows;
  const filteredRows = filterPatients(sourceRows, filters);
  const defaultVisible =
    view === "delayed" ? sortDelayedPatients(filteredRows) : filteredRows;
  const visible = applyManualColumnSort(defaultVisible, manualSort);
  const displayLoading = loading;
  const displayError = error;
  const [page, setPage] = useState(1);
  const [scrollWidth, setScrollWidth] = useState(4644);
  const [worklistViewportWidth, setWorklistViewportWidth] = useState(0);

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
  }, [
    filters.search,
    filters.status,
    filters.dischargeDate,
    filters.businessUnit,
    filters.unit,
    filters.dischargeType,
    filters.dateFrom,
    filters.dateTo,
    columnFilters,
    manualSort,
    view,
  ]);

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
      if (el.clientWidth) setWorklistViewportWidth(el.clientWidth);
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
      worklistRef.current.style.setProperty(
        "--worklist-scroll-left",
        `${topScrollRef.current.scrollLeft}px`,
      );
    }
  };

  const handleWorklistScroll = () => {
    if (worklistRef.current) {
      worklistRef.current.style.setProperty(
        "--worklist-scroll-left",
        `${worklistRef.current.scrollLeft}px`,
      );
    }
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
    if (displayLoading) return;
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
  }, [
    rows,
    columnQueryRows,
    displayLoading,
    filters.search,
    filters.status,
    filters.dischargeDate,
    filters.businessUnit,
    filters.unit,
    filters.dischargeType,
    filters.dateFrom,
    filters.dateTo,
    view,
    currentPage,
  ]);

  function cellValue(
    row: Patient,
    display: Record<string, string>,
    current: Activity | undefined,
    key: string,
    activitiesLoaded = true,
    waitingForHomeMedications = false,
  ) {
    if (key === "currentStep") {
      if (!activitiesLoaded) return "Loading...";
      if (waitingForHomeMedications)
        return "Home Medications Preparation - Loading...";
      return current?.crad2_subject || display.currentStep || "-";
    }
    if (key === "egyptBusinessUnit")
      return egyptBusinessUnitFromEntityId(row.new_entityid) || "-";
    if (key === "currentDischargeTAT")
      return formatDuration(row.cr301_currentdischargetat);
    if (key === "longestStepDuration")
      return formatDuration(row.cr301_longeststepduration);
    if (view === "delayed" && key === "physicianDischargeDate")
      return (
        displayDateTime(row, "and_physiciandischargedate", "") ||
        display.physicianDischargeDate ||
        "-"
      );
    return display[key] || "-";
  }

  function delayClass(minutes: unknown) {
    const value = Number(minutes);
    if (value > 480) return "delay-duration critical";
    if (value > 240) return "delay-duration significant";
    return "delay-duration delayed";
  }

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

  function applyColumnFilter(key: string, filter: ColumnFilter) {
    setColumnFiltersByView((current) => ({
      ...current,
      [view]: { ...current[view], [key]: filter },
    }));
    setOpenColumnMenu(null);
  }

  function clearColumnFilter(key: string) {
    setColumnFiltersByView((current) => {
      const next = { ...current[view] };
      delete next[key];
      return { ...current, [view]: next };
    });
    setOpenColumnMenu(null);
  }

  function setColumnSort(key: string, direction: "asc" | "desc" | null) {
    setManualSortByView((current) => ({
      ...current,
      [view]: direction ? { key, direction } : null,
    }));
    setOpenColumnMenu(null);
  }

  function refreshView() {
    refresh();
    if (columnFilterOData) setColumnQueryRevision((value) => value + 1);
  }

  return (
    <section className="tab-panel">
      {canViewDelayed && (
        <div
          className="worklist-view-switch"
          aria-label="Patient discharge view"
        >
          <button
            type="button"
            className={view === "all" ? "active" : ""}
            aria-pressed={view === "all"}
            onClick={() => setView("all")}
          >
            Patient Discharges
          </button>
          <button
            type="button"
            className={view === "delayed" ? "active" : ""}
            aria-pressed={view === "delayed"}
            onClick={() => setView("delayed")}
          >
            Delayed Cases
          </button>
        </div>
      )}
      {!displayLoading &&
        !displayError &&
        (view === "delayed" ? (
          <DelayedDashboardPage rows={visible} />
        ) : (
          <DashboardPage rows={visible} selectedDate={filters.dischargeDate} />
        ))}
      <FilterBar
        filters={filters}
        change={setFilters}
        refresh={refreshView}
        rows={rows}
        view={view}
      />
      {backgroundLoading && (
        <div
          style={{
            padding: "6px 12px",
            background: "rgba(30, 107, 72, 0.08)",
            borderLeft: "3px solid #1e6b48",
            margin: "8px 0",
            fontSize: "0.85rem",
            color: "#1e6b48",
          }}
        >
          {statusMessage || "Loading earlier records in background..."}
        </div>
      )}
      {columnFilterOData && columnQueryLoading && (
        <div className="column-query-status" role="status">
          Showing matches from loaded records while all Dataverse records are
          checked...
        </div>
      )}
      {columnFilterOData &&
        Boolean(columnQueryError) &&
        !columnQueryLoading && (
          <div className="column-query-status column-query-error" role="alert">
            <span>
              Could not check all Dataverse records. Showing loaded matches.
            </span>
            <button
              type="button"
              onClick={() => setColumnQueryRevision((value) => value + 1)}
            >
              Retry
            </button>
          </div>
        )}
      {displayLoading ? (
        <LoadingState
          message={
            statusMessage ||
            (view === "delayed"
              ? "Loading delayed discharge cases..."
              : loaded
                ? `Loading today's discharges... ${loaded.toLocaleString()} records retrieved.`
                : "Loading today's discharges...")
          }
        />
      ) : displayError ? (
        <ErrorState error={displayError} retry={refreshView} />
      ) : (
        <>
          <div className="worklist-desktop-view">
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
              {!visible.length && !Object.keys(columnFilters).length ? (
                <div className="empty-state">
                  {view === "delayed"
                    ? "No delayed discharge cases found."
                    : "No active discharge cases found."}
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th className="expand-cell" style={{ width: "44px" }} />
                      {columns.map(([title, key]) => {
                        const definition = columnControlDefinitions[key];
                        return (
                          <th
                            key={title}
                            style={{
                              width: columnWidths[key],
                              minWidth: columnWidths[key],
                            }}
                          >
                            {definition ? (
                              <ColumnHeaderMenu
                                definition={definition}
                                filter={columnFilters[key]}
                                sort={manualSort}
                                open={openColumnMenu === key}
                                onToggle={() =>
                                  setOpenColumnMenu((current) =>
                                    current === key ? null : key,
                                  )
                                }
                                onApplyFilter={(filter) =>
                                  applyColumnFilter(key, filter)
                                }
                                onClearFilter={() => clearColumnFilter(key)}
                                onSort={(direction) =>
                                  setColumnSort(key, direction)
                                }
                              />
                            ) : (
                              title
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {!pagedRows.length && (
                      <tr>
                        <td colSpan={columns.length + 1}>
                          <div className="empty-state">
                            No records match the active column filters.
                          </div>
                        </td>
                      </tr>
                    )}
                    {pagedRows.map((r) => {
                      const p = getPatientDisplayData(r) as Record<
                        string,
                        string
                      >;
                      const id = r.crad2_patientdischargeid;
                      const activityState = steps[id]
                        ? activitySequence(
                            steps[id],
                            false,
                            Boolean(
                              egyptBusinessUnitFromEntityId(r.new_entityid),
                            ),
                          )
                        : undefined;
                      const current = activityState?.current;
                      return (
                        <Fragment key={id}>
                          <tr
                            className={
                              view === "delayed" || truthy(p.delayed)
                                ? "delayed"
                                : ""
                            }
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
                            {columns.map(([, key]) => {
                              const val = cellValue(
                                r,
                                p,
                                current,
                                key,
                                Boolean(steps[id]),
                                activityState?.waitingForHomeMedications,
                              );
                              return (
                                <td
                                  key={key}
                                  style={{
                                    width: columnWidths[key],
                                    minWidth: columnWidths[key],
                                    maxWidth: columnWidths[key],
                                  }}
                                  className={`${
                                    key === "patientName"
                                      ? "patient-cell"
                                      : "small"
                                  }${
                                    key === "currentDischargeTAT"
                                      ? ` ${delayClass(r.cr301_currentdischargetat)}`
                                      : ""
                                  }`}
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
                              <td colSpan={columns.length + 1}>
                                <div
                                  className="steps-sticky-panel"
                                  style={
                                    worklistViewportWidth
                                      ? {
                                          width: `${worklistViewportWidth - 2}px`,
                                        }
                                      : undefined
                                  }
                                >
                                  {stepErrors[id] ? (
                                    <ErrorState error={stepErrors[id]} />
                                  ) : steps[id] ? (
                                    <ActivityTimeline
                                      activities={steps[id]}
                                      compact
                                      onOpen={() => open(id)}
                                    />
                                  ) : (
                                    <LoadingState message="Loading steps..." />
                                  )}
                                </div>
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
          </div>

          {/* Mobile Patient Cards View (Visible on <= 768px screens) */}
          <div className="worklist-mobile-cards">
            {!visible.length ? (
              <div className="empty-state">
                {view === "delayed"
                  ? "No delayed discharge cases found."
                  : "No active discharge cases found."}
              </div>
            ) : (
              pagedRows.map((r) => {
                const p = getPatientDisplayData(r) as Record<string, string>;
                const id = r.crad2_patientdischargeid;
                const activityState = steps[id]
                  ? activitySequence(
                      steps[id],
                      false,
                      Boolean(egyptBusinessUnitFromEntityId(r.new_entityid)),
                    )
                  : undefined;
                const current = activityState?.current;
                const isExpanded = expanded.has(id);
                const physicianDischargeDate = cellValue(
                  r,
                  p,
                  current,
                  "physicianDischargeDate",
                );
                const currentStep = cellValue(
                  r,
                  p,
                  current,
                  "currentStep",
                  Boolean(steps[id]),
                  activityState?.waitingForHomeMedications,
                );
                return (
                  <div
                    key={id}
                    className={`mobile-patient-card ${
                      view === "delayed" || truthy(p.delayed) ? "delayed" : ""
                    }`}
                    onClick={() => open(id)}
                  >
                    <div className="mobile-card-header">
                      <div className="mobile-patient-info">
                        <h3 className="mobile-patient-name">
                          {p.patientName || "Unknown Patient"}
                        </h3>
                        <div className="mobile-patient-meta">
                          {p.patientId && (
                            <span className="mobile-meta-tag">
                              MRN: <strong>{p.patientId}</strong>
                            </span>
                          )}
                          {p.visitId && (
                            <span className="mobile-meta-tag">
                              Visit: <strong>{p.visitId}</strong>
                            </span>
                          )}
                          {p.room && (
                            <span className="mobile-meta-tag">
                              Rm: <strong>{p.room}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                      <StatusBadge label={p.status} />
                    </div>

                    <div className="mobile-card-body">
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Current Step:</span>
                        <span className="mobile-card-value font-medium">
                          {currentStep}
                        </span>
                      </div>
                      {view === "delayed" && (
                        <>
                          <div className="mobile-card-row">
                            <span className="mobile-card-label">
                              Current TAT:
                            </span>
                            <span
                              className={`mobile-card-value ${delayClass(
                                r.cr301_currentdischargetat,
                              )}`}
                            >
                              {formatDuration(r.cr301_currentdischargetat)}
                            </span>
                          </div>
                          <div className="mobile-card-row">
                            <span className="mobile-card-label">
                              Longest Step:
                            </span>
                            <span className="mobile-card-value">
                              {r.cr301_longeststep || "-"}
                            </span>
                          </div>
                          <div className="mobile-card-row">
                            <span className="mobile-card-label">
                              Step Duration:
                            </span>
                            <span className="mobile-card-value">
                              {formatDuration(r.cr301_longeststepduration)}
                            </span>
                          </div>
                        </>
                      )}
                      {p.physician && (
                        <div className="mobile-card-row">
                          <span className="mobile-card-label">Physician:</span>
                          <span className="mobile-card-value">
                            {p.physician}
                          </span>
                        </div>
                      )}
                      {physicianDischargeDate !== "-" && (
                        <div className="mobile-card-row">
                          <span className="mobile-card-label">
                            Discharge Date:
                          </span>
                          <span className="mobile-card-value">
                            {physicianDischargeDate}
                          </span>
                        </div>
                      )}
                      {p.dischargeType && (
                        <div className="mobile-card-row">
                          <span className="mobile-card-label">Type:</span>
                          <span className="mobile-card-value">
                            {p.dischargeType}
                          </span>
                        </div>
                      )}
                    </div>

                    <div
                      className="mobile-card-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="btn-mobile-details"
                        onClick={() => open(id)}
                      >
                        Open Full Record →
                      </button>
                      <button
                        type="button"
                        className="btn-mobile-steps"
                        onClick={() => void toggle(id)}
                      >
                        <span>
                          {isExpanded ? "Hide Steps" : "Timeline Steps"}
                        </span>
                        <span className="step-icon">
                          {isExpanded ? "▲" : "▼"}
                        </span>
                      </button>
                    </div>

                    {isExpanded && (
                      <div
                        className="mobile-card-expanded"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {stepErrors[id] ? (
                          <ErrorState error={stepErrors[id]} />
                        ) : steps[id] ? (
                          <ActivityTimeline
                            activities={steps[id]}
                            compact
                            onOpen={() => open(id)}
                          />
                        ) : (
                          <LoadingState message="Loading steps..." />
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {visible.length > 0 && (
            <div className="pagination-bar">
              <div className="pagination-info">
                Showing {startIndex + 1}–{endIndex} of {visible.length} records
                <span className="pagination-badge">15 per page</span>
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
                    ),
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
