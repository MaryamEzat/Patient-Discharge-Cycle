import type { And_inpatientlists } from "../generated/models/And_inpatientlistsModel";
import type { Activity } from "./activityService";
import type { Patient } from "./dischargeService";
import { getPatientDisplayData } from "../presentation/reference";
import { displayDateTime, normalizeSubject } from "../presentation/format";
import { egyptBusinessUnitFromEntityId, egyptHospitalNameFromEntityId } from "../scope/scope";
import { getItemOrg } from "./dataverseAdapter";
import { guid, selectFields, tables } from "../config/schema";
import { unwrap } from "./data";

const CLEARED_ACTIVITY = 408520000;
export const COMPLETED_PATIENT_STATUS = 408520002;
const WITH_DUES_YES = 293170000;
const linkedInpatientSelect = selectFields(tables.inpatient, [
  "and_patientname",
  "and_name",
  "and_age",
  "and_bed",
  "and_entrylocation",
  "and_admissiondoctor",
  "and_admissiondate",
  "and_financialdischargedate",
  "and_entityid",
  "and_visitid",
  "and_patienttype",
]);

export interface ExitPermitData {
  businessUnit: string;
  hospitalNameArabic: string;
  patientName: string;
  patientFileNumber: string;
  age: string;
  sex: string;
  height: string;
  weight: string;
  room: string;
  location: string;
  treatingPhysician: string;
  admissionDateTime: string;
  financialStatus: string;
  financialClearanceDateTime: string;
  completionDateTime: string;
  canGenerate: boolean;
}

function latestClearedFinancialActivity(activities: Activity[]) {
  return activities
    .filter(
      (activity) =>
        normalizeSubject(activity.crad2_subject).includes("financial discharge") &&
        activity.crad2_status === CLEARED_ACTIVITY,
    )
    .sort(
      (a, b) =>
        Date.parse(b.crad2_actiondate || "") - Date.parse(a.crad2_actiondate || ""),
    )[0];
}

function latestClearedPhysicalActivity(activities: Activity[]) {
  return activities
    .filter(
      (activity) =>
        normalizeSubject(activity.crad2_subject).includes("physical discharge") &&
        activity.crad2_status === CLEARED_ACTIVITY &&
        activity.crad2_actiondate,
    )
    .sort(
      (a, b) =>
        Date.parse(b.crad2_actiondate || "") - Date.parse(a.crad2_actiondate || ""),
    )[0];
}

export function hasClearedPhysicalDischarge(activities: Activity[]) {
  return Boolean(latestClearedPhysicalActivity(activities));
}

export function isExitPermitPhysicalClearEvent(
  activity: Activity,
  action: string,
  isEgyptPatient: boolean,
) {
  return (
    isEgyptPatient &&
    activity.crad2_status !== CLEARED_ACTIVITY &&
    normalizeSubject(activity.crad2_subject).includes("physical discharge") &&
    action === String(CLEARED_ACTIVITY)
  );
}

export function isExitPermitCompletionEvent(
  previousPatientStatus: number | undefined,
  currentPatientStatus: number | undefined,
  activity: Activity,
  action: string,
  isEgyptPatient: boolean,
) {
  return (
    previousPatientStatus !== COMPLETED_PATIENT_STATUS &&
    currentPatientStatus === COMPLETED_PATIENT_STATUS &&
    isExitPermitPhysicalClearEvent(activity, action, isEgyptPatient)
  );
}

function first(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text && text !== "-") return text;
  }
  return "";
}

function joinDistinct(values: unknown[]) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))].join(" / ");
}

export function formatArabicDateTime(value: unknown) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ar-EG-u-nu-arab", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .replace(/[\u200e\u200f]/g, "")
    .replace("،", "");
}

export function buildExitPermitData(
  patient: Patient,
  activities: Activity[],
  inpatient?: And_inpatientlists,
): ExitPermitData | null {
  const hospitalNameArabic = egyptHospitalNameFromEntityId(patient.new_entityid);
  if (!hospitalNameArabic) return null;

  const display = getPatientDisplayData(patient);
  const financialActivity = latestClearedFinancialActivity(activities);
  const physicalActivity = latestClearedPhysicalActivity(activities);
  const inpatientFinancialDate = inpatient
    ? formatArabicDateTime(inpatient.and_financialdischargedate)
    : "";
  const financialClearanceDateTime = first(
    inpatientFinancialDate,
    financialActivity?.crad2_actiondate
      ? formatArabicDateTime(financialActivity.crad2_actiondate)
      : "",
  );
  const hasFinancialClearance = Boolean(financialActivity || inpatientFinancialDate);
  const canGenerate = Boolean(
    patient.crad2_status === COMPLETED_PATIENT_STATUS &&
      physicalActivity?.crad2_actiondate &&
      hasFinancialClearance,
  );
  const room = first(display.bed, inpatient?.and_bed);
  const location = joinDistinct([
    display.location,
    display.room,
    display.bed,
    display.floor,
    display.nurseStation,
    inpatient?.and_entrylocation,
    inpatient?.and_bed,
  ]);

  return {
    businessUnit: egyptBusinessUnitFromEntityId(patient.new_entityid),
    hospitalNameArabic,
    patientName: first(display.patientName, inpatient?.and_patientname),
    patientFileNumber: first(display.patientId, display.patientCode, display.visitId, inpatient?.and_name),
    age: first(display.age, inpatient?.and_age),
    sex: display.gender,
    height: "",
    weight: "",
    room,
    location,
    treatingPhysician: first(display.physician),
    admissionDateTime: first(
      display.admissionDate,
      inpatient ? displayDateTime(inpatient, "and_admissiondate", "") : "",
    ),
    financialStatus: hasFinancialClearance
      ? financialActivity?.cr301_withdues === WITH_DUES_YES
        ? "Cleared with Dues"
        : "Cleared"
      : "",
    financialClearanceDateTime,
    completionDateTime:
      physicalActivity?.crad2_actiondate
        ? formatArabicDateTime(physicalActivity.crad2_actiondate)
        : "",
    canGenerate,
  };
}

async function loadLinkedInpatient(patient: Patient) {
  // The verified and_patientcode lookup belongs to the AHJ architecture.
  // Egypt permits must not use that GUID against the AHJ inpatient table.
  if (egyptBusinessUnitFromEntityId(patient.new_entityid)) return undefined;
  const id = patient._and_patientcode_value;
  if (!id) return undefined;
  try {
    return unwrap(
      await getItemOrg<And_inpatientlists>(tables.inpatient, guid(id), {
        select: linkedInpatientSelect,
      }),
      "Loading Exit Permit patient details",
    );
  } catch (error) {
    console.warn("Unable to load linked inpatient details for the Exit Permit.", error);
    return undefined;
  }
}

export async function loadExitPermitData(patient: Patient, activities: Activity[]) {
  const inpatient = await loadLinkedInpatient(patient);
  return buildExitPermitData(patient, activities, inpatient);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function valueCell(value: string) {
  return value ? `<bdi dir="auto">${escapeHtml(value)}</bdi>` : "&nbsp;";
}

export function buildExitPermitHtml(
  data: ExitPermitData,
  logoUrl = "assets/andalusia-hospitals-bw.png",
) {
  const clearanceTime = data.financialClearanceDateTime
    ? valueCell(data.financialClearanceDateTime)
    : "<span class=\"writing-space short\"></span>";
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Exit Permit - ${escapeHtml(data.patientName)}</title>
  <style>
    @page { size: A5 landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #ececec; color: #111; }
    body { font-family: Tahoma, Arial, "Noto Naskh Arabic", sans-serif; }
    .preview-toolbar { direction: ltr; width: 194mm; margin: 12px auto; display: flex; gap: 8px; justify-content: flex-end; }
    .preview-toolbar button { border: 1px solid #184f48; background: #fff; color: #184f48; padding: 8px 18px; font: 600 13px Arial, sans-serif; cursor: pointer; }
    .preview-toolbar .primary { background: #184f48; color: #fff; }
    .permit { width: 194mm; min-height: 132mm; margin: 0 auto 12px; background: #fff; border: 1.2px solid #111; padding: 4mm; overflow: hidden; }
    .permit-header { height: 24mm; display: grid; grid-template-columns: 48mm 1fr 50mm; direction: ltr; border-bottom: 1px solid #111; }
    .logo-area { border-left: 1px solid #111; display: flex; justify-content: center; align-items: center; padding: 1mm; overflow: hidden; }
    .logo-area img { display: block; max-width: 46mm; max-height: 21mm; object-fit: contain; filter: grayscale(1) contrast(1.2); }
    .permit-title { direction: rtl; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; }
    .permit-title small { margin-top: 1mm; font: 600 10px Arial, sans-serif; }
    .hospital { direction: rtl; border-right: 1px solid #111; display: flex; flex-direction: column; justify-content: center; align-items: center; font-size: 15px; font-weight: 700; text-align: center; }
    .hospital small { direction: ltr; margin-top: 1mm; font: 700 10px Arial, sans-serif; }
    .permit-content { display: grid; grid-template-columns: 72mm 1fr; direction: ltr; min-height: 98mm; }
    .patient-information { border-right: 1px solid #111; padding: 3mm; direction: ltr; }
    .section-label { margin: 0 0 2mm; text-align: center; font: 700 11px Arial, sans-serif; text-transform: uppercase; letter-spacing: .2px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; font: 9px/1.25 Arial, sans-serif; }
    th, td { border: 1px solid #333; padding: 1.3mm 1.5mm; height: 8mm; vertical-align: middle; overflow-wrap: anywhere; }
    th { width: 38%; text-align: left; font-weight: 700; background: #fff; }
    td { text-align: left; }
    .exit-copy { direction: rtl; text-align: right; padding: 4mm 5mm 3mm; font-size: 12px; line-height: 1.9; }
    .exit-heading { font-size: 14px; font-weight: 700; text-align: center; margin-bottom: 3mm; }
    .arabic-line { display: flex; align-items: baseline; gap: 2mm; margin: 1.4mm 0; }
    .arabic-line .label { white-space: nowrap; }
    .writing-space { display: inline-block; min-width: 40mm; min-height: 5mm; border-bottom: 1px dotted #111; padding: 0 2mm; text-align: center; line-height: 1.4; overflow-wrap: anywhere; }
    .writing-space.short { min-width: 25mm; }
    .clearance-line { margin-top: 2mm; line-height: 1.8; }
    .warning-line { text-align: center; font-weight: 700; margin: 3mm 0 2mm; }
    .permit-footer { margin-top: 4mm; display: grid; grid-template-columns: 1fr 1fr; gap: 14mm; align-items: end; }
    .signature { text-align: center; min-height: 25mm; display: flex; flex-direction: column; justify-content: flex-end; }
    .signature-line { border-top: 1px solid #111; padding-top: 1.5mm; }
    .stamp-space { min-height: 25mm; border: 1px solid #777; display: flex; align-items: flex-end; justify-content: center; padding: 1.5mm; color: #555; font-size: 9px; }
    @media print {
      html, body { background: #fff; width: auto; height: auto; }
      .preview-toolbar { display: none !important; }
      .permit { margin: 0; break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="preview-toolbar">
    <button type="button" onclick="window.close()">Close</button>
    <button type="button" class="primary" onclick="window.print()">Print Exit Permit</button>
  </div>
  <main class="permit" aria-label="Egypt Exit Permit">
    <header class="permit-header">
      <div class="hospital">${escapeHtml(data.hospitalNameArabic)}<small>${escapeHtml(data.businessUnit)}</small></div>
      <div class="permit-title">تصريح خروج<small>EXIT PERMIT</small></div>
      <div class="logo-area"><img src="${escapeHtml(logoUrl)}" alt="Andalusia Hospitals"></div>
    </header>
    <div class="permit-content">
      <section class="patient-information" aria-label="Patient information">
        <h2 class="section-label">Patient Information</h2>
        <table>
          <tr><th>Patient</th><td>${valueCell(data.patientName)}</td></tr>
          <tr><th>Age</th><td>${valueCell(data.age)}</td></tr>
          <tr><th>Sex</th><td>${valueCell(data.sex)}</td></tr>
          <tr><th>Height</th><td>${valueCell(data.height)}</td></tr>
          <tr><th>Weight</th><td>${valueCell(data.weight)}</td></tr>
          <tr><th>Location</th><td>${valueCell(data.location)}</td></tr>
          <tr><th>Treating Physician</th><td>${valueCell(data.treatingPhysician)}</td></tr>
          <tr><th>Admission Date Time</th><td>${valueCell(data.admissionDateTime)}</td></tr>
          <tr><th>Financial Status</th><td>${valueCell(data.financialStatus)}</td></tr>
        </table>
      </section>
      <section class="exit-copy" aria-label="Exit Permit content">
        <div class="exit-heading">المكاتب الأمامية</div>
        <div class="arabic-line"><span class="label">خروج للسيد / السيدة:</span><span class="writing-space">${valueCell(data.patientName)}</span></div>
        <div class="arabic-line"><span class="label">الغرفة:</span><span class="writing-space">${valueCell(data.room)}</span></div>
        <div class="arabic-line"><span class="label">ملف رقم:</span><span class="writing-space">${valueCell(data.patientFileNumber)}</span></div>
        <div class="clearance-line">بالخروج حيث إنه تمت المحاسبة وسددت كامل القيمة اليوم الساعة: ${clearanceTime}</div>
        <div class="warning-line">ولذا يصرح له / لها بالخروج</div>
        <div class="arabic-line"><span class="label">تحريراً في:</span><span class="writing-space">${valueCell(data.completionDateTime)}</span></div>
        <div class="permit-footer">
          <div class="stamp-space" aria-label="Manual stamp area"></div>
          <div class="signature"><div class="signature-line">موظف الحسابات</div></div>
        </div>
      </section>
    </div>
  </main>
</body>
</html>`;
}

export function openExitPermitPreview(data: ExitPermitData, preview?: Window | null) {
  const target = preview || window.open("", "_blank", "popup=yes,width=1100,height=800");
  if (!target) throw new Error("Allow pop-ups to open the Exit Permit preview.");
  target.document.open();
  const logoUrl = new URL("assets/andalusia-hospitals-bw.png", document.baseURI).href;
  target.document.write(buildExitPermitHtml(data, logoUrl));
  target.document.close();
  target.focus();
}

export function openPreparingExitPermitWindow() {
  const preview = window.open("", "_blank", "popup=yes,width=1100,height=800");
  if (!preview) return null;
  preview.document.write("<!doctype html><html><head><meta charset=\"utf-8\"><title>Preparing Exit Permit</title></head><body style=\"font-family:Arial,sans-serif;padding:32px\">Preparing Exit Permit…</body></html>");
  preview.document.close();
  return preview;
}

export const exitPermitService = { load: loadExitPermitData };
