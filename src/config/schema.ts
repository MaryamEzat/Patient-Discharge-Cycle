import patient from "../../.power/schemas/dataverse/patientdischarges.Schema.json";
import activity from "../../.power/schemas/dataverse/dischargeactivities.Schema.json";
import early from "../../.power/schemas/dataverse/earlydischarges.Schema.json";
import earlyChild from "../../.power/schemas/dataverse/earlydischarge_ipdvisits.Schema.json";
import inpatient from "../../.power/schemas/dataverse/inpatientlists.Schema.json";
import alert from "../../.power/schemas/dataverse/dischargealerts.Schema.json";
import team from "../../.power/schemas/dataverse/teams.Schema.json";
import user from "../../.power/schemas/dataverse/users.Schema.json";
import delay from "../../.power/schemas/dataverse/delayreasons.Schema.json";

// Adapt generated metadata, rather than duplicating Dataverse models.
export interface Attribute {
  type: string;
  title?: string;
  "x-ms-dataverse-type"?: string;
  "x-ms-schema-name"?: string;
  "x-ms-read-only"?: boolean;
  enum?: string[];
  "x-ms-enum-values"?: number[];
  maxLength?: number;
  required?: boolean;
}
interface TableSchema {
  name: string;
  schema: {
    items: {
      properties: Record<string, Attribute>;
      "x-ms-dataverse-entityset": string;
      "x-ms-dataverse-primary-id": string;
      "x-ms-dataverse-primary-name": string;
    };
  };
}
export const tables = {
  patient: patient.name,
  activity: activity.name,
  early: early.name,
  earlyChild: earlyChild.name,
  inpatient: inpatient.name,
  alert: alert.name,
  team: team.name,
  user: user.name,
  delay: delay.name,
};
const schemas: TableSchema[] = [
  patient,
  activity,
  early,
  earlyChild,
  inpatient,
  alert,
  team,
  user,
  delay,
];
export function recordTable(record: object): string | undefined {
  return schemas.find(
    (s) => s.schema.items["x-ms-dataverse-primary-id"] in record,
  )?.name;
}
export function metadata(table: string) {
  const schema = schemas.find((s) => s.name === table);
  if (!schema) throw new Error(`No generated metadata for ${table}`);
  return schema.schema.items;
}
export const entitySet = (table: string) =>
  metadata(table)["x-ms-dataverse-entityset"];
export const primaryId = (table: string) =>
  metadata(table)["x-ms-dataverse-primary-id"];
export const primaryName = (table: string) =>
  metadata(table)["x-ms-dataverse-primary-name"];
export function attribute(table: string, field: string) {
  return metadata(table).properties[field.replace(/^_(.+)_value$/, "$1")];
}
export function selectFields(table: string, desired: string[]) {
  return [
    ...new Set(
      desired
        .filter((field) => {
          const a = attribute(table, field);
          if (!a) return false;
          if (
            field.startsWith("_") &&
            !/^(Lookup|Owner|Customer)Type$/.test(
              a["x-ms-dataverse-type"] || "",
            )
          )
            return false;
          // Dataverse's SDK metadata includes synthetic lookup label/type attributes,
          // but Web API returns these through annotations on the lookup value.
          if (/^(owneridname|owneridtype)$/.test(field)) return false;
          return a["x-ms-dataverse-type"] !== "VirtualType";
        })
        .map((field) => {
          const type = attribute(table, field)["x-ms-dataverse-type"];
          return /^(Lookup|Owner|Customer)Type$/.test(type || "") &&
            !field.startsWith("_")
            ? `_${field}_value`
            : field;
        }),
    ),
  ];
}
export function choiceOptions(
  table: string,
  field: string,
): Record<string, string> {
  const a = attribute(table, field);
  return Object.fromEntries(
    (a?.["x-ms-enum-values"] || []).map((value, index) => [
      String(value),
      a.enum?.[index] || "Label unavailable",
    ]),
  );
}
export function guid(value: unknown): string {
  const id = String(value ?? "")
    .replace(/[{}]/g, "")
    .toLowerCase();
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id))
    throw new Error("Invalid record identifier");
  return id;
}
export function binding(
  table: string,
  field: string,
  target: string,
  id: string,
) {
  const a = attribute(table, field);
  if (!a || a["x-ms-dataverse-type"] !== "LookupType" || !a["x-ms-schema-name"])
    throw new Error(`Unverified lookup ${table}.${field}`);
  return {
    [`${a["x-ms-schema-name"]}@odata.bind`]: `/${entitySet(target)}(${guid(id)})`,
  };
}
export const physicalQuestions = [
  ["and_didyoureceivethedischargesummary", "Received the discharge summary?"],
  ["and_didyoureceiveyourhomemedications", "Received home medications?"],
  ["and_doyouhaveafollowupappointment", "Has a follow-up appointment?"],
] as const;
