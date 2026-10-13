import type { Crad2_patientdischarges } from "../generated/models/Crad2_patientdischargesModel";
import { CONFIG } from "../config/reference";
import { tables, selectFields, guid } from "../config/schema";
import { allPages, escapeOData, unwrap } from "./data";
import { getItemOrg, listRecordsOrg } from "./dataverseAdapter";
import { getPatientDisplayData } from "../presentation/reference";
import { dateKey } from "../presentation/format";
import type { EgyptBusinessUnitEntityId } from "../scope/scope";

export type Patient = Crad2_patientdischarges;
export type DischargeView = "all" | "delayed";

export const DELAYED_EGYPT_FILTER =
  "cr301_currentdischargetat gt 120 and (new_entityid eq '1' or new_entityid eq '2' or new_entityid eq '4')";

export function columnFilterForView(view: DischargeView, columnFilter: string) {
  return view === "delayed"
    ? `(${DELAYED_EGYPT_FILTER}) and (${columnFilter})`
    : columnFilter;
}

const select = selectFields(tables.patient, [
  ...Object.values(CONFIG.fields),
  ...Object.values(CONFIG.patientAliases).flat(),
  ...Object.values(CONFIG.patientFieldAliases).flat(),
  "_ownerid_value",
  "owneridname",
  "owneridtype",
  "modifiedon",
  "versionnumber",
  "statecode",
  "statuscode",
  "new_gender",
  "new_entityid",
]);

const DEFAULT_PATIENT_ORDER = [
  "new_lastactivity desc",
  "modifiedon desc",
  "createdon desc",
  "crad2_patientdischargeid asc",
];

export function getLocalDateRangeISO(daysAgo = 0) {
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - daysAgo,
    0,
    0,
    0,
    0,
  );
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - daysAgo + 1,
    0,
    0,
    0,
    0,
  );
  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    start,
    end,
  };
}

export function getDateRangeFromStrISO(dateStr: string) {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [year, month, day] = parts;
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  };
}

export function mergeAndSortPatients(
  existing: Patient[],
  incoming: Patient[],
): Patient[] {
  const map = new Map<string, Patient>();
  for (const r of existing) {
    if (r.crad2_patientdischargeid) {
      map.set(r.crad2_patientdischargeid, r);
    }
  }
  for (const r of incoming) {
    if (r.crad2_patientdischargeid) {
      const previous = map.get(r.crad2_patientdischargeid);
      map.set(
        r.crad2_patientdischargeid,
        previous && patientVersion(previous) > patientVersion(r) ? previous : r,
      );
    }
  }
  return sortPatientsByLatestActivity(map.values());
}

function timestamp(value: string | undefined) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function patientVersion(row: Patient) {
  return Number(row.versionnumber || 0) || timestamp(row.modifiedon);
}

export function latestPatientActivityTime(row: Patient) {
  return (
    timestamp(row.new_lastactivity) ||
    timestamp(row.modifiedon) ||
    timestamp(row.createdon)
  );
}

export function sortPatientsByLatestActivity(rows: Iterable<Patient>) {
  return Array.from(rows).sort(
    (a, b) =>
      latestPatientActivityTime(b) - latestPatientActivityTime(a) ||
      a.crad2_patientdischargeid.localeCompare(b.crad2_patientdischargeid),
  );
}

export function buildSearchFilter(term: string): string {
  const safe = escapeOData(term.trim());
  return `contains(crad2_patientname, '${safe}') or contains(new_patientid, '${safe}') or contains(and_visitid, '${safe}') or contains(crad2_phonenumber, '${safe}')`;
}

export const dischargeService = {
  async listToday(signal?: AbortSignal, onProgress?: (loaded: number) => void) {
    const { startISO, endISO } = getLocalDateRangeISO(0);
    const filter = `createdon ge ${startISO} and createdon lt ${endISO}`;
    const rows = await allPages(
      (opts) => listRecordsOrg<Patient>(tables.patient, opts),
      {
        select,
        filter,
        orderBy: [
          "new_lastactivity desc",
          "modifiedon desc",
          "createdon desc",
          "crad2_patientdischargeid asc",
        ],
      },
      signal,
      onProgress,
    );
    return mergeAndSortPatients([], rows);
  },

  async listForDay(
    daysAgo: number,
    signal?: AbortSignal,
    onProgress?: (loaded: number) => void,
  ) {
    const { startISO, endISO } = getLocalDateRangeISO(daysAgo);
    const filter = `createdon ge ${startISO} and createdon lt ${endISO}`;
    const rows = await allPages(
      (opts) => listRecordsOrg<Patient>(tables.patient, opts),
      {
        select,
        filter,
        orderBy: [
          "new_lastactivity desc",
          "modifiedon desc",
          "createdon desc",
          "crad2_patientdischargeid asc",
        ],
      },
      signal,
      onProgress,
    );
    return mergeAndSortPatients([], rows);
  },

  async listOlderThan(
    beforeISO: string,
    signal?: AbortSignal,
    onProgress?: (loaded: number) => void,
  ) {
    const filter = `createdon lt ${beforeISO}`;
    const rows = await allPages(
      (opts) => listRecordsOrg<Patient>(tables.patient, opts),
      {
        select,
        filter,
        orderBy: [
          "new_lastactivity desc",
          "modifiedon desc",
          "createdon desc",
          "crad2_patientdischargeid asc",
        ],
      },
      signal,
      onProgress,
    );
    return mergeAndSortPatients([], rows);
  },

  async listForDateStr(dateStr: string, signal?: AbortSignal) {
    const range = getDateRangeFromStrISO(dateStr);
    if (!range) return [];
    const filter = `createdon ge ${range.startISO} and createdon lt ${range.endISO}`;
    const rows = await allPages(
      (opts) => listRecordsOrg<Patient>(tables.patient, opts),
      {
        select,
        filter,
        orderBy: [
          "new_lastactivity desc",
          "modifiedon desc",
          "createdon desc",
          "crad2_patientdischargeid asc",
        ],
      },
      signal,
    );
    return mergeAndSortPatients([], rows);
  },

  async searchServer(term: string, signal?: AbortSignal) {
    if (!term.trim()) return [];
    const filter = buildSearchFilter(term);
    const rows = await allPages(
      (opts) => listRecordsOrg<Patient>(tables.patient, opts),
      {
        select,
        filter,
        orderBy: [
          "new_lastactivity desc",
          "modifiedon desc",
          "createdon desc",
          "crad2_patientdischargeid asc",
        ],
      },
      signal,
    );
    return mergeAndSortPatients([], rows);
  },

  async listDelayedEgypt(
    signal?: AbortSignal,
    onProgress?: (loaded: number) => void,
  ) {
    const rows = await allPages(
      (opts) => listRecordsOrg<Patient>(tables.patient, opts),
      {
        select,
        filter: DELAYED_EGYPT_FILTER,
        orderBy: [
          "cr301_currentdischargetat desc",
          "crad2_patientdischargeid asc",
        ],
      },
      signal,
      onProgress,
    );
    return sortDelayedPatients(rows.filter(isDelayedEgyptPatient));
  },

  async listForColumnFilters(
    view: DischargeView,
    columnFilter: string,
    signal?: AbortSignal,
  ) {
    if (!columnFilter) return [];
    const filter = columnFilterForView(view, columnFilter);
    const rows = await allPages(
      (opts) => listRecordsOrg<Patient>(tables.patient, opts),
      {
        select,
        filter,
        orderBy:
          view === "delayed"
            ? ["cr301_currentdischargetat desc", "crad2_patientdischargeid asc"]
            : DEFAULT_PATIENT_ORDER,
      },
      signal,
    );
    return view === "delayed"
      ? sortDelayedPatients(rows.filter(isDelayedEgyptPatient))
      : mergeAndSortPatients([], rows);
  },

  async list(signal?: AbortSignal, onProgress?: (loaded: number) => void) {
    const rows = await allPages(
      (opts) => listRecordsOrg<Patient>(tables.patient, opts),
      {
        select,
        orderBy: DEFAULT_PATIENT_ORDER,
      },
      signal,
      onProgress,
    );
    return sortPatientsByLatestActivity(rows);
  },

  async get(id: string) {
    return unwrap(
      await getItemOrg<Patient>(tables.patient, guid(id), { select }),
      "Loading patient",
    );
  },
};

export interface Filters {
  search: string;
  status: string;
  dischargeDate: string;
  businessUnit: "" | EgyptBusinessUnitEntityId;
  unit: string;
  dischargeType: string;
  dateFrom: string;
  dateTo: string;
}

export function isDelayedEgyptPatient(row: Patient) {
  return (
    ["1", "2", "4"].includes(String(row.new_entityid ?? "").trim()) &&
    Number(row.cr301_currentdischargetat) > 120
  );
}

export function sortDelayedPatients(rows: Patient[]) {
  return [...rows].sort(
    (a, b) =>
      Number(b.cr301_currentdischargetat || 0) -
      Number(a.cr301_currentdischargetat || 0),
  );
}

export function filterPatients(rows: Patient[], filters: Filters) {
  return rows.filter((r) => {
    if (
      filters.businessUnit !== "" &&
      String(r.new_entityid ?? "").trim() !== filters.businessUnit
    )
      return false;
    if (filters.status !== "" && String(r.crad2_status) !== filters.status)
      return false;
    if (filters.unit && String(r.new_nursestation || "") !== filters.unit)
      return false;
    if (
      filters.dischargeType &&
      String(r.and_dischargetype || "") !== filters.dischargeType
    )
      return false;
    if (
      filters.dischargeDate &&
      dateKey(r.crad2_dischargedate || r.and_physiciandischargedate) !==
        filters.dischargeDate
    )
      return false;
    const physicianDate = dateKey(
      r.and_physiciandischargedate || r.crad2_dischargedate,
    );
    if (
      filters.dateFrom &&
      (!physicianDate || physicianDate < filters.dateFrom)
    )
      return false;
    if (filters.dateTo && (!physicianDate || physicianDate > filters.dateTo))
      return false;
    return (
      !filters.search.trim() ||
      Object.values(getPatientDisplayData(r))
        .join(" ")
        .toLowerCase()
        .includes(filters.search.trim().toLowerCase())
    );
  });
}

export { select as patientSelect };
