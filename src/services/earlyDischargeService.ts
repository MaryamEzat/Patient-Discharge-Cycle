import type { And_earlydischarges } from "../generated/models/And_earlydischargesModel";
import type {
  And_earlydischarge_ipdvisitses,
  And_earlydischarge_ipdvisitsesBase,
} from "../generated/models/And_earlydischarge_ipdvisitsesModel";
import type { And_inpatientlists } from "../generated/models/And_inpatientlistsModel";
import { CONFIG } from "../config/reference";
import { binding, guid, selectFields, tables } from "../config/schema";
import { allPages, escapeOData, OperationalError, unwrap } from "./data";
import {
  createRecordOrg,
  getItemOrg,
  listRecordsOrg,
  updateRecordOrg,
} from "./dataverseAdapter";
export type Draft = And_earlydischarges;
export type Inpatient = And_inpatientlists;
export type EarlyPatient = And_earlydischarge_ipdvisitses & {
  __inpatient?: Inpatient;
};
const draftSelect = selectFields(
  tables.early,
  Object.values(CONFIG.earlyFields),
);
const childSelect = selectFields(tables.earlyChild, [
  ...Object.values(CONFIG.earlyIpdFields),
  "createdon",
  "modifiedon",
]);
const inpatientSelect = selectFields(tables.inpatient, [
  ...Object.values(CONFIG.inpatientFields),
  ...Object.values(CONFIG.inpatientAliases).flat(),
]);
export const isSubmitted = (draft: Draft) => draft.and_statusnew === 1;
export const earlyDischargeService = {
  async list() {
    const drafts = await allPages((opts) => listRecordsOrg<Draft>(tables.early, opts), {
      select: draftSelect,
      orderBy: ["and_dischargedate desc"],
    });
    try {
      const children = await allPages((opts) => listRecordsOrg<And_earlydischarge_ipdvisitses>(tables.earlyChild, opts), {
        select: [
          "and_earlydischarge_ipdvisitsid",
          "_and_earlydischarge_value",
          "_and_patientcode_value",
        ],
      });
      const counts = new Map<string, number>();
      for (const child of children) {
        if (child._and_earlydischarge_value && child._and_patientcode_value) {
          const idKey = child._and_earlydischarge_value.toLowerCase();
          counts.set(idKey, (counts.get(idKey) || 0) + 1);
        }
      }
      return drafts.map((d) => ({
        ...d,
        crda1_countofpatients:
          counts.get(d.and_earlydischargeid.toLowerCase()) ?? 0,
      }));
    } catch {
      return drafts.map((d) => ({
        ...d,
        crda1_countofpatients: 0,
      }));
    }
  },
  async get(id: string) {
    return unwrap(
      await getItemOrg<Draft>(tables.early, guid(id), { select: draftSelect }),
      "Loading draft",
    );
  },
  async children(id: string): Promise<EarlyPatient[]> {
    const rows = await allPages((opts) => listRecordsOrg<And_earlydischarge_ipdvisitses>(tables.earlyChild, opts), {
      select: childSelect,
      filter: `_and_earlydischarge_value eq ${guid(id)}`,
      orderBy: ["createdon desc"],
    });
    const validRows = rows.filter((r) => Boolean(r._and_patientcode_value));
    const cache = new Map<string, Promise<Inpatient>>();
    for (const row of validRows)
      if (row._and_patientcode_value && !cache.has(row._and_patientcode_value))
        cache.set(
          row._and_patientcode_value,
          getItemOrg<Inpatient>(tables.inpatient, guid(row._and_patientcode_value), {
            select: inpatientSelect,
          }).then((r) => unwrap(r, "Loading inpatient details")),
        );
    return Promise.all(
      validRows.map(async (r) => ({
        ...r,
        __inpatient: r._and_patientcode_value
          ? await cache.get(r._and_patientcode_value)
          : undefined,
      })),
    );
  },
  async search(query: string) {
    const fields = selectFields(tables.inpatient, [
      "and_name",
      "and_patientname",
      "and_visitid",
    ]);
    return unwrap(
      await listRecordsOrg<Inpatient>(tables.inpatient, {
        select: inpatientSelect,
        filter: fields
          .map((f) => `contains(${f},'${escapeOData(query)}')`)
          .join(" or "),
        top: 25,
      }),
      "Searching inpatients",
    );
  },
  async add(draft: Draft, patient: Inpatient, type: string) {
    if (!["1", "2"].includes(type))
      throw new OperationalError("Select Early or Planned first.");
    if (isSubmitted(await this.get(draft.and_earlydischargeid)))
      throw new OperationalError("This draft has already been submitted.");
    const rows = await allPages((opts) => listRecordsOrg<And_earlydischarge_ipdvisitses>(tables.earlyChild, opts), {
      select: ["and_earlydischarge_ipdvisitsid", "_and_patientcode_value"],
      filter: `_and_earlydischarge_value eq ${guid(draft.and_earlydischargeid)}`,
    });
    if (
      rows.some(
        (r) =>
          r._and_patientcode_value?.toLowerCase() ===
          patient.and_inpatientlistid.toLowerCase(),
      )
    )
      throw new OperationalError(
        "This patient is already added to this Early Discharge draft.",
      );
    const payload = {
      and_name: patient.and_name || patient.and_patientname,
      crda1_visitid: patient.and_visitid,
      and_dischargetype: Number(type),
      ...binding(
        tables.earlyChild,
        "and_earlydischarge",
        tables.early,
        draft.and_earlydischargeid,
      ),
      ...binding(
        tables.earlyChild,
        "and_patientcode",
        tables.inpatient,
        patient.and_inpatientlistid,
      ),
    };
    try {
      const result = await createRecordOrg(
        tables.earlyChild,
        payload as Record<string, unknown>,
      );
      if (
        !result.success &&
        /duplicate|unique constraint|already exists/i.test(
          String(result.error?.message),
        )
      )
        throw new OperationalError(
          "This patient is already added to this Early Discharge draft.",
        );
      unwrap(result, "Adding patient");
    } catch (error) {
      if (error instanceof OperationalError) throw error;
      if (
        error instanceof Error &&
        /duplicate|unique constraint|already exists/i.test(error.message)
      )
        throw new OperationalError(
          "This patient is already added to this Early Discharge draft.",
        );
      throw error;
    }
  },
  async submit(id: string) {
    if (isSubmitted(await this.get(id))) return;
    unwrap(
      await updateRecordOrg(tables.early, guid(id), { and_statusnew: 1 }),
      "Submitting draft",
    );
  },
};
export { draftSelect, childSelect, inpatientSelect };
