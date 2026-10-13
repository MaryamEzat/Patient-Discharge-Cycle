import { useCallback, useEffect, useRef, useState } from "react";
import { dischargeService, type Patient } from "../services/dischargeService";

export interface DelayedDischargesResult {
  rows: Patient[];
  loading: boolean;
  refreshing: boolean;
  statusMessage: string;
  error: unknown;
  refresh: () => void;
}

export function useDelayedDischarges(
  enabled: boolean,
  cacheKey: string | null,
): DelayedDischargesResult {
  const [rows, setRows] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<unknown>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const loadedCacheKeyRef = useRef<string | null>(null);
  const hasRowsRef = useRef(false);

  const load = useCallback(
    (force = false) => {
      if (!enabled) return;
      if (!force && loadedCacheKeyRef.current === cacheKey) return;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const preserveRows = force && hasRowsRef.current;
      setLoading(!preserveRows);
      setRefreshing(preserveRows);
      setError(null);
      setStatusMessage("Loading delayed discharge cases...");
      dischargeService
        .listDelayedEgypt(controller.signal, (loaded) =>
          setStatusMessage(
            `Loading delayed discharge cases... ${loaded.toLocaleString()} records retrieved.`,
          ),
        )
        .then((result) => {
          if (!controller.signal.aborted) {
            setRows(result);
            hasRowsRef.current = true;
            loadedCacheKeyRef.current = cacheKey;
          }
        })
        .catch((reason) => {
          if (!controller.signal.aborted) {
            console.error("Failed loading delayed discharge cases", reason);
            if (!preserveRows) setError(reason);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
            setRefreshing(false);
            setStatusMessage("");
          }
        });
    },
    [cacheKey, enabled],
  );

  useEffect(() => {
    load(false);
    return () => controllerRef.current?.abort();
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { rows, loading, refreshing, statusMessage, error, refresh };
}
