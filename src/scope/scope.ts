export const SCOPES = ["Egypt", "Saudi Arabia"] as const;
export type Scope = (typeof SCOPES)[number];

export const SCOPE_STORAGE_KEY = "patient-discharge.scope";

export const EGYPT_BUSINESS_UNITS = [
  { entityId: "1", label: "ASH" },
  { entityId: "2", label: "SMH" },
  { entityId: "4", label: "AMH" },
] as const;
export type EgyptBusinessUnitEntityId =
  (typeof EGYPT_BUSINESS_UNITS)[number]["entityId"];

export function egyptBusinessUnitFromEntityId(entityId: unknown): string {
  return (
    EGYPT_BUSINESS_UNITS.find(
      (businessUnit) => businessUnit.entityId === String(entityId ?? "").trim(),
    )?.label || ""
  );
}

export function isScope(value: unknown): value is Scope {
  return SCOPES.includes(value as Scope);
}

/** Dataverse stores Saudi Arabia records under AHJ; every other BU is Egypt. */
export function scopeFromBusinessUnit(businessUnit: unknown): Scope {
  return String(businessUnit || "").trim().toUpperCase() === "AHJ"
    ? "Saudi Arabia"
    : "Egypt";
}

const formatted = "@OData.Community.Display.V1.FormattedValue";

export function recordBusinessUnit(record: object): string {
  const row = record as Record<string, unknown>;
  return String(
    row[`_owningbusinessunit_value${formatted}`] ??
      row.owningbusinessunitname ??
      row[`_businessunitid_value${formatted}`] ??
      row.businessunitidname ??
      "",
  );
}

export function recordMatchesScope(record: object, scope: Scope): boolean {
  return scopeFromBusinessUnit(recordBusinessUnit(record)) === scope;
}

export function recordsForScope<T extends object>(rows: T[], scope: Scope): T[] {
  return rows.filter((row) => recordMatchesScope(row, scope));
}
