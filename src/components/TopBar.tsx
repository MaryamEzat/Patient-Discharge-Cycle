import { useResource } from "../hooks/useResource";
import { platformService } from "../services/platformService";
export function TopBar({
  refresh,
  updated,
  pending,
}: {
  refresh: () => void;
  updated?: Date;
  pending?: number;
}) {
  const context = useResource(platformService.context);
  const name =
    context.data?.user.fullName ||
    context.data?.user.userPrincipalName ||
    "Current user";
  return (
    <header className="top-context">
      <div className="header-left">
        <div className="subtitle">PATIENT DISCHARGE CYCLE</div>
        <div className="brand">Patient Discharge Cycle</div>
      </div>
      <div className="context-title">
        <div className="context-chip">
          <span className="context-label">Business Unit</span>
          <span className="context-value">AHJ</span>
        </div>
        <div className="context-chip">
          <span className="context-label">Updated</span>
          <span className="context-value last-updated">
            {updated?.toLocaleTimeString() || "-"}
          </span>
        </div>
        <div className="context-chip">
          <span className="context-label">Attention</span>
          <span className="context-value">
            {pending === undefined ? "Pending review" : `${pending} pending`}
          </span>
        </div>
      </div>
      <div className="header-right">
        <button
          className="icon-btn"
          title="Refresh"
          aria-label="Refresh"
          onClick={refresh}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20 12a8 8 0 0 1-13.7 5.7M4 12A8 8 0 0 1 17.7 6.3M17 2v5h5M7 22v-5H2" />
          </svg>
        </button>
        <div className="user-inline">
          <div className="avatar">
            {name
              .split(" ")
              .map((s) => s[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <div className="small">{name}</div>
        </div>
      </div>
    </header>
  );
}
