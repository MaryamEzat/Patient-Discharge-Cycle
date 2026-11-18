import type { And_earlydischarges } from "../generated/models/And_earlydischargesModel";
import type {
  And_earlydischarge_ipdvisitses,
  And_earlydischarge_ipdvisitsesBase,
} from "../generated/models/And_earlydischarge_ipdvisitsesModel";
import type { And_inpatientlists } from "../generated/models/And_inpatientlistsModel";
import type { Ipd_visits } from "../generated/models/Ipd_visitsModel";
import type { Ipd_patients } from "../generated/models/Ipd_patientsModel";
import { CONFIG } from "../config/reference";
import {
  attribute,
  binding,
  guid,
  selectFields,
  tables,
} from "../config/schema";
import { allPages, escapeOData, OperationalError, unwrap } from "./data";
import {
  createRecordOrg,
  getItemOrg,
  listRecordsOrg,
  updateRecordOrg,
} from "./dataverseAdapter";
import {
  EGYPT_BUSINESS_UNITS,
  recordBusinessUnit,
  type Scope,
} from "../scope/scope";

/**
 * Inpatient list rows are all owned by the root business unit, so the owner cannot tell the
 * hospital apart. Use the hospital entity code instead (102 = AHJ), as discharges do with new_entityid.
 */
export function inpatientScopeFilter(scope: Scope) {
  return scope === "Saudi Arabia"
    ? "and_entityid eq '102'"
    : EGYPT_BUSINESS_UNITS.map((b) => `and_entityid eq '${b.entityId}'`).join(" or ");
}
import { displayValue } from "../presentation/format";
export type Draft = And_earlydischarges;
export type Inpatient = And_inpatientlists;
export type IpdPatient = Ipd_patients;
export type IpdVisit = Ipd_visits & { __patient?: IpdPatient };
export type EarlyPatient = And_earlydischarge_ipdvisitses & {
  __inpatient?: Inpatient;
  __visit?: IpdVisit;
};
export type EarlyDraftBusinessUnit = "AHJ" | "ASH" | "SMH" | "AMH";
const EGYPT_DRAFT_BUSINESS_UNITS = new Set<EarlyDraftBusinessUnit>([
  "ASH",
  "SMH",
  "AMH",
]);
// Drafts are owned by the root BU; the hospital is held in the cr301_businessunit lookup.
export function earlyDraftBusinessUnit(
  draft: Draft | undefined,
): EarlyDraftBusinessUnit | "" {
  const value = (
    displayValue(draft || {}, "_cr301_businessunit_value", null, "") ||
    recordBusinessUnit(draft || {})
  )
    .trim()
    .toUpperCase();
  return value === "AHJ" || EGYPT_DRAFT_BUSINESS_UNITS.has(value as EarlyDraftBusinessUnit)
    ? (value as EarlyDraftBusinessUnit)
    : "";
}
export function earlyDraftMatchesScope(draft: Draft, scope: Scope) {
  const businessUnit = earlyDraftBusinessUnit(draft);
  return scope === "Saudi Arabia"
    ? businessUnit === "AHJ"
    : EGYPT_DRAFT_BUSINESS_UNITS.has(businessUnit as EarlyDraftBusinessUnit);
}
const draftSelect = selectFields(
  tables.early,
  [...Object.values(CONFIG.earlyFields), "_owningbusinessunit_value"],
);
const childSelect = selectFields(tables.earlyChild, [
  ...Object.values(CONFIG.earlyIpdFields),
  "createdon",
  "modifiedon",
]);
const inpatientSelect = selectFields(tables.inpatient, [
  ...Object.values(CONFIG.inpatientFields),
  ...Object.values(CONFIG.inpatientAliases).flat(),
  "_owningbusinessunit_value",
]);
const visitSelect = selectFields(
  tables.ipdVisit,
  Object.values(CONFIG.ipdVisitFields),
);
const ipdPatientSelect = selectFields(
  tables.ipdPatient,
  Object.values(CONFIG.ipdPatientFields),
);
const ipdPatientIdFilter = (field: string, ids: string[]) =>
  ids.map((id) => `${field} eq ${guid(id)}`).join(" or ");
/** Attaches each visit's ipd_patient record (source of the patient name). */
async function withIpdPatients(visits: IpdVisit[]): Promise<IpdVisit[]> {
  const ids = [
    ...new Set(
      visits.map((v) => v._ipd_patient_value?.toLowerCase()).filter(Boolean),
    ),
  ] as string[];
  const patients = new Map<string, IpdPatient>();
  for (let i = 0; i < ids.length; i += 50) {
    const rows = unwrap(
      await listRecordsOrg<IpdPatient>(tables.ipdPatient, {
        select: ipdPatientSelect,
        filter: ipdPatientIdFilter(CONFIG.ipdPatientFields.id, ids.slice(i, i + 50)),
      }),
      "Loading IPD patients",
    );
    for (const row of rows) patients.set(row.ipd_patientid.toLowerCase(), row);
  }
  return visits.map((v) => ({
    ...v,
    __patient: v._ipd_patient_value
      ? patients.get(v._ipd_patient_value.toLowerCase())
      : undefined,
  }));
}
// The rollup's formatted value is displayed ahead of the raw number, so replace both.
const withPatientCount = (draft: Draft, count: number): Draft => ({
  ...draft,
  crda1_countofpatients: count,
  "crda1_countofpatients@OData.Community.Display.V1.FormattedValue": String(count),
} as Draft);
const isBlankRow = (row: And_earlydischarge_ipdvisitses) =>
  !row._and_patientcode_value && !row._cr301_patientcodeegy_value;
export const isSubmitted = (draft: Draft) => draft.and_statusnew === 1;
export const earlyDischargeService = {
  async list(scope: Scope) {
    const drafts = (await allPages((opts) => listRecordsOrg<Draft>(tables.early, opts), {
      select: draftSelect,
      orderBy: ["and_dischargedate desc"],
    })).filter((draft) => earlyDraftMatchesScope(draft, scope));
    try {
      // Only rows with a patient count; skipping the nightly blank placeholders keeps this read small.
      const children = await allPages((opts) => listRecordsOrg<And_earlydischarge_ipdvisitses>(tables.earlyChild, opts), {
        select: [
          "and_earlydischarge_ipdvisitsid",
          "_and_earlydischarge_value",
          "_and_patientcode_value",
          "_cr301_patientcodeegy_value",
        ],
        filter:
          "_and_patientcode_value ne null or _cr301_patientcodeegy_value ne null",
      });
      const counts = new Map<string, number>();
      for (const child of children) {
        if (
          child._and_earlydischarge_value &&
          (child._and_patientcode_value || child._cr301_patientcodeegy_value)
        ) {
          const idKey = child._and_earlydischarge_value.toLowerCase();
          counts.set(idKey, (counts.get(idKey) || 0) + 1);
        }
      }
      return drafts.map((d) =>
        withPatientCount(d, counts.get(d.and_earlydischargeid.toLowerCase()) ?? 0),
      );
    } catch (error) {
      console.error("Counting Early Discharge patients failed", error);
      return drafts.map((d) =>
        withPatientCount(
          d,
          scope === "Egypt" ? Number(d.crda1_countofpatients || 0) : 0,
        ),
      );
    }
  },
  async get(id: string) {
    return unwrap(
      await getItemOrg<Draft>(tables.early, guid(id), { select: draftSelect }),
      "Loading draft",
    );
  },
  async children(id: string): Promise<EarlyPatient[]> {
    // Patients first in the order they were added (blanks are filled oldest-first), then placeholders.
    const ordered = await allPages((opts) => listRecordsOrg<And_earlydischarge_ipdvisitses>(tables.earlyChild, opts), {
      select: childSelect,
      filter: `_and_earlydischarge_value eq ${guid(id)}`,
      orderBy: ["createdon asc", "and_earlydischarge_ipdvisitsid asc"],
    });
    const rows = [
      ...ordered.filter((row) => !isBlankRow(row)),
      ...ordered.filter(isBlankRow),
    ];
    const cache = new Map<string, Promise<Inpatient>>();
    for (const row of rows)
      if (row._and_patientcode_value && !cache.has(row._and_patientcode_value))
        cache.set(
          row._and_patientcode_value,
          getItemOrg<Inpatient>(tables.inpatient, guid(row._and_patientcode_value), {
            select: inpatientSelect,
          }).then((r) => unwrap(r, "Loading inpatient details")),
        );
    const visits = new Map<string, Promise<IpdVisit>>();
    for (const row of rows)
      if (row._cr301_patientcodeegy_value && !visits.has(row._cr301_patientcodeegy_value))
        visits.set(
          row._cr301_patientcodeegy_value,
          getItemOrg<IpdVisit>(tables.ipdVisit, guid(row._cr301_patientcodeegy_value), {
            select: visitSelect,
          })
            .then((r) => withIpdPatients([unwrap(r, "Loading IPD visit details")]))
            .then(([visit]) => visit),
        );
    return Promise.all(
      rows.map(async (r) => ({
        ...r,
        __inpatient: r._and_patientcode_value
          ? await cache.get(r._and_patientcode_value)
          : undefined,
        __visit: r._cr301_patientcodeegy_value
          ? await visits.get(r._cr301_patientcodeegy_value)
          : undefined,
      })),
    );
  },
  async searchEgyptVisits(query: string) {
    const fields = selectFields(tables.ipdVisit, [
      CONFIG.ipdVisitFields.name,
      CONFIG.ipdVisitFields.patientCode,
    ]);
    const match = fields
      .map((f) => `contains(${f},'${escapeOData(query)}')`)
      .join(" or ");
    const search = (filter: string) =>
      listRecordsOrg<IpdVisit>(tables.ipdVisit, {
        select: visitSelect,
        filter: `statecode eq 0 and (${filter})`,
        orderBy: [`${CONFIG.ipdVisitFields.name} asc`],
        top: 25,
      }).then((r) => unwrap(r, "Searching IPD visits"));
    // Patient names live on ipd_patient, so match them there and follow the link back to visits.
    const namedPatients = unwrap(
      await listRecordsOrg<IpdPatient>(tables.ipdPatient, {
        select: [CONFIG.ipdPatientFields.id],
        filter: `contains(${CONFIG.ipdPatientFields.name},'${escapeOData(query)}')`,
        top: 25,
      }),
      "Searching IPD patients",
    );
    const [byVisit, byPatient] = await Promise.all([
      search(match),
      namedPatients.length
        ? search(
            ipdPatientIdFilter(
              "_ipd_patient_value",
              namedPatients.map((p) => p.ipd_patientid),
            ),
          )
        : Promise.resolve([] as IpdVisit[]),
    ]);
    const unique = new Map(
      [...byVisit, ...byPatient].map((v) => [v.ipd_visitid.toLowerCase(), v]),
    );
    return withIpdPatients([...unique.values()].slice(0, 25));
  },
  /** Fills the draft's first blank placeholder row with the IPD visit, or creates a row if none remain. */
  async addEgypt(draft: Draft, visit: IpdVisit, type: string) {
    if (!["1", "2"].includes(type))
      throw new OperationalError("Select Early or Planned first.");
    const currentDraft = await this.get(draft.and_earlydischargeid);
    if (!EGYPT_DRAFT_BUSINESS_UNITS.has(earlyDraftBusinessUnit(currentDraft) as EarlyDraftBusinessUnit))
      throw new OperationalError(
        "The Egypt IPD Visit lookup cannot be used for this Early Discharge draft.",
      );
    if (isSubmitted(currentDraft))
      throw new OperationalError("This draft has already been submitted.");
    const draftFilter = `_and_earlydischarge_value eq ${guid(draft.and_earlydischargeid)}`;
    const rowSelect = [
      "and_earlydischarge_ipdvisitsid",
      "_and_patientcode_value",
      "_cr301_patientcodeegy_value",
    ];
    const rows = await allPages((opts) => listRecordsOrg<And_earlydischarge_ipdvisitses>(tables.earlyChild, opts), {
      select: rowSelect,
      filter: draftFilter,
      orderBy: ["createdon asc", "and_earlydischarge_ipdvisitsid asc"],
    });
    if (
      rows.some(
        (r) =>
          r._cr301_patientcodeegy_value?.toLowerCase() ===
          visit.ipd_visitid.toLowerCase(),
      )
    )
      throw new OperationalError(
        "This IPD visit is already added to this Early Discharge draft.",
      );
    const payload = {
      crda1_visitid: visit.ipd_name,
      and_dischargetype: Number(type),
      ...binding(
        tables.earlyChild,
        "cr301_patientcodeegy",
        tables.ipdVisit,
        visit.ipd_visitid,
      ),
    };
    // Re-read a candidate just before writing so a row filled by another user is skipped.
    for (const candidate of rows.filter(isBlankRow)) {
      const latest = unwrap(
        await getItemOrg<And_earlydischarge_ipdvisitses>(
          tables.earlyChild,
          guid(candidate.and_earlydischarge_ipdvisitsid),
          { select: rowSelect },
        ),
        "Checking draft row",
      );
      if (!isBlankRow(latest)) continue;
      unwrap(
        await updateRecordOrg(
          tables.earlyChild,
          guid(candidate.and_earlydischarge_ipdvisitsid),
          payload,
        ),
        "Adding IPD visit",
      );
      return;
    }
    const businessUnitId = currentDraft._cr301_businessunit_value;
    const businessUnitBinding = businessUnitId
      ? {
          [`${attribute(tables.earlyChild, "cr301_businessunit")["x-ms-schema-name"]}@odata.bind`]:
            `/businessunits(${guid(businessUnitId)})`,
        }
      : {};
    unwrap(
      await createRecordOrg(tables.earlyChild, {
        ...payload,
        and_name: visit.ipd_patientcode || visit.ipd_name,
        ...binding(
          tables.earlyChild,
          "and_earlydischarge",
          tables.early,
          draft.and_earlydischargeid,
        ),
        ...businessUnitBinding,
      }),
      "Adding IPD visit",
    );
  },
  async search(query: string, scope: Scope) {
    const fields = selectFields(tables.inpatient, [
      "and_name",
      "and_patientname",
      "and_visitid",
    ]);
    const matches = fields
      .map((f) => `contains(${f},'${escapeOData(query)}')`)
      .join(" or ");
    return unwrap(
      await listRecordsOrg<Inpatient>(tables.inpatient, {
        select: inpatientSelect,
        filter: `(${inpatientScopeFilter(scope)}) and (${matches})`,
        top: 25,
      }),
      "Searching inpatients",
    );
  },
  async add(draft: Draft, patient: Inpatient, type: string) {
    if (!["1", "2"].includes(type))
      throw new OperationalError("Select Early or Planned first.");
    const currentDraft = await this.get(draft.and_earlydischargeid);
    if (earlyDraftBusinessUnit(currentDraft) !== "AHJ")
      throw new OperationalError(
        "The AHJ patient lookup cannot be used for this Early Discharge draft.",
      );
    if (isSubmitted(currentDraft))
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
export { draftSelect, childSelect, inpatientSelect, visitSelect };
