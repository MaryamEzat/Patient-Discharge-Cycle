import { choiceOptions, tables } from "../config/schema";
import { getPatientDisplayData } from "../presentation/reference";
import { egyptBusinessUnitFromEntityId } from "../scope/scope";
import { escapeOData } from "./data";
import type { Patient } from "./dischargeService";

export type ColumnType = "text" | "datetime" | "choice" | "boolean" | "number";
export type SortDirection = "asc" | "desc";

export interface ColumnFilter {
  operator: string;
  value?: string;
  values?: string[];
}

export interface ColumnSort {
  key: string;
  direction: SortDirection;
}

export interface ColumnControlDefinition {
  key: string;
  label: string;
  type: ColumnType;
  field: string;
  choices?: { value: string; label: string }[];
  value: (row: Patient) => unknown;
}

const display = (row: Patient) =>
  getPatientDisplayData(row) as Record<string, string>;

const statusChoices = Object.entries(
  choiceOptions(tables.patient, "crad2_status"),
).map(([value, label]) => ({ value, label }));
const pendingOnChoices = Object.entries(
  choiceOptions(tables.patient, "crad2_pendingon"),
).map(([value, label]) => ({ value, label }));
const alertFlagChoices = Object.entries(
  choiceOptions(tables.patient, "crda1_whatsappflag"),
).map(([value, label]) => ({ value, label }));

const egyptBusinessUnitChoices = [
  { value: "1", label: "ASH" },
  { value: "2", label: "SMH" },
  { value: "4", label: "AMH" },
];

export const columnControlDefinitions: Record<string, ColumnControlDefinition> =
  {
    status: {
      key: "status",
      label: "Status",
      type: "choice",
      field: "crad2_status",
      choices: statusChoices,
      value: (row) => display(row).status,
    },
    currentStep: {
      key: "currentStep",
      label: "Current Step",
      type: "text",
      field: "crda1_currentstepf",
      value: (row) => row.crda1_currentstepf,
    },
    homeMedicationsFlag: {
      key: "homeMedicationsFlag",
      label: "Home Medications Flag",
      type: "text",
      field: "and_homemedicationsflag",
      value: (row) => row.and_homemedicationsflag,
    },
    fileScanStatus: {
      key: "fileScanStatus",
      label: "File Scan Status",
      type: "text",
      field: "cr301_filescanstatus",
      value: (row) => row.cr301_filescanstatus,
    },
    patientName: {
      key: "patientName",
      label: "Patient Name",
      type: "text",
      field: "crad2_patientname",
      value: (row) => row.crad2_patientname,
    },
    patientId: {
      key: "patientId",
      label: "Patient ID",
      type: "text",
      field: "new_patientid",
      value: (row) => row.new_patientid,
    },
    visitId: {
      key: "visitId",
      label: "Visit ID",
      type: "text",
      field: "crad2_visitid",
      value: (row) => row.crad2_visitid,
    },
    room: {
      key: "room",
      label: "Room",
      type: "text",
      field: "crad2_room",
      value: (row) => row.crad2_room,
    },
    bed: {
      key: "bed",
      label: "Bed",
      type: "text",
      field: "crad2_bed",
      value: (row) => row.crad2_bed,
    },
    nurseStation: {
      key: "nurseStation",
      label: "Nurse Station",
      type: "text",
      field: "new_nursestation",
      value: (row) => row.new_nursestation,
    },
    floor: {
      key: "floor",
      label: "Floor",
      type: "text",
      field: "crad2_floor",
      value: (row) => row.crad2_floor,
    },
    age: {
      key: "age",
      label: "Age",
      type: "text",
      field: "new_age",
      value: (row) => row.new_age,
    },
    specialty: {
      key: "specialty",
      label: "Specialty",
      type: "text",
      field: "crad2_specialty",
      value: (row) => row.crad2_specialty,
    },
    physician: {
      key: "physician",
      label: "Physician Name",
      type: "text",
      field: "crad2_doctorname",
      value: (row) => row.crad2_doctorname,
    },
    paymentType: {
      key: "paymentType",
      label: "Payment Type",
      type: "text",
      field: "new_paymenttype",
      value: (row) => row.new_paymenttype,
    },
    contract: {
      key: "contract",
      label: "Contract",
      type: "text",
      field: "new_contract",
      value: (row) => row.new_contract,
    },
    contractor: {
      key: "contractor",
      label: "Contractor",
      type: "text",
      field: "new_contractor",
      value: (row) => row.new_contractor,
    },
    dischargeType: {
      key: "dischargeType",
      label: "Discharge Type",
      type: "text",
      field: "and_dischargetype",
      value: (row) => row.and_dischargetype,
    },
    cancellationReason: {
      key: "cancellationReason",
      label: "Cancellation Reason",
      type: "text",
      field: "and_cancellationreason",
      value: (row) => row.and_cancellationreason,
    },
    pendingOn: {
      key: "pendingOn",
      label: "Pending On",
      type: "choice",
      field: "crad2_pendingon",
      choices: pendingOnChoices,
      value: (row) => display(row).pendingOn,
    },
    alertFlag: {
      key: "alertFlag",
      label: "Alert Flag",
      type: "choice",
      field: "crda1_whatsappflag",
      choices: alertFlagChoices,
      value: (row) => display(row).alertFlag,
    },
    longestStep: {
      key: "longestStep",
      label: "Longest Step",
      type: "text",
      field: "cr301_longeststep",
      value: (row) => row.cr301_longeststep,
    },
    egyptBusinessUnit: {
      key: "egyptBusinessUnit",
      label: "Business Unit",
      type: "choice",
      field: "new_entityid",
      choices: egyptBusinessUnitChoices,
      value: (row) => egyptBusinessUnitFromEntityId(row.new_entityid),
    },
    lastActivity: {
      key: "lastActivity",
      label: "Last Activity",
      type: "datetime",
      field: "new_lastactivity",
      value: (row) => row.new_lastactivity,
    },
    physicianDischargeDate: {
      key: "physicianDischargeDate",
      label: "Physician Discharge Date",
      type: "datetime",
      field: "and_physiciandischargedate",
      value: (row) => row.and_physiciandischargedate || row.crad2_dischargedate,
    },
    admissionDate: {
      key: "admissionDate",
      label: "Admission Date",
      type: "datetime",
      field: "crad2_admissiondate",
      value: (row) => row.crad2_admissiondate,
    },
    createdDate: {
      key: "createdDate",
      label: "Created Date",
      type: "datetime",
      field: "createdon",
      value: (row) => row.createdon,
    },
    homeMedicationsDate: {
      key: "homeMedicationsDate",
      label: "Home Medications Date",
      type: "datetime",
      field: "and_homemedicationsdate",
      value: (row) => row.and_homemedicationsdate,
    },
    hasHomeMedications: {
      key: "hasHomeMedications",
      label: "Has Home Medications",
      type: "boolean",
      field: "and_ishomemedication",
      value: (row) => row.and_ishomemedication,
    },
    currentDischargeTAT: {
      key: "currentDischargeTAT",
      label: "Current Discharge TAT",
      type: "number",
      field: "cr301_currentdischargetat",
      value: (row) => row.cr301_currentdischargetat,
    },
    longestStepDuration: {
      key: "longestStepDuration",
      label: "Longest Step Duration",
      type: "number",
      field: "cr301_longeststepduration",
      value: (row) => row.cr301_longeststepduration,
    },
    physicalDischargeTAT: {
      key: "physicalDischargeTAT",
      label: "Physical Discharge TAT",
      type: "number",
      field: "and_physicaldischargetat",
      value: (row) => row.and_physicaldischargetat,
    },
    slaCategory: {
      key: "slaCategory",
      label: "SLA Category",
      type: "text",
      field: "and_slacategory",
      value: (row) => row.and_slacategory,
    },
  };

function quote(value: string) {
  return `'${escapeOData(value)}'`;
}

function localBoundary(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function dateRange(operator: string, value: string | undefined, now: Date) {
  const today = localBoundary(now);
  const amount = Math.max(0, Number(value || 0));
  let start: Date | undefined;
  let end: Date | undefined;

  if (["on", "onOrAfter", "onOrBefore"].includes(operator)) {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return null;
    start = new Date(year, month - 1, day);
    end = addDays(start, 1);
  } else if (operator === "today") {
    start = today;
    end = addDays(today, 1);
  } else if (operator === "yesterday") {
    start = addDays(today, -1);
    end = today;
  } else if (operator === "tomorrow") {
    start = addDays(today, 1);
    end = addDays(today, 2);
  } else if (operator === "thisWeek" || operator === "nextWeek") {
    const mondayOffset = (today.getDay() + 6) % 7;
    start = addDays(today, -mondayOffset + (operator === "nextWeek" ? 7 : 0));
    end = addDays(start, 7);
  } else if (operator === "thisMonth" || operator === "nextMonth") {
    start = new Date(
      today.getFullYear(),
      today.getMonth() + (operator === "nextMonth" ? 1 : 0),
      1,
    );
    end = addMonths(start, 1);
  } else if (operator === "thisYear" || operator === "nextYear") {
    start = new Date(
      today.getFullYear() + (operator === "nextYear" ? 1 : 0),
      0,
      1,
    );
    end = new Date(start.getFullYear() + 1, 0, 1);
  } else if (operator === "next7Days") {
    start = now;
    end = addDays(now, 7);
  } else if (operator.startsWith("next") || operator.startsWith("last")) {
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const multiplier = operator.endsWith("Hours")
      ? 60 * 60 * 1000
      : operator.endsWith("Weeks")
        ? 7 * 24 * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;
    const delta = amount * multiplier;
    if (operator.startsWith("next")) {
      start = now;
      end = new Date(now.getTime() + delta);
    } else {
      start = new Date(now.getTime() - delta);
      end = now;
    }
  }

  return start && end ? { start, end } : null;
}

export function buildColumnFilterExpression(
  definition: ColumnControlDefinition,
  filter: ColumnFilter,
  now = new Date(),
) {
  const { field, type } = definition;
  const { operator } = filter;
  if (operator === "hasData") return `${field} ne null`;
  if (operator === "noData") return `${field} eq null`;

  if (type === "choice") {
    const values = (filter.values || []).filter((value) =>
      /^-?\d+$/.test(value),
    );
    if (!values.length) return null;
    return `(${values.map((value) => `${field} eq ${value}`).join(" or ")})`;
  }

  if (type === "boolean") {
    if (
      operator !== "equals" ||
      !["true", "false"].includes(filter.value || "")
    )
      return null;
    return `${field} eq ${filter.value}`;
  }

  if (type === "number") {
    const number = Number(filter.value);
    if (!Number.isFinite(number)) return null;
    const comparison: Record<string, string> = {
      equals: "eq",
      notEquals: "ne",
      greaterThan: "gt",
      greaterOrEqual: "ge",
      lessThan: "lt",
      lessOrEqual: "le",
    };
    return comparison[operator]
      ? `${field} ${comparison[operator]} ${number}`
      : null;
  }

  if (type === "datetime") {
    const range = dateRange(operator, filter.value, now);
    if (!range) return null;
    if (operator === "onOrAfter")
      return `${field} ge ${range.start.toISOString()}`;
    if (operator === "onOrBefore")
      return `${field} lt ${range.end.toISOString()}`;
    return `${field} ge ${range.start.toISOString()} and ${field} lt ${range.end.toISOString()}`;
  }

  const value = filter.value || "";
  const textExpressions: Record<string, string> = {
    equals: `${field} eq ${quote(value)}`,
    notEquals: `${field} ne ${quote(value)}`,
    contains: `contains(${field}, ${quote(value)})`,
    notContains: `not contains(${field}, ${quote(value)})`,
    beginsWith: `startswith(${field}, ${quote(value)})`,
    notBeginsWith: `not startswith(${field}, ${quote(value)})`,
    endsWith: `endswith(${field}, ${quote(value)})`,
    notEndsWith: `not endswith(${field}, ${quote(value)})`,
  };
  return value ? textExpressions[operator] || null : null;
}

export function buildColumnFiltersOData(
  filters: Record<string, ColumnFilter>,
  now = new Date(),
) {
  const expressions = Object.entries(filters).flatMap(([key, filter]) => {
    const definition = columnControlDefinitions[key];
    if (!definition) return [];
    const expression = buildColumnFilterExpression(definition, filter, now);
    return expression ? [`(${expression})`] : [];
  });
  return expressions.join(" and ");
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

export function matchesColumnFilter(
  row: Patient,
  definition: ColumnControlDefinition,
  filter: ColumnFilter,
  now = new Date(),
) {
  const value = definition.value(row);
  if (filter.operator === "hasData") return hasValue(value);
  if (filter.operator === "noData") return !hasValue(value);

  if (definition.type === "choice") {
    const selected = filter.values || [];
    if (!selected.length) return true;
    const rawValue = (row as unknown as Record<string, unknown>)[
      definition.field
    ];
    return selected.some((choiceValue) => {
      if (String(rawValue ?? "") === choiceValue) return true;
      const label = definition.choices?.find(
        (choice) => choice.value === choiceValue,
      )?.label;
      return (
        label?.toLocaleLowerCase() === String(value ?? "").toLocaleLowerCase()
      );
    });
  }

  if (definition.type === "boolean") {
    if (filter.operator !== "equals") return true;
    return Boolean(value) === (filter.value === "true");
  }

  if (definition.type === "number") {
    const actual = Number(value);
    const expected = Number(filter.value);
    if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
    if (filter.operator === "equals") return actual === expected;
    if (filter.operator === "notEquals") return actual !== expected;
    if (filter.operator === "greaterThan") return actual > expected;
    if (filter.operator === "greaterOrEqual") return actual >= expected;
    if (filter.operator === "lessThan") return actual < expected;
    if (filter.operator === "lessOrEqual") return actual <= expected;
    return true;
  }

  if (definition.type === "datetime") {
    const time = Date.parse(String(value ?? ""));
    const range = dateRange(filter.operator, filter.value, now);
    if (!Number.isFinite(time) || !range) return false;
    if (filter.operator === "onOrAfter") return time >= range.start.getTime();
    if (filter.operator === "onOrBefore") return time < range.end.getTime();
    return time >= range.start.getTime() && time < range.end.getTime();
  }

  const actual = String(value ?? "").toLocaleLowerCase();
  const expected = String(filter.value ?? "").toLocaleLowerCase();
  if (filter.operator === "equals") return actual === expected;
  if (filter.operator === "notEquals") return actual !== expected;
  if (filter.operator === "contains") return actual.includes(expected);
  if (filter.operator === "notContains") return !actual.includes(expected);
  if (filter.operator === "beginsWith") return actual.startsWith(expected);
  if (filter.operator === "notBeginsWith") return !actual.startsWith(expected);
  if (filter.operator === "endsWith") return actual.endsWith(expected);
  if (filter.operator === "notEndsWith") return !actual.endsWith(expected);
  return true;
}

export function applyColumnFiltersLocally(
  rows: Patient[],
  filters: Record<string, ColumnFilter>,
  now = new Date(),
) {
  const active = Object.entries(filters).flatMap(([key, filter]) => {
    const definition = columnControlDefinitions[key];
    return definition ? [{ definition, filter }] : [];
  });
  if (!active.length) return rows;
  return rows.filter((row) =>
    active.every(({ definition, filter }) =>
      matchesColumnFilter(row, definition, filter, now),
    ),
  );
}

function comparable(value: unknown, type: ColumnType) {
  if (value === null || value === undefined || value === "") return null;
  if (type === "number") {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  if (type === "datetime") {
    const time = Date.parse(String(value));
    return Number.isFinite(time) ? time : null;
  }
  if (type === "boolean") return value === true ? 1 : 0;
  return String(value);
}

export function applyManualColumnSort(
  rows: Patient[],
  sort: ColumnSort | null,
) {
  if (!sort) return rows;
  const definition = columnControlDefinitions[sort.key];
  if (!definition) return rows;
  const direction = sort.direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const a = comparable(definition.value(left.row), definition.type);
      const b = comparable(definition.value(right.row), definition.type);
      if (a === null && b === null) return left.index - right.index;
      if (a === null) return 1;
      if (b === null) return -1;
      const comparison =
        typeof a === "number" && typeof b === "number"
          ? a - b
          : String(a).localeCompare(String(b), undefined, {
              sensitivity: "base",
              numeric: true,
            });
      return comparison ? comparison * direction : left.index - right.index;
    })
    .map(({ row }) => row);
}
