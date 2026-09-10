import { dischargeService, type Patient } from "./dischargeService";
import { activityService, type Activity } from "./activityService";
export interface WorkflowSnapshot {
  parent: Patient;
  activities: Activity[];
}
export async function captureDischargeWorkflowState(
  id: string,
): Promise<WorkflowSnapshot> {
  const [parent, activities] = await Promise.all([
    dischargeService.get(id),
    activityService.list(id),
  ]);
  return { parent, activities };
}
export function workflowSignal(snapshot: WorkflowSnapshot, targetId: string) {
  const p = snapshot.parent;
  // Exclude target action writes and modifiedon: a successful PATCH is not backend progression.
  return JSON.stringify({
    parent: [
      p.crad2_status,
      p.crda1_currentstepf,
      p.crad2_pendingon,
      p.ownerid,
      p.owneridname,
      (p as unknown as Record<string, unknown>)._ownerid_value,
    ],
    activities: snapshot.activities
      .map((a) => [
        a.crad2_dischargeactivityid,
        a.crad2_dischargeactivityid === targetId ? "target" : a.crad2_status,
        a.crad2_dischargeactivityid === targetId ? "" : a.crad2_actiondate,
        a.crad2_dischargeactivityid === targetId
          ? ""
          : a._crad2_forwardtoteam_value,
        a.ownerid,
        a.owneridname,
        (a as unknown as Record<string, unknown>)._ownerid_value,
        a.crad2_subject,
        a.crad2_statge,
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  });
}
export async function pollDischargeWorkflow(
  id: string,
  baseline: WorkflowSnapshot,
  targetId: string,
  onSnapshot: (s: WorkflowSnapshot) => void,
  signal: AbortSignal,
  options: {
    intervalMs?: number;
    timeoutMs?: number;
    read?: typeof captureDischargeWorkflowState;
  } = {},
) {
  const read = options.read || captureDischargeWorkflowState;
  const started = Date.now();
  const initial = workflowSignal(baseline, targetId);
  let latest = baseline;
  let failures = 0;
  while (Date.now() - started < (options.timeoutMs ?? 26000)) {
    await new Promise<void>((resolve, reject) => {
      const stop = () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", stop);
        resolve();
      }, options.intervalMs ?? 2000);
      signal.addEventListener("abort", stop, { once: true });
      if (signal.aborted) stop();
    });
    signal.throwIfAborted();
    try {
      latest = await read(id);
      signal.throwIfAborted();
      onSnapshot(latest);
      if (workflowSignal(latest, targetId) !== initial)
        return { changed: true, snapshot: latest, failures };
    } catch (error) {
      if (signal.aborted) throw error;
      failures++;
      console.error("Workflow refresh failed", error);
    }
  }
  return { changed: false, snapshot: latest, failures };
}
