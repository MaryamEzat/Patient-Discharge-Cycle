import { currentActivity, type Activity } from "../services/activityService";
import {
  displayChoice,
  displayDateTime,
  displayValue,
  firstDisplayDateTime,
  truthy,
} from "../presentation/format";
import { tables } from "../config/schema";

export function ActivityTimeline({
  activities,
  compact = false,
}: {
  activities: Activity[];
  compact?: boolean;
}) {
  const current = currentActivity(activities);
  if (!activities.length)
    return <div className="empty-state">No discharge activities found.</div>;

  if (compact)
    return (
      <div className="steps-subgrid">
        <div className="steps-list">
          {activities.map((a, i) => (
            <div className="step-card" key={a.crad2_dischargeactivityid}>
              <div className="step-index">{i + 1}</div>
              <div>
                <div className="step-main-title">{a.crad2_subject}</div>
                <div className="step-main-sub">
                  {displayValue(a, "_ownerid_value")}
                </div>
              </div>
              <div className="step-meta">
                {displayChoice(a, tables.activity, "crad2_status")}
                <span className="small">
                  {a.crad2_status === 408520000
                    ? firstDisplayDateTime(a, ["crad2_actiondate", "modifiedon", "and_startdate"])
                    : displayDateTime(a, "and_startdate")}
                </span>
              </div>
              <div className="step-detail-grid">
                {[
                  ["Comment", displayValue(a, "new_comment")],
                  ["Delay Reason", displayValue(a, "_and_delayreason_value")],
                  [
                    a.crad2_status === 408520000 ? "Clearance Date" : "Start Date",
                    a.crad2_status === 408520000
                      ? firstDisplayDateTime(a, ["crad2_actiondate", "modifiedon", "and_startdate"])
                      : displayDateTime(a, "and_startdate"),
                  ],
                  ["Pending Date", displayDateTime(a, "crda1_pendingdate")],
                ].map(([label, value]) => (
                  <div className="step-detail" key={label}>
                    <strong>{label}</strong>
                    {value}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="steps-footer">Rows: {activities.length}</div>
      </div>
    );

  return (
    <>
      <div className="panel-label">Workflow Timeline</div>
      <div className="timeline-steps">
        {activities.map((a) => (
          <div
            key={a.crad2_dischargeactivityid}
            className={`timeline-node node-${a.crad2_status === 408520000 ? "completed" : a === current ? "current" : truthy(a.and_isdelayed) ? "delayed" : "pending"}`}
          >
            <div className="node-dot" />
            <div className="timeline-title">{a.crad2_subject}</div>
            <div className="timeline-meta">
              {displayChoice(a, tables.activity, "crad2_statge")} |{" "}
              {displayValue(a, "_ownerid_value")}
            </div>
            <div className="timeline-meta">
              {displayChoice(a, tables.activity, "crad2_status")} |{" "}
              {a.crad2_status === 408520000
                ? firstDisplayDateTime(a, ["crad2_actiondate", "modifiedon", "and_startdate"])
                : displayDateTime(a, "and_startdate")}
            </div>
            <div className="timeline-meta">
              Previous Activity:{" "}
              {displayValue(a, "_crad2_previousactivity_value")}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
