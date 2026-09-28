import { useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import type { Page } from "./components/NavigationRail";
import { useProgressiveDischarges } from "./hooks/useProgressiveDischarges";
import type { Filters } from "./services/dischargeService";
import { WorklistPage } from "./pages/WorklistPage";
import { PatientWorkspacePage } from "./pages/PatientWorkspacePage";
import { EarlyDischargePage } from "./pages/EarlyDischargePage";
import { EarlyDraftPage } from "./pages/EarlyDraftPage";

export default function App() {
  const [page, setPage] = useState<Page>("worklist");
  const [patientId, setPatientId] = useState("");
  const [draftId, setDraftId] = useState("");
  const [revision, setRevision] = useState(0);
  const [updated, setUpdated] = useState<Date>(() => new Date());
  const [worklistDirty, setWorklistDirty] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    status: "",
    dischargeDate: "",
  });

  const progressive = useProgressiveDischarges(filters);

  useEffect(() => {
    if (page === "worklist" && worklistDirty) {
      setWorklistDirty(false);
      progressive.refresh();
    }
  }, [page, worklistDirty, progressive]);

  useEffect(() => {
    if (progressive.rows.length > 0) setUpdated(new Date());
  }, [progressive.rows]);

  const refresh = () => {
    setRevision((v) => v + 1);
    if (page === "worklist") progressive.refresh();
    else setWorklistDirty(true);
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
      {page === "worklist" ? (
        <WorklistPage
          rows={progressive.rows}
          loading={progressive.initialTodayLoading}
          backgroundLoading={progressive.backgroundHistoryLoading}
          statusMessage={progressive.statusMessage}
          error={progressive.error}
          refresh={progressive.refresh}
          filters={filters}
          setFilters={setFilters}
          open={(id) => {
            setPatientId(id);
            setPage("patient");
          }}
        />
      ) : page === "patient" ? (
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
      ) : (
        <EarlyDraftPage
          key={draftId}
          id={draftId}
          revision={revision}
          back={() => {
            setRevision((v) => v + 1);
            setPage("early");
          }}
        />
      )}
    </AppShell>
  );
}

