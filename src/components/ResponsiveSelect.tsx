import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

/** Render inside the app viewport instead of using the browser's unbounded native popup. */
export function ResponsiveSelect({
  value,
  onValueChange,
  children,
  className = "",
  menuClassName = "",
  preferDown = false,
  disabled,
  id,
  "aria-label": label,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
  menuClassName?: string;
  preferDown?: boolean;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}) {
  const options: { value: string; label: ReactNode }[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement<{ value: string; children: ReactNode }>(child))
      options.push({
        value: String(child.props.value),
        label: child.props.children,
      });
  });
  const listId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<CSSProperties>({});
  const selected = options.findIndex((option) => option.value === value);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? document.documentElement.clientWidth;
      const height = viewport?.height ?? document.documentElement.clientHeight;
      const below = top + height - rect.bottom - 8;
      const above = rect.top - top - 8;
      const desiredHeight = Math.min(240, options.length * 40);
      const flipThreshold = preferDown
        ? Math.min(120, desiredHeight)
        : desiredHeight;
      const upwards = below < flipThreshold && above > below;
      setPosition({
        left: Math.max(
          left + 8,
          Math.min(
            rect.left,
            left + width - Math.min(rect.width, width - 16) - 8,
          ),
        ),
        width: Math.min(rect.width, width - 16),
        maxHeight: Math.max(0, Math.min(240, upwards ? above : below)),
        top: upwards ? undefined : rect.bottom + 4,
        bottom: upwards ? window.innerHeight - rect.top + 4 : undefined,
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
  }, [open, options.length, preferDown]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !menu.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => {
    menu.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  const choose = (index: number) => {
    if (options[index]) onValueChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        disabled={disabled}
        className={`responsive-select ${className}`}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onBlur={() => setOpen(false)}
        onClick={() => {
          setActive(Math.max(0, selected));
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
            setActive((index) =>
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? options.length - 1
                  : !open
                    ? Math.max(0, selected)
                    : Math.max(
                        0,
                        Math.min(
                          options.length - 1,
                          index + (event.key === "ArrowDown" ? 1 : -1),
                        ),
                      ),
            );
          } else if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          } else if (open && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            choose(active);
          } else if (
            event.key.length === 1 &&
            event.key !== " " &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            const index = options.findIndex((option) =>
              String(option.label)
                .toLowerCase()
                .startsWith(event.key.toLowerCase()),
            );
            if (index >= 0) {
              event.preventDefault();
              setActive(index);
              setOpen(true);
            }
          }
        }}
      >
        <span>{options[selected]?.label ?? options[0]?.label}</span>
      </button>
      {open &&
        !disabled &&
        createPortal(
          <div
            ref={menu}
            id={listId}
            role="listbox"
            aria-label={label}
            className={`responsive-select-menu ${menuClassName}`}
            style={position}
            onPointerDown={(event) => event.preventDefault()}
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.value === value}
                className={`responsive-select-option${active === index ? " active" : ""}`}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(index)}
              >
                {option.label}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
