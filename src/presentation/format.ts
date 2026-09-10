import { attribute, choiceOptions, recordTable } from "../config/schema";
import { CHOICE_MAPS, FIELD_CHOICE_MAPS } from "../config/choices";
export type Row = Record<string, unknown>;
export const isBlank = (v: unknown) =>
  v === "" || v === null || v === undefined;
export const text = (v: unknown, empty = "-") =>
  isBlank(v) ||
  typeof v === "object" ||
  ["undefined", "null", "[object Object]"].includes(String(v))
    ? empty
    : String(v);
const annotation = "@OData.Community.Display.V1.FormattedValue";
const isGuid = (v: unknown) =>
  /^[{]?[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}[}]?$/i.test(String(v));
export function displayValue(
  record: object | null | undefined,
  field: string,
  mapKey: string | null = null,
  empty = "-",
) {
  const r = (record || {}) as Row;
  const base = field.replace(/^_(.+)_value$/, "$1");
  const formatted =
    r[field + annotation] ??
    r[`_${base}_value${annotation}`] ??
    r[base + "name"];
  if (!isBlank(formatted)) return text(formatted, empty);
  const raw = r[field];
  const mapped = mapKey
    ? (CHOICE_MAPS as Record<string, Record<string, string>>)[mapKey]?.[
        String(raw)
      ]
    : undefined;
  if (mapped) return mapped;
  const table = recordTable(r);
  const type = table
    ? attribute(table, base)?.["x-ms-dataverse-type"]
    : undefined;
  if (table && /Picklist|State|Status/.test(type || "") && !isBlank(raw))
    return choiceOptions(table, base)[String(raw)] || "Label unavailable";
  if (typeof raw === "boolean") return raw ? "Yes" : "No";
  if (
    isGuid(raw) ||
    field.startsWith("_") ||
    /Lookup|Owner|Customer/.test(type || "")
  )
    return empty;
  return text(raw, empty);
}
export function displayChoice(
  record: object,
  table: string,
  field: string,
  empty = "-",
) {
  const r = record as Row;
  const formatted = r[field + annotation] ?? r[field + "name"];
  if (!isBlank(formatted)) return text(formatted, empty);
  const raw = r[field];
  if (isBlank(raw)) return empty;
  const options = choiceOptions(table, field);
  const fallbackKey = (FIELD_CHOICE_MAPS as Record<string, string>)[
    table + "." + field
  ];
  const label =
    options[String(raw)] ??
    (CHOICE_MAPS as Record<string, Record<string, string>>)[fallbackKey]?.[
      String(raw)
    ];
  if (label) return label;
  if (typeof raw === "boolean") return raw ? "Yes" : "No";
  if (
    /Picklist|State|Status/.test(
      attribute(table, field)?.["x-ms-dataverse-type"] || "",
    ) ||
    typeof raw === "number"
  )
    return "Label unavailable";
  return displayValue(record, field, null, empty);
}
export function displayDateTime(record: object, field: string, empty = "-") {
  const r = record as Row;
  if (!isBlank(r[field + annotation]))
    return text(r[field + annotation], empty);
  if (isBlank(r[field])) return empty;
  const d = new Date(String(r[field]));
  return Number.isNaN(d.getTime()) ? empty : d.toLocaleString();
}
export function firstDisplayValue(
  record: object,
  fields: string[],
  empty = "-",
) {
  for (const f of fields) {
    const v = displayValue(record, f, null, "");
    if (v) return v;
  }
  return empty;
}
export function firstDisplayDateTime(
  record: object,
  fields: string[],
  empty = "-",
) {
  for (const f of fields) {
    const v = displayDateTime(record, f, "");
    if (v) return v;
  }
  return empty;
}
export const truthy = (v: unknown) =>
  ["true", "1", "yes", "y", "delayed"].includes(String(v).toLowerCase());
export const normalizeSubject = (v: unknown) =>
  String(v || "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .toLowerCase();
export function dateKey(value: unknown) {
  if (isBlank(value)) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
