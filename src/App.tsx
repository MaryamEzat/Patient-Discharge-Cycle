import { useEffect, useRef, useState } from "react";
import { AppShell } from "./components/AppShell";
import type { Page } from "./components/NavigationRail";
import { useProgressiveDischarges } from "./hooks/useProgressiveDischarges";
import type { DischargeView, Filters } from "./services/dischargeService";
import { useDelayedDischarges } from "./hooks/useDelayedDischarges";
import { WorklistPage } from "./pages/WorklistPage";
import { PatientWorkspacePage } from "./pages/PatientWorkspacePage";
import { EarlyDischargePage } from "./pages/EarlyDischargePage";
import { EarlyDraftPage } from "./pages/EarlyDraftPage";
import { useScope } from "./scope/ScopeContext";
import type { Scope } from "./scope/scope";

const emptyFilters = (): Filters => ({
  search: "",
  status: "",
  dischargeDate: "",
  businessUnit: "",
  unit: "",
  dischargeType: "",
  dateFrom: "",
  dateTo: "",
});

export default function App() {
  const { value: scope } = useScope();
  const previousScope = useRef<Scope | null>(scope);
  const [page, setPage] = useState<Page>("worklist");
  const [patientId, setPatientId] = useState("");
  const [draftId, setDraftId] = useState("");
  const [revision, setRevision] = useState(0);
  const [updated, setUpdated] = useState<Date>(() => new Date());
  const [worklistDirty, setWorklistDirty] = useState(false);
  const [worklistDataRevision, setWorklistDataRevision] = useState(0);
  const [worklistView, setWorklistView] = useState<DischargeView>("all");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [delayedFilters, setDelayedFilters] = useState<Filters>(emptyFilters);

  const progressive = useProgressiveDischarges(filters, scope);
  const delayed = useDelayedDischarges(
    worklistView === "delayed" && scope === "Egypt",
    scope,
  );

  useEffect(() => {
    if (previousScope.current === scope) return;
    previousScope.current = scope;
    setPage("worklist");
    setPatientId("");
    setDraftId("");
    setWorklistView("all");
    setFilters(emptyFilters());
    setDelayedFilters(emptyFilters());
    setRevision((value) => value + 1);
    setWorklistDirty(false);
  }, [scope]);

  useEffect(() => {
    if (page === "worklist" && worklistDirty) {
      setWorklistDirty(false);
      setWorklistDataRevision((value) => value + 1);
      if (worklistView === "delayed") delayed.refresh();
      else progressive.refresh();
    }
  }, [page, worklistDirty, worklistView, delayed, progressive]);

  useEffect(() => {
    if (progressive.rows.length > 0) setUpdated(new Date());
  }, [progressive.rows]);

  const refresh = () => {
    setRevision((v) => v + 1);
    if (page === "worklist") {
      if (worklistView === "delayed") delayed.refresh();
      else progressive.refresh();
    } else setWorklistDirty(true);
  };

  return (
    <AppShell
      page={page}
      navigate={setPage}
      refresh={refresh}
      updated={updated}
      pending={
        progressive.rows.filter((p) => p.crad2_status !== 408520002).length
      }
    >
      <div hidden={page !== "worklist"}>
        <WorklistPage
          view={worklistView}
          dataRevision={worklistDataRevision}
          setView={setWorklistView}
          canViewDelayed={scope === "Egypt"}
          rows={worklistView === "delayed" ? delayed.rows : progressive.rows}
          loading={
            worklistView === "delayed"
              ? delayed.loading
              : progressive.initialTodayLoading
          }
          backgroundLoading={
            worklistView === "delayed"
              ? delayed.refreshing
              : progressive.backgroundHistoryLoading
          }
          statusMessage={
            worklistView === "delayed"
              ? delayed.statusMessage
              : progressive.statusMessage
          }
          error={worklistView === "delayed" ? delayed.error : progressive.error}
          refresh={
            worklistView === "delayed" ? delayed.refresh : progressive.refresh
          }
          filters={worklistView === "delayed" ? delayedFilters : filters}
          setFilters={
            worklistView === "delayed" ? setDelayedFilters : setFilters
          }
          open={(id) => {
            setPatientId(id);
            setPage("patient");
          }}
        />
      </div>
      {page === "patient" ? (
        <PatientWorkspacePage
          key={patientId}
          id={patientId}
          back={() => setPage("worklist")}
          revision={revision}
          onChanged={() => {
            setWorklistDirty(true);
            setUpdated(new Date());
          }}
        />
      ) : page === "early" ? (
        <EarlyDischargePage
          revision={revision}
          open={(d) => {
            setDraftId(d.and_earlydischargeid);
            setPage("draft");
          }}
        />
      ) : page === "draft" ? (
        <EarlyDraftPage
          key={draftId}
          id={draftId}
          revision={revision}
          back={() => {
            setRevision((v) => v + 1);
            setPage("early");
          }}
        />
      ) : null}
    </AppShell>
  );
}
