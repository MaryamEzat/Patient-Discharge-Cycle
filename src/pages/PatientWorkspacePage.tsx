import { useEffect, useRef, useState } from "react";
import {
  captureDischargeWorkflowState,
  pollDischargeWorkflow,
  workflowSignal,
} from "../services/workflowPollingService";
import {
  activityService,
  activityRules,
  activitySequence,
  buildActivityPayload,
  hasHomeMedicationsActivity,
  HOME_MEDICATION_DISPENSING_YES,
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
import { egyptBusinessUnitFromEntityId } from "../scope/scope";
import { egyptDischargeDelayState } from "../services/egyptDischargeDelay";
import {
  COMPLETED_PATIENT_STATUS,
  exitPermitService,
  hasClearedPhysicalDischarge,
  isExitPermitCompletionEvent,
  isExitPermitPhysicalClearEvent,
  openExitPermitPreview,
  openPreparingExitPermitWindow,
} from "../services/exitPermitService";
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
  const [expectHomeMedications, setExpectHomeMedications] = useState(false);
  const [permitBusy, setPermitBusy] = useState(false);
  const [permitError, setPermitError] = useState("");
  const [completionPermitReady, setCompletionPermitReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const cancellation = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => cancellation.current?.abort(), [id]);
  const isEgyptPatient = Boolean(
    egyptBusinessUnitFromEntityId(resource.data?.parent.new_entityid),
  );
  const physicalDischargeCleared = hasClearedPhysicalDischarge(
    resource.data?.activities || [],
  );
  const patientDischargeCompleted =
    resource.data?.parent.crad2_status === COMPLETED_PATIENT_STATUS;
  const physicalDelayReasonRequired = resource.data
    ? egyptDischargeDelayState(resource.data.parent, currentTime)
        .isPhysicalDischargeDelayReasonRequired
    : false;
  useEffect(() => {
    if (!isEgyptPatient) return;
    setCurrentTime(new Date());
    const timer = window.setInterval(() => setCurrentTime(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, [isEgyptPatient]);
  const sequence = resource.data
    ? activitySequence(
        resource.data.activities,
        expectHomeMedications,
        isEgyptPatient,
      )
    : { current: undefined, waitingForHomeMedications: false };
  const active = sequence.current;
  useEffect(() => {
    if (
      expectHomeMedications &&
      resource.data &&
      hasHomeMedicationsActivity(resource.data.activities)
    )
      setExpectHomeMedications(false);
  }, [expectHomeMedications, resource.data]);
  async function save(input: ActivityInput) {
    if (!active || !resource.data || busy) return;
    const controller = new AbortController();
    cancellation.current?.abort();
    cancellation.current = controller;
    setBusy(true);
    let saved = false;
    const waitForHomeMedications =
      activityRules(active).initiation &&
      input.action === "408520000" &&
      Number(input.homeMedicationDispensingRequired) ===
        HOME_MEDICATION_DISPENSING_YES &&
      isEgyptPatient;
    const isPhysicalCompletionAttempt = isExitPermitPhysicalClearEvent(
      active,
      input.action,
      isEgyptPatient,
    );
    const activityValidation = {
      physicalDelayReasonRequired: egyptDischargeDelayState(
        resource.data.parent,
        new Date(),
      ).isPhysicalDischargeDelayReasonRequired,
      isEgyptPatient,
    };
    try {
      buildActivityPayload(active, input, activityValidation);
      if (waitForHomeMedications) setExpectHomeMedications(true);
      const before = await captureDischargeWorkflowState(id);
      const shouldWaitForCompletion =
        isPhysicalCompletionAttempt &&
        before.parent.crad2_status !== COMPLETED_PATIENT_STATUS;
      controller.signal.throwIfAborted();
      await activityService.save(active, input, activityValidation);
      saved = true;
      onChanged();
      setMessage("Loading...");
      await new Promise((r) => setTimeout(r, 500));
      controller.signal.throwIfAborted();
      const baseline = await captureDischargeWorkflowState(id);
      controller.signal.throwIfAborted();
      resource.setData(baseline);
      let latest = baseline;
      const workflowChanged =
        workflowSignal(before, active.crad2_dischargeactivityid) !==
        workflowSignal(baseline, active.crad2_dischargeactivityid);
      const expectedActivityLoaded =
        !waitForHomeMedications ||
        hasHomeMedicationsActivity(baseline.activities);
      const expectedCompletionLoaded =
        !shouldWaitForCompletion ||
        baseline.parent.crad2_status === COMPLETED_PATIENT_STATUS;
      if (workflowChanged && expectedActivityLoaded && expectedCompletionLoaded) {
        setMessage("");
      } else {
        const result = await pollDischargeWorkflow(
          id,
          baseline,
          active.crad2_dischargeactivityid,
          resource.setData,
          controller.signal,
          waitForHomeMedications || shouldWaitForCompletion
            ? {
                acceptChange: (snapshot) =>
                  waitForHomeMedications
                    ? hasHomeMedicationsActivity(snapshot.activities)
                    : snapshot.parent.crad2_status ===
                      COMPLETED_PATIENT_STATUS,
              }
            : undefined,
        );
        latest = result.snapshot;
        setMessage(
          result.changed
            ? ""
            : result.failures
              ? "Activity saved. Some workflow refreshes failed. Refresh to check the current state."
              : "Activity saved. Workflow update is still processing.",
        );
      }
      if (
        isExitPermitCompletionEvent(
          before.parent.crad2_status,
          latest.parent.crad2_status,
          active,
          input.action,
          isEgyptPatient,
        )
      ) {
        setMessage("");
        setCompletionPermitReady(true);
      }
      setFormVersion((v) => v + 1);
      onChanged();
    } catch (e) {
      if (!controller.signal.aborted) {
        if (!saved && waitForHomeMedications)
          setExpectHomeMedications(false);
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
  async function generateExitPermit() {
    if (!resource.data || permitBusy) return;
    if (
      resource.data.parent.crad2_status !== COMPLETED_PATIENT_STATUS ||
      !hasClearedPhysicalDischarge(resource.data.activities)
    ) {
      setPermitError(
        "The Exit Permit becomes available after Physical Discharge is cleared and the Patient Discharge is completed.",
      );
      return;
    }
    const preview = openPreparingExitPermitWindow();
    if (!preview) {
      setPermitError("Allow pop-ups for this app, then try again.");
      return;
    }
    setPermitBusy(true);
    setPermitError("");
    try {
      const permit = await exitPermitService.load(
        resource.data.parent,
        resource.data.activities,
      );
      if (!permit) {
        preview.close();
        setPermitError("Exit Permits are available only for Egypt cases with Entity ID 1, 2, or 4.");
        return;
      }
      if (!permit.canGenerate) {
        preview.close();
        setPermitError(
          "The completed Patient, Financial, and Physical Discharge state could not be verified. Refresh the record and try again.",
        );
        return;
      }
      openExitPermitPreview(permit, preview);
    } catch (error) {
      preview.close();
      console.error("Exit Permit generation failed", error);
      setPermitError(errorMessage(error));
    } finally {
      setPermitBusy(false);
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
          <div className="patient-header-actions">
            {isEgyptPatient && (
              <button
                type="button"
                className="btn-outline-modern exit-permit-action"
                disabled={
                  busy ||
                  permitBusy ||
                  !physicalDischargeCleared ||
                  !patientDischargeCompleted
                }
                onClick={generateExitPermit}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                <span>{permitBusy ? "Preparing Permit…" : "Generate Exit Permit"}</span>
              </button>
            )}
            <RecordLink className="btn-outline-modern" table={tables.patient} id={id}>
              <span>Open Full Record</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </RecordLink>
          </div>
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
          <DischargeState
            activity={active}
            waitingForHomeMedications={
              sequence.waitingForHomeMedications
            }
          />
          <div className="timeline">
            <ActivityTimeline
              activities={snapshot.activities}
              currentActivityId={
                sequence.waitingForHomeMedications
                  ? null
                  : active?.crad2_dischargeactivityid
              }
            />
          </div>
          {sequence.waitingForHomeMedications ? (
            <div className="activity-form">
              <LoadingState
                message="Waiting for Home Medications Preparation..."
                subtitle="The workflow is creating the required activity. This view will update automatically."
              />
            </div>
          ) : active ? (
            <ActivityPanel
              key={`${active.crad2_dischargeactivityid}-${active.modifiedon || ""}-${formVersion}-${revision}`}
              activity={active}
              onSave={save}
              busy={busy}
              refresh={resource.refresh}
              physicalDelayReasonRequired={physicalDelayReasonRequired}
              isEgyptPatient={isEgyptPatient}
            />
          ) : (
            <div className="activity-form">No activity selected.</div>
          )}
          <AlertsPanel patient={snapshot.parent} revision={revision} />
        </section>
      </div>
      {message && (
        <Modal
          title={
            busy
              ? "Updating Activity"
              : message.toLowerCase().startsWith("activity saved")
                ? "Activity Saved"
                : "Activity Update Failed"
          }
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
      {permitError && (
        <Modal title="Exit Permit Unavailable" close={() => setPermitError("")}>
          <div className="modal-result">
            <p className="small" style={{ marginBottom: "16px" }}>{permitError}</p>
            <div className="form-actions">
              <button className="btn-primary" onClick={() => setPermitError("")}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
      {completionPermitReady && (
        <Modal
          title="Discharge Completed"
          close={() => setCompletionPermitReady(false)}
        >
          <div className="modal-result">
            <p className="small" style={{ marginBottom: "16px" }}>
              The Patient Discharge has completed successfully. The Exit Permit is ready to download.
            </p>
            <div className="form-actions">
              <button
                className="btn-primary"
                onClick={() => {
                  setCompletionPermitReady(false);
                  void generateExitPermit();
                }}
              >
                Download Exit Permit
              </button>
              <button
                className="btn-outline-modern"
                onClick={() => setCompletionPermitReady(false)}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
