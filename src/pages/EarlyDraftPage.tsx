import { useEffect, useState } from "react";
import {
  earlyDischargeService,
  isSubmitted,
  type Inpatient,
} from "../services/earlyDischargeService";
import { useResource } from "../hooks/useResource";
import {
  displayChoice,
  displayValue,
  displayDateTime,
  firstDisplayDateTime,
} from "../presentation/format";
import {
  getEarlyPatientDisplayData,
  getInpatientDisplayData,
} from "../presentation/reference";
import { tables } from "../config/schema";
import { LoadingState } from "../components/LoadingState";
import { ErrorState, errorMessage } from "../components/ErrorState";
import { StatusBadge } from "../components/StatusBadge";
export function EarlyDraftPage({
  id,
  revision,
  back,
}: {
  id: string;
  revision: number;
  back: () => void;
}) {
  const draft = useResource(
    () => earlyDischargeService.get(id),
    [id, revision],
  );
  const patients = useResource(
    () => earlyDischargeService.children(id),
    [id, revision],
  );
  const [type, setType] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Inpatient[]>([]);
  const [selected, setSelected] = useState<Inpatient>();
  const [searchState, setSearchState] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const submitted = !!draft.data && isSubmitted(draft.data);
  useEffect(() => {
    let active = true;
    setSelected(undefined);
    setResults([]);
    if (!type || query.trim().length < 2 || submitted) return;
    setSearchState("Searching inpatients...");
    const t = setTimeout(
      () =>
        earlyDischargeService
          .search(query.trim())
          .then((rows) => {
            if (active) {
              setResults(rows);
              setSearchState(
                rows.length ? "" : "No matching inpatients found.",
              );
            }
          })
          .catch((e) => {
            console.error("Inpatient search failed", e);
            if (active) setSearchState("Unable to search inpatient list.");
          }),
      350,
    );
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, type, submitted]);
  async function add() {
    if (!selected || !draft.data || busy) return;
    setBusy(true);
    setMessage("");
    let created = false;
    try {
      await earlyDischargeService.add(draft.data, selected, type);
      created = true;
      setSelected(undefined);
      setQuery("");
      setResults([]);
      const rows = await earlyDischargeService.children(id);
      patients.setData(rows);
      draft.refresh();
      setMessage("The inpatient row was added to this Early Discharge draft.");
    } catch (e) {
      console.error("Draft add failed", e);
      setMessage(
        created
          ? "Patient added, but the list or count could not be refreshed. Refresh before adding again."
          : errorMessage(e),
      );
      if (created) patients.refresh();
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await earlyDischargeService.submit(id);
      back();
    } catch (e) {
      console.error("Draft submission failed", e);
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (draft.loading && !draft.data)
    return <LoadingState message="Loading early discharge draft..." />;
  if (draft.error)
    return <ErrorState error={draft.error} retry={draft.refresh} />;
  if (!draft.data) return null;
  const d = draft.data;
  const date = firstDisplayDateTime(d, [
    "and_dischargedate",
    "and_date",
    "createdon",
  ]);
  const status = displayChoice(d, tables.early, "and_statusnew");
  return (
    <section className="patient-panel">
      <div className="patient-header-bar">
        <div className="patient-header-top">
          <button className="btn-back" disabled={busy} onClick={back}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Back to Early Discharges</span>
          </button>
          <div className="patient-header-right">
            <button
              className="btn-outline-modern"
              onClick={draft.refresh}
              disabled={busy}
            >
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
              <span>Refresh Draft</span>
            </button>
          </div>
        </div>
        <div className="patient-title-block">
          <h1 className="patient-name">Early Discharge Draft — {date}</h1>
          <div className="patient-meta-badges">
            <span className="meta-badge">
              Status: <strong>{status}</strong>
            </span>
            <span className="meta-badge">
              Total Patients:{" "}
              <strong>
                {patients.loading ? "..." : (patients.data?.length ?? 0)}
              </strong>
            </span>
            {submitted && (
              <span className="meta-badge">
                Submitted By:{" "}
                <strong>{displayValue(d, "_and_submittedby_value")}</strong>
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="early-workspace">
        <section className="early-draft-overview">
          {[
            ["Status", status],
            [
              "Patients",
              patients.loading ? "..." : String(patients.data?.length ?? 0),
            ],
            ["Created", displayDateTime(d, "createdon")],
            ["Submission", displayDateTime(d, "and_submissiondate")],
            ["Submitted By", displayValue(d, "_and_submittedby_value")],
          ].map(([label, value]) => (
            <div className="early-metric" key={label}>
              <div className="summary-label">{label}</div>
              <div className="summary-value">
                {label === "Status" ? <StatusBadge label={value} /> : value}
              </div>
            </div>
          ))}
          <div className="early-submit-area">
            <button
              className="btn-submit"
              disabled={
                submitted || busy || patients.loading || !!patients.error
              }
              onClick={() => void submit()}
            >
              {busy ? "Please wait..." : "Submit Draft"}
            </button>
          </div>
        </section>
        {message && (
          <div role="status" className="section-surface notice">
            {message}
          </div>
        )}
        <section className="early-draft-layout">
          <div className="early-add-panel">
            <div className="early-panel-head">
              <div>
                <div className="panel-label">Add Patient</div>
                <div className="early-panel-title">Draft Entry</div>
              </div>
              <StatusBadge label={status} />
            </div>
            <div className="draft-form">
              <div className="form-row">
                <label className="label" htmlFor="earlyType">
                  Discharge Type
                </label>
                <select
                  id="earlyType"
                  disabled={submitted || busy}
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value);
                    setQuery("");
                    setSelected(undefined);
                  }}
                >
                  <option value="">Select type</option>
                  <option value="1">Early</option>
                  <option value="2">Planned</option>
                </select>
              </div>
              <div className="form-row">
                <label className="label" htmlFor="earlySearch">
                  Patient Search
                </label>
                <input
                  id="earlySearch"
                  placeholder="Search inpatient by patient code or name"
                  value={query}
                  disabled={submitted || busy || !type}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="draft-patient-list">
                {submitted ? (
                  <div className="small">Submitted drafts are read-only.</div>
                ) : !type ? (
                  <div className="small">
                    Select a discharge type to enable patient search.
                  </div>
                ) : query.trim().length < 2 ? (
                  <div className="small">
                    Type at least 2 characters to search.
                  </div>
                ) : searchState ? (
                  <div className="small">{searchState}</div>
                ) : (
                  results.map((row) => {
                    const p = getInpatientDisplayData(row);
                    return (
                      <button
                        type="button"
                        key={row.and_inpatientlistid}
                        disabled={busy}
                        className={`patient-result ${selected?.and_inpatientlistid === row.and_inpatientlistid ? "selected" : ""}`}
                        onClick={() => setSelected(row)}
                      >
                        <div className="name">
                          {p.patientName || p.patientCode}
                        </div>
                        <div className="meta">
                          Patient ID: {p.patientId} | Visit: {p.visitId} |{" "}
                          {p.room} / {p.bed}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              {selected && (
                <div className="small">
                  {selected.and_patientname || selected.and_name} selected
                </div>
              )}
              <div className="form-actions">
                <button
                  className="btn-primary"
                  disabled={
                    submitted ||
                    busy ||
                    !selected ||
                    !type ||
                    patients.loading ||
                    !!patients.error
                  }
                  onClick={() => void add()}
                >
                  Add Patient
                </button>
              </div>
            </div>
          </div>
          <div className="early-patient-panel">
            <div className="early-panel-head">
              <div>
                <div className="panel-label">Patients In Draft</div>
                <div className="early-panel-title">Draft Patient List</div>
              </div>
              <button onClick={patients.refresh} disabled={busy}>
                Refresh
              </button>
            </div>
            {patients.loading ? (
              <LoadingState message="Loading patients..." />
            ) : patients.error ? (
              <ErrorState error={patients.error} retry={patients.refresh} />
            ) : !patients.data?.length ? (
              <div className="small">
                No patients have been added to this draft.
              </div>
            ) : (
              <div className="draft-existing">
                <table className="worklist-table">
                  <thead>
                    <tr>
                      {[
                        "Discharge Type",
                        "Patient Code",
                        "Patient Name",
                        "Visit ID",
                        "Room",
                        "Bed",
                        "Nurse Station",
                        "Physician",
                        "Admission Doctor",
                        "Specialty",
                        "Admission Date",
                        "Cancellation Reason",
                        "Submitted",
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {patients.data.map((row) => {
                      const p = getEarlyPatientDisplayData(row) as Record<
                        string,
                        string
                      >;
                      return (
                        <tr key={row.and_earlydischarge_ipdvisitsid}>
                          {[
                            "dischargeType",
                            "patientCode",
                            "patientName",
                            "visitId",
                            "room",
                            "bed",
                            "nurseStation",
                            "physician",
                            "admissionDoctor",
                            "specialty",
                            "admissionDate",
                            "cancellationReason",
                            "isSubmitted",
                          ].map((k) => (
                            <td key={k}>{p[k] || "-"}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
