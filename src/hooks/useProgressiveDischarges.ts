import { useEffect, useRef, useState, useCallback } from "react";
import {
  dischargeService,
  mergeAndSortPatients,
  getLocalDateRangeISO,
  type Patient,
  type Filters,
} from "../services/dischargeService";
import { recordsForScope, type Scope } from "../scope/scope";

export interface ProgressiveDischargesResult {
  rows: Patient[];
  initialTodayLoading: boolean;
  backgroundHistoryLoading: boolean;
  statusMessage: string;
  error: unknown;
  refresh: () => void;
}

export function useProgressiveDischarges(
  filters: Filters,
  scope: Scope | null,
): ProgressiveDischargesResult {
  const [rows, setRows] = useState<Patient[]>([]);
  const [initialTodayLoading, setInitialTodayLoading] = useState(true);
  const [backgroundHistoryLoading, setBackgroundHistoryLoading] =
    useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "Loading today's discharges...",
  );
  const [error, setError] = useState<unknown>(null);

  const activeControllerRef = useRef<AbortController | null>(null);
  const currentSearchRef = useRef<string>("");
  const currentDateFilterRef = useRef<string>("");

  const loadData = useCallback(
    (preserveRows = false) => {
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
      }
      const controller = new AbortController();
      activeControllerRef.current = controller;
      const signal = controller.signal;
      currentSearchRef.current = "";
      currentDateFilterRef.current = "";

      if (!scope) {
        setRows([]);
        setInitialTodayLoading(false);
        setBackgroundHistoryLoading(false);
        setStatusMessage("");
        return;
      }

      if (preserveRows) {
        setInitialTodayLoading(false);
        setBackgroundHistoryLoading(true);
        setStatusMessage("Refreshing discharges in the background...");
      } else {
        setRows([]);
        setInitialTodayLoading(true);
        setBackgroundHistoryLoading(false);
        setStatusMessage("Loading today's discharges...");
      }
      setError(null);

      (async () => {
        try {
          // Step 1: Fetch Today's records directly from Dataverse
          const todayRows = recordsForScope(
            await dischargeService.listToday(signal),
            scope,
          );
          if (signal.aborted) return;

          setRows((prev) => mergeAndSortPatients(prev, todayRows));
          if (!preserveRows) setInitialTodayLoading(false);
          const countToday = todayRows.length;
          setStatusMessage(
            preserveRows
              ? "Refreshing earlier discharges in the background..."
              : `${countToday} discharges today`,
          );

          // Step 2: Progressively load history (Yesterday, Day 2..Day 7, then older)
          setBackgroundHistoryLoading(true);
          if (!preserveRows)
            setStatusMessage(
              `${countToday} discharges today • Loading earlier records in background...`,
            );

          let cumulativeRows = todayRows;
          let refreshComplete = true;

          // Load Days 1 through 7 progressively
          for (let daysAgo = 1; daysAgo <= 7; daysAgo++) {
            if (signal.aborted) return;
            try {
              const dayRows = recordsForScope(
                await dischargeService.listForDay(daysAgo, signal),
                scope,
              );
              if (signal.aborted) return;
              if (dayRows.length > 0) {
                cumulativeRows = mergeAndSortPatients(cumulativeRows, dayRows);
                setRows((previous) =>
                  preserveRows
                    ? mergeAndSortPatients(previous, dayRows)
                    : cumulativeRows,
                );
              }
            } catch (dayError) {
              // Ignore single day cancellation or transient error during progressive history stream
              if (signal.aborted) return;
              refreshComplete = false;
            }
          }

          // Load remaining historical records older than 7 days ago
          if (!signal.aborted) {
            const { startISO: day7StartISO } = getLocalDateRangeISO(7);
            try {
              const olderRows = recordsForScope(
                await dischargeService.listOlderThan(day7StartISO, signal),
                scope,
              );
              if (signal.aborted) return;
              if (olderRows.length > 0) {
                cumulativeRows = mergeAndSortPatients(
                  cumulativeRows,
                  olderRows,
                );
                setRows((previous) =>
                  preserveRows
                    ? mergeAndSortPatients(previous, olderRows)
                    : cumulativeRows,
                );
              }
            } catch (olderError) {
              if (signal.aborted) return;
              refreshComplete = false;
            }
          }

          if (!signal.aborted) {
            if (preserveRows && refreshComplete) setRows(cumulativeRows);
            setBackgroundHistoryLoading(false);
            setStatusMessage("");
          }
        } catch (err) {
          if (!signal.aborted) {
            console.error("Failed loading patient discharges", err);
            if (!preserveRows) setError(err);
            setInitialTodayLoading(false);
            setBackgroundHistoryLoading(false);
            setStatusMessage("");
          }
        }
      })();
    },
    [scope],
  );

  // Initial load on mount
  useEffect(() => {
    loadData();
    return () => {
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
      }
    };
  }, [loadData]);

  // Server-side Date Filter query trigger
  useEffect(() => {
    const selectedDate = filters.dischargeDate;
    if (
      scope &&
      selectedDate &&
      selectedDate !== currentDateFilterRef.current
    ) {
      currentDateFilterRef.current = selectedDate;
      const controller = new AbortController();
      dischargeService
        .listForDateStr(selectedDate, controller.signal)
        .then((dateRows) => {
          dateRows = recordsForScope(dateRows, scope);
          if (dateRows.length > 0) {
            setRows((prev) => mergeAndSortPatients(prev, dateRows));
          }
        })
        .catch((e) => console.error("Server date query failed", e));
      return () => controller.abort();
    }
  }, [filters.dischargeDate, scope]);

  // Server-side Search query trigger for terms not in client dataset
  useEffect(() => {
    const term = filters.search.trim();
    if (scope && term.length >= 2 && term !== currentSearchRef.current) {
      currentSearchRef.current = term;
      const timer = setTimeout(() => {
        const controller = new AbortController();
        dischargeService
          .searchServer(term, controller.signal)
          .then((searchRows) => {
            searchRows = recordsForScope(searchRows, scope);
            if (searchRows.length > 0) {
              setRows((prev) => mergeAndSortPatients(prev, searchRows));
            }
          })
          .catch((e) => console.error("Server search query failed", e));
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [filters.search, scope]);

  const refresh = useCallback(() => {
    loadData(true);
  }, [loadData]);

  return {
    rows,
    initialTodayLoading,
    backgroundHistoryLoading,
    statusMessage,
    error,
    refresh,
  };
}
