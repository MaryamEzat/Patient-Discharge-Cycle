import type { Activity } from "../services/activityService";
import {
  displayChoice,
  displayDateTime,
  displayValue,
} from "../presentation/format";
import { tables } from "../config/schema";
import { StatusBadge } from "./StatusBadge";
import { RecordLink } from "./RecordLink";
export function DischargeState({ activity }: { activity?: Activity }) {
  return (
    <div className="current-activity">
      {activity ? (
        <>
          <div className="activity-head">
            <div>
              <div className="panel-label">Current Activity</div>
              <div className="activity-title">{activity.crad2_subject}</div>
              <div className="small">
                {displayChoice(activity, tables.activity, "crad2_statge")}
              </div>
            </div>
            <div className="activity-actions-wrap">
              <StatusBadge
                label={displayChoice(activity, tables.activity, "crad2_status")}
              />
              <RecordLink
                table={tables.activity}
                id={activity.crad2_dischargeactivityid}
              >
                Open Activity Form
              </RecordLink>
            </div>
          </div>
          <div className="activity-meta">
            <span>Owner: {displayValue(activity, "_ownerid_value")}</span>
            <span>Started: {displayDateTime(activity, "and_startdate")}</span>
          </div>
        </>
      ) : (
        <div className="small">No current activity</div>
      )}
    </div>
  );
}
