import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const parse = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : undefined;
};

export function ResponsiveDatePicker({
  value,
  onChange,
  label,
  iconOnly = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  iconOnly?: boolean;
}) {
  const selected = parse(value);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => selected || new Date());
  const [position, setPosition] = useState<CSSProperties>({});

  useEffect(() => {
    if (selected) setMonth(selected);
  }, [value]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const offsetLeft = viewport?.offsetLeft ?? 0;
      const offsetTop = viewport?.offsetTop ?? 0;
      const viewportWidth =
        viewport?.width ?? document.documentElement.clientWidth;
      const viewportHeight =
        viewport?.height ?? document.documentElement.clientHeight;
      const width = Math.min(300, viewportWidth - 16);
      const left = Math.max(
        offsetLeft + 8,
        Math.min(rect.right - width, offsetLeft + viewportWidth - width - 8),
      );
      const popupHeight = 342;
      const below = offsetTop + viewportHeight - rect.bottom - 8;
      const above = rect.top - offsetTop - 8;
      const upwards = below < popupHeight && above > below;
      setPosition({
        left,
        width,
        top: upwards ? undefined : rect.bottom + 4,
        bottom: upwards ? window.innerHeight - rect.top + 4 : undefined,
        maxHeight: Math.max(0, Math.min(popupHeight, upwards ? above : below)),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(1 - first.getDay());
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
  const display = selected
    ? selected.toLocaleDateString(undefined, {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      })
    : "mm/dd/yyyy";

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`modern-date-input responsive-date-trigger${value ? " has-value" : ""}${iconOnly ? " icon-only" : ""}`}
        aria-label={label}
        title={`${label}: ${display}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="date-trigger-text">{display}</span>
        <span aria-hidden="true" className="date-trigger-icon">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M16 3v4M8 3v4M3 10h18" />
          </svg>
        </span>
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            className="responsive-date-popup"
            style={position}
            role="dialog"
            aria-modal="false"
            aria-label={label}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="date-popup-header">
              <strong>
                {month.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </strong>
              <div>
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() =>
                    setMonth(
                      new Date(month.getFullYear(), month.getMonth() - 1, 1),
                    )
                  }
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() =>
                    setMonth(
                      new Date(month.getFullYear(), month.getMonth() + 1, 1),
                    )
                  }
                >
                  ›
                </button>
              </div>
            </div>
            <div className="date-weekdays">
              {days.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="date-calendar-grid">
              {calendarDays.map((date) => {
                const dateValue = iso(date);
                const outside = date.getMonth() !== month.getMonth();
                return (
                  <button
                    type="button"
                    key={dateValue}
                    className={`${outside ? "outside " : ""}${dateValue === value ? "selected" : ""}`}
                    aria-label={date.toLocaleDateString()}
                    aria-pressed={dateValue === value}
                    onClick={() => {
                      onChange(dateValue);
                      setOpen(false);
                      trigger.current?.focus();
                    }}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="date-popup-actions">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  onChange(iso(today));
                  setMonth(today);
                  setOpen(false);
                }}
              >
                Today
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
