import { useState } from "react";
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

const PAGE_SIZE = 20;

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "...", total];
  }
  if (current >= total - 3) {
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, "...", current - 1, current, current + 1, "...", total];
}

export function EarlyDischargePage({
  revision,
  open,
}: {
  revision: number;
  open: (draft: Draft) => void;
}) {
  const resource = useResource(() => earlyDischargeService.list(), [revision]);
  const [page, setPage] = useState(1);

  const drafts = resource.data || [];
  const totalPages = Math.max(1, Math.ceil(drafts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, drafts.length);
  const pagedDrafts = drafts.slice(startIndex, endIndex);

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
        <div id="earlyList" className="section-surface" style={{ padding: 0, overflow: "hidden" }}>
          {!drafts.length ? (
            <div className="empty-state">
              No Early Discharge drafts are available.
            </div>
          ) : (
            <>
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
                  {pagedDrafts.map((d) => (
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

              <div className="pagination-bar" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0, borderBottom: 0, marginTop: 0 }}>
                <div className="pagination-info">
                  Showing {startIndex + 1}–{endIndex} of {drafts.length} drafts
                  <span className="pagination-badge">20 per page</span>
                </div>
                <div className="pagination-controls">
                  <button
                    className="page-btn nav-btn"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(1)}
                    title="First Page"
                  >
                    « First
                  </button>
                  <button
                    className="page-btn nav-btn"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    title="Previous Page"
                  >
                    ‹ Previous
                  </button>

                  <div className="page-numbers">
                    {getPageNumbers(currentPage, totalPages).map((p, idx) =>
                      p === "..." ? (
                        <span key={`ellipsis-${idx}`} className="page-ellipsis">
                          ...
                        </span>
                      ) : (
                        <button
                          key={p}
                          className={`page-btn num-btn ${currentPage === p ? "active" : ""}`}
                          onClick={() => setPage(Number(p))}
                        >
                          {p}
                        </button>
                      )
                    )}
                  </div>

                  <button
                    className="page-btn nav-btn"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    title="Next Page"
                  >
                    Next ›
                  </button>
                  <button
                    className="page-btn nav-btn"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage(totalPages)}
                    title="Last Page"
                  >
                    Last »
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
