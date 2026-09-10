import type { Patient } from "../services/dischargeService";
import { getPatientDisplayData } from "../presentation/reference";
import { displayValue } from "../presentation/format";
export function PatientIdentity({ patient }: { patient: Patient }) {
  const p = getPatientDisplayData(patient);
  const rows = [
    ["Discharge Reference", p.reference],
    ["Patient ID", p.patientId],
    ["Patient Code", p.patientCode],
    ["Visit ID", p.visitId],
    ["Created Date", p.createdDate],
    ["Admission Date", p.admissionDate],
    ["Room", p.room],
    ["Bed", p.bed],
    ["Floor", p.floor],
    ["Nurse Station", p.nurseStation],
    ["Physician", p.physician],
    ["Admission Doctor", p.admissionDoctor],
    ["Specialty", p.specialty],
    ["Owner", displayValue(patient, "_ownerid_value")],
    ["Gender", p.gender],
    ["Discharge Type", p.dischargeType],
    ["Early Flag", p.earlyFlag],
    ["Current Step", p.currentStep],
    ["Pending On", p.pendingOn],
    ["Status", p.status],
    ["Delayed", p.delayed],
    ["Physical Discharge TAT", p.tat],
  ];
  return (
    <aside className="patient-summary">
      <div className="summary-title">
        <div className="summary-name">{p.patientName || "Patient"}</div>
        <div className="summary-ref">{p.reference || p.visitId}</div>
      </div>
      {rows.map(([label, value]) => (
        <div className="summary-row" key={label}>
          <div className="summary-label">{label}</div>
          <div className="summary-value">{value || "-"}</div>
        </div>
      ))}
      <details>
        <summary>Additional Patient Details</summary>
        {[
          ["Diagnosis", p.diagnosis],
          ["Phone", p.phoneNumber],
          ["Payment Type", p.paymentType],
          ["Contract", p.contract],
          ["Contractor", p.contractor],
          ["Physician Discharge Date", p.physicianDischargeDate],
          ["Modified Date", p.modifiedDate],
        ].map(([label, value]) => (
          <div className="summary-row" key={label}>
            <div className="summary-label">{label}</div>
            <div className="summary-value">{value || "-"}</div>
          </div>
        ))}
      </details>
    </aside>
  );
}
