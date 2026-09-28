import type { Crad2_patientdischarges } from "../generated/models/Crad2_patientdischargesModel";
import { CONFIG } from "../config/reference";
import { tables, selectFields, guid } from "../config/schema";
import { allPages, escapeOData, unwrap } from "./data";
import { getItemOrg, listRecordsOrg } from "./dataverseAdapter";
import { getPatientDisplayData } from "../presentation/reference";
import { dateKey } from "../presentation/format";

export type Patient = Crad2_patientdischarges;

const select = selectFields(tables.patient, [
  ...Object.values(CONFIG.fields),
  ...Object.values(CONFIG.patientAliases).flat(),
  ...Object.values(CONFIG.patientFieldAliases).flat(),
  "_ownerid_value",
  "owneridname",
  "owneridtype",
  "modifiedon",
  "statecode",
  "statuscode",
  "new_gender",
]);

export function getLocalDateRangeISO(daysAgo = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo + 1, 0, 0, 0, 0);
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

export function mergeAndSortPatients(existing: Patient[], incoming: Patient[]): Patient[] {
  const map = new Map<string, Patient>();
  for (const r of existing) {
    if (r.crad2_patientdischargeid) {
      map.set(r.crad2_patientdischargeid, r);
    }
  }
  for (const r of incoming) {
    if (r.crad2_patientdischargeid) {
      map.set(r.crad2_patientdischargeid, r);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => Date.parse(b.createdon || "") - Date.parse(a.createdon || "")
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
      { select, filter, orderBy: ["createdon desc", "crad2_patientdischargeid asc"] },
      signal,
      onProgress,
    );
    return mergeAndSortPatients([], rows);
  },

  async listForDay(daysAgo: number, signal?: AbortSignal, onProgress?: (loaded: number) => void) {
    const { startISO, endISO } = getLocalDateRangeISO(daysAgo);
    const filter = `createdon ge ${startISO} and createdon lt ${endISO}`;
    const rows = await allPages(
      (opts) => listRecordsOrg<Patient>(tables.patient, opts),
      { select, filter, orderBy: ["createdon desc", "crad2_patientdischargeid asc"] },
      signal,
      onProgress,
    );
    return mergeAndSortPatients([], rows);
  },

  async listOlderThan(beforeISO: string, signal?: AbortSignal, onProgress?: (loaded: number) => void) {
    const filter = `createdon lt ${beforeISO}`;
    const rows = await allPages(
      (opts) => listRecordsOrg<Patient>(tables.patient, opts),
      { select, filter, orderBy: ["createdon desc", "crad2_patientdischargeid asc"] },
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
      { select, filter, orderBy: ["createdon desc", "crad2_patientdischargeid asc"] },
      signal,
    );
    return mergeAndSortPatients([], rows);
  },

  async searchServer(term: string, signal?: AbortSignal) {
    if (!term.trim()) return [];
    const filter = buildSearchFilter(term);
    const rows = await allPages(
      (opts) => listRecordsOrg<Patient>(tables.patient, opts),
      { select, filter, orderBy: ["createdon desc", "crad2_patientdischargeid asc"] },
      signal,
    );
    return mergeAndSortPatients([], rows);
  },

  async list(signal?: AbortSignal, onProgress?: (loaded: number) => void) {
    return (
      await allPages(
        (opts) => listRecordsOrg<Patient>(tables.patient, opts),
        { select, orderBy: ["createdon desc", "crad2_patientdischargeid asc"] },
        signal,
        onProgress,
      )
    ).sort(
      (a, b) => Date.parse(b.createdon || "") - Date.parse(a.createdon || ""),
    );
  },

  async get(id: string) {
    return unwrap(await getItemOrg<Patient>(tables.patient, guid(id), { select }), "Loading patient");
  },
};

export interface Filters {
  search: string;
  status: string;
  dischargeDate: string;
}

export function filterPatients(rows: Patient[], filters: Filters) {
  return rows.filter((r) => {
    if (filters.status !== "" && String(r.crad2_status) !== filters.status)
      return false;
    if (
      filters.dischargeDate &&
      dateKey(r.crad2_dischargedate || r.and_physiciandischargedate) !==
        filters.dischargeDate
    )
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

