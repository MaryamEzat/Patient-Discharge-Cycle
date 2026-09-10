import { useMemo, useState } from "react";
import type { Patient } from "../services/dischargeService";
import { alertService } from "../services/alertService";
import { tables } from "../config/schema";
import {
  displayValue,
  displayChoice,
  displayDateTime,
} from "../presentation/format";
import { useResource } from "../hooks/useResource";
import { LoadingState } from "./LoadingState";
import { ErrorState, errorMessage } from "./ErrorState";
import { RecordLink } from "./RecordLink";
import { Modal } from "./Modal";

export function AlertsPanel({
  patient,
  revision,
}: {
  patient: Patient;
  revision: number;
}) {
  const alerts = useResource(
    () => alertService.list(patient.crad2_patientdischargeid),
    [patient.crad2_patientdischargeid, revision],
  );
  const [create, setCreate] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const defaults = useMemo(
    () => ({
      and_patient: patient.crad2_patientdischargeid,
      and_patientname:
        patient.crad2_patientname || patient.crad2_dischargereference,
      and_patienttype: tables.patient,
    }),
    [
      patient.crad2_patientdischargeid,
      patient.crad2_patientname,
      patient.crad2_dischargereference,
    ],
  );
  async function save() {
    setBusy(true);
    setError("");
    try {
      await alertService.create(patient.crad2_patientdischargeid, comment);
      setCreate(false);
      setComment("");
      alerts.refresh();
    } catch (e) {
      console.error("Alert create failed", e);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="discharge-alerts">
      <div className="subgrid-head">
        <div className="subgrid-title">Discharge Alerts</div>
        <div className="subgrid-actions">
          <button onClick={alerts.refresh}>Refresh</button>
          <RecordLink table={tables.alert} defaults={defaults}>
            Open Form
          </RecordLink>
          <button
            className="btn-primary"
            onClick={() => {
              setError("");
              setCreate(true);
            }}
          >
            + Add Alert
          </button>
        </div>
      </div>
      {alerts.loading ? (
        <LoadingState message="Loading discharge alerts..." />
      ) : alerts.error ? (
        <ErrorState error={alerts.error} retry={alerts.refresh} />
      ) : alerts.data?.length ? (
        <div className="draft-existing">
          <table className="worklist-table">
            <thead>
              <tr>
                {[
                  "Alert",
                  "Comment",
                  "Created On",
                  "Created By",
                  "Status / Severity",
                  "Patient Name",
                  "Patient ID",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alerts.data.map((a) => (
                <tr key={a.and_whatsappnotificationid}>
                  <td>{displayValue(a, "and_id", null, "Discharge Alert")}</td>
                  <td>{a.and_comment}</td>
                  <td>{displayDateTime(a, "createdon")}</td>
                  <td>{displayValue(a, "_createdby_value")}</td>
                  <td>{displayChoice(a, tables.alert, "statuscode")}</td>
                  <td>{patient.crad2_patientname || "-"}</td>
                  <td>{patient.new_patientid || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="subgrid-empty">
          We did not find anything to show here.
        </div>
      )}
      {!alerts.loading && !alerts.error && (
        <div className="small">Rows: {alerts.data?.length || 0}</div>
      )}
      {create && (
        <Modal
          title="Quick Create: Discharge Alert"
          side
          close={busy ? undefined : () => setCreate(false)}
        >
          <div className="quick-create-body">
            <div className="form-row">
              <div className="label">Patient *</div>
              <div className="lookup-pill">
                {patient.crad2_patientname || patient.crad2_dischargereference}
              </div>
            </div>
            <div className="form-row">
              <label className="label" htmlFor="alertComment">
                Comment *
              </label>
              <textarea
                id="alertComment"
                rows={7}
                maxLength={5000}
                placeholder="Enter alert comment"
                disabled={busy}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
            {error && (
              <div role="alert">
                {error}
                <div>
                  <RecordLink table={tables.alert} defaults={defaults}>
                    Open Full Alert Form
                  </RecordLink>
                </div>
              </div>
            )}
            <div className="form-actions">
              <button disabled={busy} onClick={() => setCreate(false)}>
                Cancel
              </button>
              <button
                disabled={busy}
                className="btn-primary"
                onClick={() => void save()}
              >
                {busy ? "Saving..." : "Save Alert"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
