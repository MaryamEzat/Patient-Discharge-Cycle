import type {
  Crad2_dischargeactivities,
  Crad2_dischargeactivitiesBase,
} from "../generated/models/Crad2_dischargeactivitiesModel";
import {
  attribute,
  binding,
  choiceOptions,
  guid,
  metadata,
  physicalQuestions,
  primaryId,
  primaryName,
  selectFields,
  tables,
} from "../config/schema";
import { allPages, escapeOData, OperationalError, unwrap } from "./data";
import {
  downloadFileOrg,
  listRecordsOrg,
  updateRecordOrg,
  uploadFileOrg,
} from "./dataverseAdapter";
import { displayValue, normalizeSubject } from "../presentation/format";

const WITH_DUES_FIELD = "cr301_withdues";
const HOME_MEDICATION_DISPENSING_FIELD =
  "cr301_homemedicationdispensingrequired";
export const HOME_MEDICATION_DISPENSING_YES = 293170000;
const CLEARED_ACTIVITY = 408520000;

export type Activity = Crad2_dischargeactivities;
export interface LookupOption {
  id: string;
  name: string;
}
export interface ActivityInput {
  action: string;
  instructions: string;
  pharmacyReturn: string;
  withDues: string;
  homeMedicationDispensingRequired: string;
  followUp: string;
  delayReason?: LookupOption;
  team?: LookupOption;
  comment: string;
  physical: Record<string, string>;
}
function isSubject(activity: Activity, subject: string) {
  return normalizeSubject(activity.crad2_subject).includes(subject);
}

export function hasHomeMedicationsActivity(rows: Activity[]) {
  return rows.some((activity) =>
    isSubject(activity, "home medications preparation"),
  );
}

export function activitySequence(
  rows: Activity[],
  expectHomeMedications = false,
  enableHomeMedicationSequence = true,
) {
  const initiation = rows.find((activity) =>
    isSubject(activity, "request initiation"),
  );
  const homeMedicationActivities = rows.filter((activity) =>
    isSubject(activity, "home medications preparation"),
  );
  const homeMedicationsRequired =
    expectHomeMedications ||
    (enableHomeMedicationSequence &&
      initiation?.crad2_status === CLEARED_ACTIVITY &&
      Number(initiation.cr301_homemedicationdispensingrequired) ===
        HOME_MEDICATION_DISPENSING_YES);

  if (homeMedicationsRequired) {
    const pendingHomeMedications = homeMedicationActivities.find(
      (activity) => activity.crad2_status !== CLEARED_ACTIVITY,
    );
    if (pendingHomeMedications)
      return {
        current: pendingHomeMedications,
        waitingForHomeMedications: false,
      };
    if (homeMedicationActivities.length === 0)
      return { current: undefined, waitingForHomeMedications: true };
  }

  return {
    current:
      rows.find((activity) => activity.crad2_status !== CLEARED_ACTIVITY) ||
      rows.at(-1),
    waitingForHomeMedications: false,
  };
}

export const currentActivity = (rows: Activity[]) =>
  rows.find((activity) => activity.crad2_status !== CLEARED_ACTIVITY) ||
  rows.at(-1);
export function activityRules(activity: Activity) {
  const name = normalizeSubject(activity.crad2_subject);
  return {
    initiation: name.includes("request initiation"),
    physical: name.includes("physical discharge"),
    delay:
      name.includes("request initiation") ||
      name.includes("home medications preparation"),
  };
}
export function activityBusinessRules(activity: Activity, action: string) {
  const subject = normalizeSubject(activity.crad2_subject);
  const normalizeLookupName = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, " ");
  const owner = normalizeLookupName(
    displayValue(activity, "_ownerid_value", null, ""),
  );
  const team = displayValue(
    activity,
    "_and_teamlookup_value",
    null,
    "",
  );
  const normalizedTeam = normalizeLookupName(team);
  const nursingFirstStep = "nursing discharge first step";
  return {
    withDues:
      subject.includes("financial") &&
      !owner.includes("ahj") &&
      action === "408520000",
    homeMedicationDispensing:
      normalizedTeam.includes(nursingFirstStep) &&
      normalizedTeam !== `ahj-${nursingFirstStep}`,
  };
}
// Original activity field references, filtered against generated schema. No guessed columns in queries.
const desired = [
  "crad2_dischargeactivityid",
  "crad2_subject",
  "crad2_statge",
  "crad2_status",
  "and_startdate",
  "crad2_actiondate",
  "crda1_pendingdate",
  "_crad2_previousactivity_value",
  "_ownerid_value",
  "owneridname",
  "owneridtype",
  "_crad2_owner_value",
  "new_comment",
  "new_attachment",
  "new_attachment_name",
  "and_isdelayed",
  "_and_delayreason_value",
  "and_tat",
  "and_activityclearancetatmins",
  "crad2_wasforwarded",
  "_crad2_forwardtoteam_value",
  "and_teamlookup",
  HOME_MEDICATION_DISPENSING_FIELD,
  WITH_DUES_FIELD,
  "new_forwardtoteam",
  "crda1_forwardtoteamdate",
  "and_modifiedby",
  "crad2_escalation",
  "new_billingaction",
  "crad2_billingcomment",
  "crad2_billingstatus",
  "crad2_completechargingitems",
  "crda1_hidefinancialdischarge",
  "new_homemedications",
  "crad2_homemedications",
  "crad2_pharmacycomments",
  "new_pharmacyreturn",
  "crad2_pharmacyreturn",
  "crad2_pharmacystatus",
  "new_dischargeinstructionsss",
  "new_dischargeinstructions",
  "new_followupdate",
  ...physicalQuestions.map((q) => q[0]),
  "modifiedon",
  "statecode",
  "statuscode",
];
const select = selectFields(tables.activity, desired);
export function buildActivityPayload(
  activity: Activity,
  input: ActivityInput,
): Partial<Crad2_dischargeactivitiesBase> {
  const rules = activityRules(activity);
  const businessRules = activityBusinessRules(activity, input.action);
  if (
    input.action === "" ||
    !Object.hasOwn(choiceOptions(tables.activity, "crad2_status"), input.action)
  )
    throw new OperationalError("Select an activity action before saving.");
  if (rules.delay && !input.delayReason)
    throw new OperationalError(
      "Select a Delay Reason before saving this activity.",
    );
  if (
    rules.initiation &&
    (input.instructions === "" || input.pharmacyReturn === "")
  )
    throw new OperationalError(
      "Discharge Instructions and Pharmacy Return are required.",
    );
  if (input.action === "2" && !input.team)
    throw new OperationalError("Select a team to forward this activity to.");
  if (businessRules.withDues && input.withDues === "")
    throw new OperationalError("With dues is required before saving.");
  if (
    businessRules.withDues &&
    !Object.hasOwn(
      choiceOptions(tables.activity, WITH_DUES_FIELD),
      input.withDues,
    )
  )
    throw new OperationalError("Select a valid With dues value.");
  if (
    businessRules.homeMedicationDispensing &&
    input.homeMedicationDispensingRequired === ""
  )
    throw new OperationalError(
      "Home Medication Dispensing is required before saving.",
    );
  if (
    businessRules.homeMedicationDispensing &&
    !Object.hasOwn(
      choiceOptions(tables.activity, HOME_MEDICATION_DISPENSING_FIELD),
      input.homeMedicationDispensingRequired,
    )
  )
    throw new OperationalError(
      "Select a valid Home Medication Dispensing value.",
    );
  const payload: Record<string, unknown> = {
    crad2_status: Number(input.action),
  };
  if (businessRules.withDues)
    payload[WITH_DUES_FIELD] = Number(input.withDues);
  if (businessRules.homeMedicationDispensing)
    payload[HOME_MEDICATION_DISPENSING_FIELD] =
      Number(input.homeMedicationDispensingRequired);
  // As in HTML, blank comment is not a request to clear an existing comment.
  if (input.comment !== "") payload.new_comment = input.comment;
  if (input.action === "408520000")
    payload.crad2_actiondate = new Date().toISOString();
  if (rules.initiation) {
    for (const [fields, value] of [
      [
        ["new_dischargeinstructions", "new_dischargeinstructionsss"],
        input.instructions,
      ],
      [["new_pharmacyreturn", "crad2_pharmacyreturn"], input.pharmacyReturn],
    ] as const) {
      let wrote = false;
      for (const field of fields) {
        const a = attribute(tables.activity, field);
        if (!a) continue;
        payload[field] =
          a["x-ms-dataverse-type"] === "BooleanType"
            ? value === "true"
            : value === "true"
              ? 1
              : 2;
        wrote = true;
      }
      if (!wrote)
        throw new OperationalError(
          "Required activity fields are unavailable. Contact the app administrator.",
        );
    }
    if (input.followUp) payload.new_followupdate = input.followUp;
  }
  if (rules.physical)
    for (const [field] of physicalQuestions) {
      if (input.action === "408520000") {
        if (
          input.physical[field] === undefined ||
          input.physical[field] === "" ||
          !Object.hasOwn(
            choiceOptions(tables.activity, field),
            input.physical[field],
          )
        )
          throw new OperationalError(
            "All Physical Discharge confirmations are required before clearing.",
          );
        payload[field] = Number(input.physical[field]);
      } else if (
        input.physical[field] !== undefined &&
        input.physical[field] !== ""
      ) {
        // Retain answers entered before the user changed Action, as the HTML does.
        if (
          !Object.hasOwn(
            choiceOptions(tables.activity, field),
            input.physical[field],
          )
        )
          throw new OperationalError(
            "Select a valid Physical Discharge confirmation.",
          );
        payload[field] = Number(input.physical[field]);
      } else if (
        input.action === "2" &&
        (activity[field] === null || activity[field] === undefined)
      )
        payload[field] = 2;
    }
  if (rules.delay && input.delayReason)
    Object.assign(
      payload,
      binding(
        tables.activity,
        "and_delayreason",
        tables.delay,
        input.delayReason.id,
      ),
    );
  if (input.action === "2" && input.team)
    Object.assign(
      payload,
      binding(
        tables.activity,
        "crad2_forwardtoteam",
        tables.team,
        input.team.id,
      ),
    );
  return payload as Partial<Crad2_dischargeactivitiesBase>;
}
export const activityService = {
  list(id: string, signal?: AbortSignal) {
    return allPages(
      (opts) => listRecordsOrg<Activity>(tables.activity, opts),
      {
        select,
        filter: `_crad2_discharge_value eq ${guid(id)}`,
        orderBy: ["and_startdate asc", "crad2_dischargeactivityid asc"],
      },
      signal,
    );
  },
  async save(activity: Activity, input: ActivityInput) {
    unwrap(
      await updateRecordOrg(
        tables.activity,
        guid(activity.crad2_dischargeactivityid),
        buildActivityPayload(activity, input),
      ),
      "Saving activity",
    );
  },
  async upload(id: string, file: File) {
    unwrap(
      await uploadFileOrg(tables.activity, guid(id), "new_attachment", file),
      "Uploading attachment",
    );
  },
  async download(id: string) {
    return downloadFileOrg(tables.activity, guid(id), "new_attachment");
  },
};
export async function searchTeams(query: string): Promise<LookupOption[]> {
  const rows = unwrap(
    await listRecordsOrg<Record<string, unknown>>(tables.team, {
      select: ["teamid", "name"],
      filter: query ? `contains(name,'${escapeOData(query)}')` : undefined,
      top: 20,
      orderBy: ["name asc"],
    }),
    "Searching teams",
  );
  return rows.map((r) => ({ id: String(r.teamid), name: String(r.name) }));
}
export async function searchDelayReasons(
  query: string,
): Promise<LookupOption[]> {
  const name = primaryName(tables.delay),
    id = primaryId(tables.delay);
  const rows = unwrap(
    await listRecordsOrg<Record<string, unknown>>(tables.delay, {
      select: [id, name],
      filter: query ? `contains(${name},'${escapeOData(query)}')` : undefined,
      top: 20,
      orderBy: [`${name} asc`],
    }),
    "Searching delay reasons",
  );
  return rows.map((r) => ({
    id: String((r as unknown as Record<string, unknown>)[id]),
    name: String(
      (r as unknown as Record<string, unknown>)[name] || "Unnamed delay reason",
    ),
  }));
}
export { select as activitySelect };
