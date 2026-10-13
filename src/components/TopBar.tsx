import { useEffect, useRef, useState } from "react";
import { useResource } from "../hooks/useResource";
import { platformService } from "../services/platformService";
import { useScope } from "../scope/ScopeContext";
import { SCOPES } from "../scope/scope";
export function TopBar({
  refresh,
  updated,
  pending,
}: {
  refresh: () => void;
  updated?: Date;
  pending?: number;
}) {
  const { value: scope, setValue: setScope } = useScope();
  const [scopeOpen, setScopeOpen] = useState(false);
  const scopeMenu = useRef<HTMLDivElement>(null);
  const context = useResource(platformService.context);
  const name =
    context.data?.user.fullName ||
    context.data?.user.userPrincipalName ||
    "Current user";
  useEffect(() => {
    if (!scopeOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!scopeMenu.current?.contains(event.target as Node)) setScopeOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setScopeOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [scopeOpen]);
  return (
    <header className="top-context">
      <div className="top-context-left">
        <div className="subtitle">PATIENT DISCHARGE CYCLE</div>
        <div className="brand">Patient Discharge Cycle</div>
      </div>
      <div className="top-context-right">
        <div className="top-context-user-group">
          <button
            className="icon-btn"
            title="Refresh Data"
            aria-label="Refresh Data"
            onClick={refresh}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
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
          </button>
          <div className="user-inline">
            <div className="avatar">
              {name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            <div className="small">{name}</div>
          </div>
        </div>
        <div className="context-title">
          <div className="context-chip context-chip-left scope-switcher" ref={scopeMenu}>
            <span className="context-label">COUNTRY</span>
            <button
              type="button"
              className="scope-trigger"
              aria-haspopup="listbox"
              aria-expanded={scopeOpen}
              onClick={() => setScopeOpen((open) => !open)}
            >
              <span>{scope || "Select country"}</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12">
                <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
            {scopeOpen && (
              <div className="scope-menu" role="listbox" aria-label="Country">
                {SCOPES.map((option) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={option === scope}
                    className={option === scope ? "active" : ""}
                    key={option}
                    onClick={() => {
                      setScope(option);
                      setScopeOpen(false);
                    }}
                  >
                    <span>{option}</span>
                    {option === scope && <span aria-hidden="true">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="context-chip context-chip-center">
            <span className="context-label">UPDATED</span>
            <span className="context-value last-updated">
              {updated && !isNaN(updated.getTime())
                ? updated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
          <div className="context-chip context-chip-right">
            <span className="context-label">ATTENTION</span>
            <span className="context-value">
              {pending === undefined ? "747 pending" : `${pending} pending`}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
