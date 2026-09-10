import { useEffect, useRef, useState } from "react";
import type { LookupOption } from "../services/activityService";
export function LookupInput({
  label,
  search,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  search: (q: string) => Promise<LookupOption[]>;
  value?: LookupOption;
  onChange: (v?: LookupOption) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(value?.name || "");
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<LookupOption[]>([]);
  const [state, setState] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    if (!open || disabled) return;
    setState("Searching...");
    const t = setTimeout(
      () =>
        search(query)
          .then((r) => {
            if (active) {
              setRows(r);
              setState(r.length ? "" : "No matching records");
            }
          })
          .catch((e) => {
            console.error("Lookup failed", e);
            if (active) setState("Unable to search. Please try again.");
          }),
      350,
    );
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, open, disabled, search]);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return (
    <div className="lookup-wrap" ref={wrap}>
      <input
        aria-label={label}
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        value={query}
        placeholder={label}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(undefined);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      />
      {open && !disabled && (
        <div className="lookup-results" role="listbox">
          {state ? (
            <div className="lookup-state">{state}</div>
          ) : (
            rows.map((r) => (
              <button
                type="button"
                className="lookup-result"
                role="option"
                aria-selected={r.id === value?.id}
                key={r.id}
                onClick={() => {
                  onChange(r);
                  setQuery(r.name);
                  setOpen(false);
                }}
              >
                <span className="lookup-result-icon">+</span>
                <span className="lookup-result-label">{r.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
