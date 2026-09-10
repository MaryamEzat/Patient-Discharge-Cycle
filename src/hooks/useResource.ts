import { useEffect, useRef, useState } from "react";
export function useResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  dependencies: unknown[] = [],
) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const sequence = useRef(0);
  useEffect(() => {
    const n = ++sequence.current;
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    loader(controller.signal)
      .then((value) => {
        if (sequence.current === n) setData(value);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        console.error("Resource load failed", e);
        if (sequence.current === n) setError(e);
      })
      .finally(() => {
        if (sequence.current === n) setLoading(false);
      });
    return () => {
      sequence.current++;
      controller.abort();
    };
  }, [...dependencies, version]);
  return {
    data,
    setData,
    error,
    loading,
    refresh: () => setVersion((v) => v + 1),
  };
}
