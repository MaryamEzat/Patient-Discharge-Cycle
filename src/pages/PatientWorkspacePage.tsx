import { useEffect, useRef, useState } from "react";
import {
  captureDischargeWorkflowState,
  pollDischargeWorkflow,
  workflowSignal,
} from "../services/workflowPollingService";
import {
  activityService,
  buildActivityPayload,
  currentActivity,
  type ActivityInput,
} from "../services/activityService";
import { tables } from "../config/schema";
import { useResource } from "../hooks/useResource";
import { PatientIdentity } from "../components/PatientIdentity";
import { DischargeState } from "../components/DischargeState";
import { ActivityTimeline } from "../components/ActivityTimeline";
import { ActivityPanel } from "../components/ActivityPanel";
import { AlertsPanel } from "../components/AlertsPanel";
import { LoadingState } from "../components/LoadingState";
import { ErrorState, errorMessage } from "../components/ErrorState";
import { RecordLink } from "../components/RecordLink";
import { Modal } from "../components/Modal";
export function PatientWorkspacePage({
  id,
  back,
  revision,
  onChanged,
}: {
  id: string;
  back: () => void;
  revision: number;
  onChanged: () => void;
}) {
  const resource = useResource(
    () => captureDischargeWorkflowState(id),
    [id, revision],
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [formVersion, setFormVersion] = useState(0);
  const cancellation = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => cancellation.current?.abort(), [id]);
  const active = resource.data && currentActivity(resource.data.activities);
  async function save(input: ActivityInput) {
    if (!active || busy) return;
    const controller = new AbortController();
    cancellation.current?.abort();
    cancellation.current = controller;
    setBusy(true);
    let saved = false;
    try {
      buildActivityPayload(active, input);
      const before = await captureDischargeWorkflowState(id);
      controller.signal.throwIfAborted();
      await activityService.save(active, input);
      saved = true;
      onChanged();
      setMessage("Loading...");
      await new Promise((r) => setTimeout(r, 500));
      controller.signal.throwIfAborted();
      const baseline = await captureDischargeWorkflowState(id);
      controller.signal.throwIfAborted();
      resource.setData(baseline);
      if (
        workflowSignal(before, active.crad2_dischargeactivityid) !==
        workflowSignal(baseline, active.crad2_dischargeactivityid)
      ) {
        setMessage("");
      } else {
        const result = await pollDischargeWorkflow(
          id,
          baseline,
          active.crad2_dischargeactivityid,
          resource.setData,
          controller.signal,
        );
        setMessage(
          result.changed
            ? ""
            : result.failures
              ? "Activity saved. Some workflow refreshes failed. Refresh to check the current state."
              : "Activity saved. Workflow update is still processing.",
        );
      }
      setFormVersion((v) => v + 1);
      onChanged();
    } catch (e) {
      if (!controller.signal.aborted) {
        console.error("Activity operation failed", e);
        setMessage(
          saved
            ? "Activity saved, but the latest workflow state could not be loaded. Refresh before making another update."
            : errorMessage(e),
        );
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  if (resource.loading && !resource.data)
    return <LoadingState message="Loading patient workspace..." />;
  if (resource.error)
    return <ErrorState error={resource.error} retry={resource.refresh} />;
  const snapshot = resource.data;
  if (!snapshot) return null;
  return (
    <section className="patient-panel">
      <div className="patient-header-bar">
        <div className="patient-header-top">
          <button className="btn-back" disabled={busy} onClick={back}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            <span>Back to Worklist</span>
          </button>
          <RecordLink className="btn-outline-modern" table={tables.patient} id={id}>
            <span>Open Full Record</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </RecordLink>
        </div>
        <div className="patient-title-block">
          <h1 className="patient-name">{snapshot.parent.crad2_patientname || "Patient Workspace"}</h1>
          <div className="patient-meta-badges">
            {snapshot.parent.new_patientid && (
              <span className="meta-badge">MRN: <strong>{snapshot.parent.new_patientid}</strong></span>
            )}
            {snapshot.parent.crad2_visitid && (
              <span className="meta-badge">Visit: <strong>{snapshot.parent.crad2_visitid}</strong></span>
            )}
            {snapshot.parent.crad2_dischargereference && (
              <span className="meta-badge">Ref: <strong>{snapshot.parent.crad2_dischargereference}</strong></span>
            )}
          </div>
        </div>
      </div>
      <div className="patient-body">
        <PatientIdentity patient={snapshot.parent} />
        <section className="patient-main">
          <DischargeState activity={active} />
          <div className="timeline">
            <ActivityTimeline activities={snapshot.activities} />
          </div>
          {active ? (
            <ActivityPanel
              key={`${active.crad2_dischargeactivityid}-${active.modifiedon || ""}-${formVersion}-${revision}`}
              activity={active}
              onSave={save}
              busy={busy}
              refresh={resource.refresh}
            />
          ) : (
            <div className="activity-form">No activity selected.</div>
          )}
          <AlertsPanel patient={snapshot.parent} revision={revision} />
        </section>
      </div>
      {message && (
        <Modal
          title={busy ? "Updating Activity" : "Activity Saved"}
          close={busy ? undefined : () => setMessage("")}
        >
          {busy ? (
            <LoadingState
              message={message}
              subtitle="Writing updates to Dataverse and refreshing workflow status..."
            />
          ) : (
            <div className="modal-result">
              <p className="small" style={{ marginBottom: "16px" }}>{message}</p>
              <div className="form-actions">
                <button
                  className="btn-primary"
                  onClick={() => {
                    setMessage("");
                    resource.refresh();
                  }}
                >
                  Refresh View
                </button>
                <button className="btn-outline-modern" onClick={() => setMessage("")}>
                  Close
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}
