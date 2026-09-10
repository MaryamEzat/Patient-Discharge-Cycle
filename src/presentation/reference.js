import { CONFIG } from "../config/reference";
import {
  displayValue,
  displayChoice,
  displayDateTime,
  firstDisplayValue,
  firstDisplayDateTime,
} from "./format";
export function getPatientDisplayData(r) {
  return {
    patientName: displayValue(r, CONFIG.fields.patientName, null, ""),
    reference: displayValue(r, CONFIG.fields.name, null, ""),
    patientId: firstDisplayValue(r, CONFIG.patientAliases.patientId, ""),
    patientCode: firstDisplayValue(r, CONFIG.patientAliases.patientCode, ""),
    visitId: displayValue(r, CONFIG.fields.visitId, null, ""),
    businessUnit: displayValue(r, CONFIG.fields.businessUnit, null, ""),
    modifiedDate: displayDateTime(r, "modifiedon", ""),
    createdDate: displayDateTime(r, CONFIG.fields.createdOn, ""),
    admissionDate: displayDateTime(r, CONFIG.fields.admissionDate, ""),
    age: displayValue(r, CONFIG.fields.age, null, ""),
    room: displayValue(r, CONFIG.fields.room, null, ""),
    bed: displayValue(r, CONFIG.fields.bed, null, ""),
    floor: displayValue(r, CONFIG.fields.floor, null, ""),
    nurseStation: displayValue(r, CONFIG.fields.nurseStation, null, ""),
    physician: displayValue(r, CONFIG.fields.physician, null, ""),
    admissionDoctor: firstDisplayValue(
      r,
      CONFIG.patientFieldAliases.admissionDoctor,
      "",
    ),
    specialty: displayValue(r, CONFIG.fields.specialty, null, ""),
    diagnosis: displayValue(r, CONFIG.fields.diagnosis, null, ""),
    paymentType: displayValue(r, CONFIG.fields.paymentType, null, ""),
    contract: displayValue(r, CONFIG.fields.contract, null, ""),
    contractor: displayValue(r, CONFIG.fields.contractor, null, ""),
    phoneNumber: displayValue(r, CONFIG.fields.phoneNumber, null, ""),
    gender: displayChoice(r, CONFIG.tables.patient, CONFIG.fields.gender, ""),
    dischargeType: displayChoice(
      r,
      CONFIG.tables.patient,
      CONFIG.fields.dischargeType,
      "",
    ),
    earlyFlag: displayChoice(
      r,
      CONFIG.tables.patient,
      CONFIG.fields.earlyFlag,
      "",
    ),
    hasHomeMedications: displayValue(
      r,
      CONFIG.fields.hasHomeMedications,
      null,
      "",
    ),
    homeMedicationTime: displayDateTime(
      r,
      CONFIG.fields.homeMedicationTime,
      "",
    ),
    homeMedicationsDate: displayDateTime(
      r,
      CONFIG.fields.homeMedicationsDate,
      "",
    ),
    homeMedicationsFlag: displayValue(
      r,
      CONFIG.fields.homeMedicationsFlag,
      null,
      "",
    ),
    fileScanStatus: firstDisplayValue(
      r,
      CONFIG.patientFieldAliases.fileScanStatus,
      "",
    ),
    lastActivity:
      displayDateTime(r, CONFIG.fields.lastActivity, "") ||
      displayValue(r, CONFIG.fields.lastActivity, null, ""),
    los: displayValue(r, CONFIG.fields.los, null, ""),
    losDays: displayValue(r, CONFIG.fields.losDays, null, ""),
    outpatientClearanceDate: displayDateTime(
      r,
      CONFIG.fields.outpatientClearanceDate,
      "",
    ),
    outpatientPharmacyPending: displayValue(
      r,
      CONFIG.fields.outpatientPharmacyPending,
      null,
      "",
    ),
    physicalTAT: displayValue(r, CONFIG.fields.physicalTAT, null, ""),
    physicalTATDate: displayDateTime(r, CONFIG.fields.physicalTATDate, ""),
    physicalTATState: displayValue(r, CONFIG.fields.physicalTATState, null, ""),
    physicalDischargeTAT: displayValue(
      r,
      CONFIG.fields.physicalDischargeTAT,
      null,
      "",
    ),
    physicianDischargeDate: firstDisplayDateTime(
      r,
      [
        CONFIG.fields.physicianDischargeDate,
        CONFIG.fields.physicianDischargeDateFormula,
      ],
      "",
    ),
    slaCategory: displayValue(r, CONFIG.fields.slaCategory, null, ""),
    cancellationReason: displayValue(
      r,
      CONFIG.fields.cancellationReason,
      null,
      "",
    ),
    cancelled: displayValue(r, CONFIG.fields.cancelled, null, ""),
    alertFlag: displayValue(r, CONFIG.fields.alertFlag, null, ""),
    smsSendDateTime: displayDateTime(r, CONFIG.fields.smsSendDateTime, ""),
    currentStep: displayValue(r, CONFIG.fields.currentStep, null, ""),
    pendingOn: displayChoice(
      r,
      CONFIG.tables.patient,
      CONFIG.fields.pendingOn,
      "",
    ),
    status: displayChoice(r, CONFIG.tables.patient, CONFIG.fields.status, ""),
    tat: displayValue(r, CONFIG.fields.physicalTAT, null, ""),
    delayed: displayValue(r, CONFIG.fields.isDelayed, null, ""),
  };
}

export function getInpatientDisplayData(row) {
  const f = CONFIG.inpatientFields;
  return {
    id: row[f.id],
    patientCode: displayValue(row, f.name, null, ""),
    patientId:
      displayValue(row, f.patientId, null, "") ||
      displayValue(row, f.name, null, ""),
    patientName: displayValue(row, f.patientName, null, ""),
    visitId: displayValue(row, f.visitId, null, ""),
    room: displayValue(row, f.room, null, ""),
    bed: displayValue(row, f.bed, null, ""),
    nurseStation: firstDisplayValue(
      row,
      CONFIG.inpatientAliases.nurseStation,
      "",
    ),
    physician: displayValue(row, f.physician, null, ""),
    admissionDoctor: firstDisplayValue(
      row,
      CONFIG.inpatientAliases.admissionDoctor,
      "",
    ),
    specialty: displayValue(row, f.specialty, null, ""),
    admissionDate: displayDateTime(row, f.admissionDate, ""),
  };
}

export function getEarlyPatientDisplayData(row) {
  const f = CONFIG.earlyIpdFields;
  const inpatient = row.__inpatient
    ? getInpatientDisplayData(row.__inpatient)
    : {};
  const childName = displayValue(row, f.name, null, "");
  const dateLikeName = /^\d{4}-\d{2}-\d{2}$/.test(childName);
  return {
    id: row[f.id],
    dischargeType: displayChoice(
      row,
      CONFIG.tables.earlyIpd,
      f.dischargeType,
      "",
    ),
    patientCode:
      inpatient.patientCode ||
      firstDisplayValue(row, [f.patientCodeValue], "") ||
      (dateLikeName ? "" : childName),
    patientName: inpatient.patientName || "",
    visitId: displayValue(row, f.visitId, null, "") || inpatient.visitId || "",
    room: inpatient.room || "",
    bed: inpatient.bed || "",
    nurseStation: inpatient.nurseStation || "",
    physician: inpatient.physician || "",
    admissionDoctor: inpatient.admissionDoctor || "",
    specialty: inpatient.specialty || "",
    admissionDate: inpatient.admissionDate || "",
    cancellationReason: displayValue(row, f.cancellationReason, null, ""),
    isSubmitted: displayValue(row, f.isSubmitted, null, ""),
  };
}
