import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { ResponsiveDatePicker } from "./ResponsiveDatePicker";
import { ResponsiveSelect } from "./ResponsiveSelect";
import type {
  ColumnControlDefinition,
  ColumnFilter,
  ColumnSort,
  SortDirection,
} from "../services/columnControls";

const operators = {
  text: [
    ["equals", "Equals"],
    ["notEquals", "Does not equal"],
    ["contains", "Contains"],
    ["notContains", "Does not contain"],
    ["beginsWith", "Begins with"],
    ["notBeginsWith", "Does not begin with"],
    ["endsWith", "Ends with"],
    ["notEndsWith", "Does not end with"],
    ["hasData", "Contains data"],
    ["noData", "Does not contain data"],
  ],
  datetime: [
    ["on", "On"],
    ["onOrAfter", "On or after"],
    ["onOrBefore", "On or before"],
    ["today", "Today"],
    ["yesterday", "Yesterday"],
    ["tomorrow", "Tomorrow"],
    ["thisWeek", "This week"],
    ["thisMonth", "This month"],
    ["thisYear", "This year"],
    ["nextWeek", "Next week"],
    ["next7Days", "Next 7 days"],
    ["nextMonth", "Next month"],
    ["nextYear", "Next year"],
    ["nextHours", "Next X hours"],
    ["nextDays", "Next X days"],
    ["nextWeeks", "Next X weeks"],
    ["lastHours", "Last X hours"],
    ["lastDays", "Last X days"],
    ["lastWeeks", "Last X weeks"],
    ["hasData", "Contains data"],
    ["noData", "Does not contain data"],
  ],
  number: [
    ["equals", "Equals"],
    ["notEquals", "Does not equal"],
    ["greaterThan", "Greater than"],
    ["greaterOrEqual", "Greater than or equal"],
    ["lessThan", "Less than"],
    ["lessOrEqual", "Less than or equal"],
    ["hasData", "Contains data"],
    ["noData", "Does not contain data"],
  ],
} as const;

function defaultFilter(definition: ColumnControlDefinition): ColumnFilter {
  if (definition.type === "choice") return { operator: "equals", values: [] };
  if (definition.type === "boolean")
    return { operator: "equals", value: "true" };
  if (definition.type === "datetime") return { operator: "today" };
  if (definition.type === "number")
    return { operator: "greaterThan", value: "" };
  return { operator: "contains", value: "" };
}

function needsTextValue(filter: ColumnFilter) {
  return !["hasData", "noData"].includes(filter.operator);
}

function needsDateValue(operator: string) {
  return ["on", "onOrAfter", "onOrBefore"].includes(operator);
}

function needsAmount(operator: string) {
  return /^(next|last)(Hours|Days|Weeks)$/.test(operator);
}

function validFilter(
  definition: ColumnControlDefinition,
  filter: ColumnFilter,
) {
  if (definition.type === "choice") return Boolean(filter.values?.length);
  if (["hasData", "noData"].includes(filter.operator)) return true;
  if (definition.type === "boolean")
    return ["true", "false"].includes(filter.value || "");
  if (definition.type === "datetime")
    return needsDateValue(filter.operator) || needsAmount(filter.operator)
      ? Boolean(filter.value)
      : true;
  return Boolean(filter.value?.trim());
}

export function ColumnHeaderMenu({
  definition,
  filter,
  sort,
  open,
  onToggle,
  onApplyFilter,
  onClearFilter,
  onSort,
}: {
  definition: ColumnControlDefinition;
  filter?: ColumnFilter;
  sort: ColumnSort | null;
  open: boolean;
  onToggle: () => void;
  onApplyFilter: (filter: ColumnFilter) => void;
  onClearFilter: () => void;
  onSort: (direction: SortDirection | null) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<ColumnFilter>(
    () => filter || defaultFilter(definition),
  );
  const [position, setPosition] = useState<CSSProperties>({});

  useEffect(() => {
    if (open) setDraft(filter || defaultFilter(definition));
  }, [open, filter, definition]);

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
      const width = Math.min(260, viewportWidth - 20);
      const left = Math.max(
        offsetLeft + 10,
        Math.min(rect.left, offsetLeft + viewportWidth - width - 10),
      );
      const below = offsetTop + viewportHeight - rect.bottom - 8;
      const above = rect.top - offsetTop - 8;
      const upwards = below < 280 && above > below;
      setPosition({
        left,
        width,
        top: upwards ? undefined : rect.bottom + 5,
        bottom: upwards ? window.innerHeight - rect.top + 5 : undefined,
        maxHeight: Math.max(0, Math.min(360, upwards ? above : below)),
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
      const target = event.target as Element;
      if (target.closest?.(".responsive-select-menu, .responsive-date-popup"))
        return;
      if (
        !trigger.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        onToggle();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (
        document.querySelector(
          ".column-filter-select-menu, .responsive-date-popup",
        )
      )
        return;
      onToggle();
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open, onToggle]);

  const activeSort = sort?.key === definition.key ? sort.direction : null;
  const sortLabels =
    definition.type === "datetime"
      ? ["Older to newer", "Newer to older"]
      : definition.type === "number"
        ? ["Smallest to largest", "Largest to smallest"]
        : ["A to Z", "Z to A"];

  return (
    <div className="column-header-content">
      <span>{definition.label}</span>
      {activeSort && (
        <span className="column-sort-indicator" aria-label="Manual sort active">
          {activeSort === "asc" ? "↑" : "↓"}
        </span>
      )}
      {filter && (
        <span
          className="column-filter-indicator"
          title="Column filter active"
        />
      )}
      <button
        ref={trigger}
        type="button"
        className="column-menu-trigger"
        aria-label={`${definition.label} column options`}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        <span aria-hidden="true">⌄</span>
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            className="column-menu-popup"
            style={position}
            role="dialog"
            aria-label={`${definition.label} column options`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="column-menu-title">{definition.label}</div>
            <div className="column-sort-actions">
              <button
                type="button"
                className={activeSort === "asc" ? "active" : ""}
                onClick={() => onSort("asc")}
              >
                ↑ {sortLabels[0]}
              </button>
              <button
                type="button"
                className={activeSort === "desc" ? "active" : ""}
                onClick={() => onSort("desc")}
              >
                ↓ {sortLabels[1]}
              </button>
              {sort && (
                <button type="button" onClick={() => onSort(null)}>
                  Clear manual sort
                </button>
              )}
            </div>
            <div className="column-menu-divider" />
            <div className="column-filter-label">Filter by</div>

            {definition.type === "choice" ? (
              <div className="column-choice-list">
                {definition.choices?.map((choice) => (
                  <label key={choice.value}>
                    <input
                      type="checkbox"
                      checked={draft.values?.includes(choice.value) || false}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          values: event.target.checked
                            ? [...(current.values || []), choice.value]
                            : (current.values || []).filter(
                                (value) => value !== choice.value,
                              ),
                        }))
                      }
                    />
                    <span>{choice.label}</span>
                  </label>
                ))}
              </div>
            ) : definition.type === "boolean" ? (
              <ResponsiveSelect
                className="column-filter-input column-filter-select"
                menuClassName="column-filter-select-menu"
                preferDown
                aria-label={`${definition.label} filter`}
                value={
                  draft.operator === "equals"
                    ? draft.value || "true"
                    : draft.operator
                }
                onValueChange={(value) => {
                  setDraft(
                    value === "hasData" || value === "noData"
                      ? { operator: value }
                      : { operator: "equals", value },
                  );
                }}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
                <option value="hasData">Contains data</option>
                <option value="noData">Does not contain data</option>
              </ResponsiveSelect>
            ) : (
              <>
                <ResponsiveSelect
                  className="column-filter-input column-filter-select"
                  menuClassName="column-filter-select-menu"
                  preferDown
                  aria-label={`${definition.label} filter operator`}
                  value={draft.operator}
                  onValueChange={(value) =>
                    setDraft({ operator: value, value: "" })
                  }
                >
                  {operators[definition.type].map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </ResponsiveSelect>
                {definition.type === "datetime" &&
                needsDateValue(draft.operator) ? (
                  <div className="column-filter-date">
                    <ResponsiveDatePicker
                      value={draft.value || ""}
                      onChange={(value) => setDraft({ ...draft, value })}
                      label={`${definition.label} date`}
                    />
                  </div>
                ) : definition.type === "datetime" &&
                  needsAmount(draft.operator) ? (
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="column-filter-input"
                    aria-label={`${definition.label} amount`}
                    value={draft.value || ""}
                    onChange={(event) =>
                      setDraft({ ...draft, value: event.target.value })
                    }
                  />
                ) : definition.type !== "datetime" && needsTextValue(draft) ? (
                  <input
                    type={definition.type === "number" ? "number" : "text"}
                    className="column-filter-input"
                    aria-label={`${definition.label} filter value`}
                    value={draft.value || ""}
                    onChange={(event) =>
                      setDraft({ ...draft, value: event.target.value })
                    }
                  />
                ) : null}
              </>
            )}

            <div className="column-filter-actions">
              <button
                type="button"
                className="btn-primary"
                disabled={!validFilter(definition, draft)}
                onClick={() => onApplyFilter(draft)}
              >
                Apply
              </button>
              <button
                type="button"
                className="btn-outline-modern"
                onClick={onClearFilter}
              >
                Clear
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
