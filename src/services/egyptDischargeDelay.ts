import type { Patient } from "./dischargeService";
import { activityRules, type Activity } from "./activityService";
import { displayValue } from "../presentation/format";
import { egyptBusinessUnitFromEntityId } from "../scope/scope";

const ACTIVE_PATIENT_STATUSES = new Set([408520000, 408520001]);
const EGYPT_TIME_ZONE = "Africa/Cairo";

export type EgyptDischargeType = "early" | "planned";

function dischargeType(patient: Patient): EgyptDischargeType | null {
  const value = String(patient.and_dischargetype ?? "")
    .trim()
    .toLowerCase();
  if (value === "1" || value === "early") return "early";
  if (value === "2" || value === "planned") return "planned";
  return null;
}

function cairoParts(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EGYPT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const number = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: number("year"),
    month: number("month"),
    day: number("day"),
    hour: number("hour"),
    minute: number("minute"),
  };
}

function localMinuteKey(parts: NonNullable<ReturnType<typeof cairoParts>>) {
  return (
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) /
    60000
  );
}

// crad2_dischargedate holds hospital wall-clock time labelled as UTC; the
// and_physiciandischargedate formula column is its corrected UTC value.
export function applicableDischargeDate(patient: Patient) {
  return patient.and_physiciandischargedate || patient.crad2_dischargedate || "";
}

export function egyptDischargeDelayState(
  patient: Patient,
  now = new Date(),
) {
  const type = dischargeType(patient);
  const date = cairoParts(applicableDischargeDate(patient));
  const current = cairoParts(now);
  const isEgypt = Boolean(egyptBusinessUnitFromEntityId(patient.new_entityid));
  const isActive = ACTIVE_PATIENT_STATUSES.has(Number(patient.crad2_status));

  if (!isEgypt || !isActive || !type || !date || !current) {
    return {
      dischargeType: type,
      isClinicalDischargeDelayed: false,
      isPhysicalDischargeDelayReasonRequired: false,
    };
  }

  const clinicalHour = type === "early" ? 10 : 16;
  const physicalHour = type === "early" ? 12 : 18;
  const physicalMinute = type === "early" ? 30 : 0;
  const currentKey = localMinuteKey(current);
  const dateKey = localMinuteKey({ ...date, hour: 0, minute: 0 });

  return {
    dischargeType: type,
    isClinicalDischargeDelayed:
      currentKey >= dateKey + clinicalHour * 60,
    isPhysicalDischargeDelayReasonRequired:
      currentKey >= dateKey + physicalHour * 60 + physicalMinute,
  };
}

/** Delay Reason (and_delayreason) saved on the latest Physical Discharge activity. */
export function physicalDischargeDelayReason(activities: Activity[]) {
  const physical = activities.filter(
    (activity) =>
      activityRules(activity).physical && activity._and_delayreason_value,
  );
  const latest = physical[physical.length - 1];
  return latest ? displayValue(latest, "_and_delayreason_value", null, "") : "";
}
