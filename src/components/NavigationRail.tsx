export type Page = "worklist" | "patient" | "early" | "draft";

export function NavigationRail({
  page,
  navigate,
  expanded,
  onToggle,
}: {
  page: Page;
  navigate: (p: Page) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={`nav-rail ${expanded ? "expanded" : "collapsed"}`}
      aria-label="Patient Discharge navigation"
      onClick={() => {
        if (!expanded) {
          onToggle();
        }
      }}
      title={!expanded ? "Click anywhere to expand sidebar" : undefined}
    >
      <div className="rail-mark-group">
        <div className="rail-mark">PDC</div>
        {expanded && <div className="rail-brand-text">Discharge Cycle</div>}
      </div>
      <nav className="main-nav" aria-label="Main">
        <button
          className={`tab-btn ${page === "worklist" || page === "patient" ? "active" : ""}`}
          title="Patient Discharges"
          aria-label="Patient Discharges"
          onClick={(e) => {
            if (!expanded) {
              e.stopPropagation();
              onToggle();
            }
            navigate("worklist");
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
          {expanded && <span className="tab-btn-label">Patient Discharges</span>}
        </button>
        <button
          className={`tab-btn ${page === "early" || page === "draft" ? "active" : ""}`}
          title="Early Discharge"
          aria-label="Early Discharge"
          onClick={(e) => {
            if (!expanded) {
              e.stopPropagation();
              onToggle();
            }
            navigate("early");
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
            <path d="M12 8v5l3 2M4 13a8 8 0 1 0 2.3-5.7M4 4v5h5" />
          </svg>
          {expanded && <span className="tab-btn-label">Early Discharge</span>}
        </button>
      </nav>
      <div className="rail-footer">
        <button
          className="rail-toggle-btn"
          title={expanded ? "Collapse Sidebar" : "Expand Sidebar"}
          aria-label={expanded ? "Collapse Sidebar" : "Expand Sidebar"}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {expanded ? (
              <path d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
            ) : (
              <path d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            )}
          </svg>
          {expanded && <span>Collapse Sidebar</span>}
        </button>
      </div>
    </aside>
  );
}
