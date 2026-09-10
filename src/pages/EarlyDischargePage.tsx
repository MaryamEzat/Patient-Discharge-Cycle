import { useResource } from "../hooks/useResource";
import {
  earlyDischargeService,
  type Draft,
} from "../services/earlyDischargeService";
import {
  displayChoice,
  displayValue,
  displayDateTime,
  firstDisplayDateTime,
} from "../presentation/format";
import { tables } from "../config/schema";
import { StatusBadge } from "../components/StatusBadge";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
export function EarlyDischargePage({
  revision,
  open,
}: {
  revision: number;
  open: (draft: Draft) => void;
}) {
  const resource = useResource(() => earlyDischargeService.list(), [revision]);
  return (
    <section className="tab-panel">
      <div id="earlyDraftHeader" className="section-surface">
        <div className="activity-head">
          <div className="activity-title">Active Early Discharges</div>
          <button className="btn-outline-modern" onClick={resource.refresh}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M23 4v6h-6"></path>
              <path d="M1 20v-6h6"></path>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>
      {resource.loading ? (
        <LoadingState message="Loading early discharge drafts..." />
      ) : resource.error ? (
        <ErrorState error={resource.error} retry={resource.refresh} />
      ) : (
        <div id="earlyList">
          {!resource.data?.length ? (
            <div className="empty-state">
              No Early Discharge drafts are available.
            </div>
          ) : (
            <table className="worklist-table">
              <thead>
                <tr>
                  {[
                    "Discharge Date",
                    "Status",
                    "Count Of Patients",
                    "Submission Date",
                    "Submitted By",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resource.data.map((d) => (
                  <tr key={d.and_earlydischargeid} onClick={() => open(d)}>
                    <td>
                      <button
                        className="patient-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          open(d);
                        }}
                      >
                        {firstDisplayDateTime(d, [
                          "and_dischargedate",
                          "and_date",
                          "createdon",
                        ])}
                      </button>
                    </td>
                    <td>
                      <StatusBadge
                        label={displayChoice(d, tables.early, "and_statusnew")}
                      />
                    </td>
                    <td>
                      {displayValue(d, "crda1_countofpatients", null, "0")}
                    </td>
                    <td>{displayDateTime(d, "and_submissiondate")}</td>
                    <td>{displayValue(d, "_and_submittedby_value")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="small row-count">
            Rows: {resource.data?.length || 0}
          </div>
        </div>
      )}
    </section>
  );
}
