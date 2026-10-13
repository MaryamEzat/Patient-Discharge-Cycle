import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isScope, SCOPES, SCOPE_STORAGE_KEY, type Scope } from "./scope";

type ScopeContextValue = {
  value: Scope | null;
  setValue: (value: Scope) => void;
};

const ScopeContext = createContext<ScopeContextValue | undefined>(undefined);

function readStoredScope(): Scope | null {
  try {
    const stored = localStorage.getItem(SCOPE_STORAGE_KEY);
    return isScope(stored) ? stored : null;
  } catch (error) {
    console.warn("Unable to read the saved country scope; using memory only.", error);
    return null;
  }
}

export function ScopeProvider({ children }: { children: ReactNode }) {
  const [value, setState] = useState<Scope | null>(readStoredScope);
  const setValue = useCallback((next: Scope) => {
    setState(next);
    try {
      localStorage.setItem(SCOPE_STORAGE_KEY, next);
    } catch (error) {
      console.warn("Unable to save the country scope; using memory only.", error);
    }
  }, []);

  useEffect(() => {
    if (value !== null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [value]);

  const contextValue = useMemo(() => ({ value, setValue }), [value, setValue]);
  return (
    <ScopeContext.Provider value={contextValue}>
      {children}
      {value === null && (
        <div className="scope-modal-backdrop">
          <section
            className="scope-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scope-modal-title"
          >
            <div className="scope-modal-eyebrow">PATIENT DISCHARGE</div>
            <h1 id="scope-modal-title">Select your country</h1>
            <p>This selection sets the default data across the application.</p>
            <div className="scope-modal-options">
              {SCOPES.map((scope) => (
                <button key={scope} type="button" onClick={() => setValue(scope)}>
                  {scope}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </ScopeContext.Provider>
  );
}

export function useScope() {
  const context = useContext(ScopeContext);
  if (!context) throw new Error("useScope must be used inside ScopeProvider.");
  return context;
}
