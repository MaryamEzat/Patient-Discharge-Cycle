import { useEffect, useRef, type ReactNode } from "react";
export function Modal({
  title,
  children,
  close,
  side = false,
}: {
  title: string;
  children: ReactNode;
  close?: () => void;
  side?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeRef.current) closeRef.current();
      if (e.key === "Tab") {
        const focusable = panel.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],textarea,input,select,[tabindex="0"]',
        );
        if (!focusable?.length) {
          e.preventDefault();
          return;
        }
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === panel.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      old?.focus();
    };
  }, []);

  return (
    <>
      <div className="modal-backdrop" />
      <div
        ref={panel}
        className={side ? "quick-create-modal" : "modal"}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div>
          <div className="activity-head">
            <div className="activity-title">{title}</div>
            {close && (
              <button type="button" aria-label="Close" onClick={() => closeRef.current?.()}>
                ×
              </button>
            )}
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

