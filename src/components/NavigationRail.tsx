export type Page = "worklist" | "patient" | "early" | "draft";

const SECTIONS = [
  {
    target: "worklist",
    label: "Patient Discharges",
    pages: ["worklist", "patient"],
    icon: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  },
  {
    target: "early",
    label: "Early Discharge",
    pages: ["early", "draft"],
    icon: "M12 8v5l3 2M4 13a8 8 0 1 0 2.3-5.7M4 4v5h5",
  },
] as const;

/**
 * In-app section switch shown in the header. The app has no side navigation of its own:
 * it is embedded in a host that provides the side bar.
 */
export function SectionTabs({
  page,
  navigate,
}: {
  page: Page;
  navigate: (p: Page) => void;
}) {
  return (
    <nav className="section-tabs" aria-label="Sections">
      {SECTIONS.map((section) => {
        const active = (section.pages as readonly Page[]).includes(page);
        return (
          <button
            type="button"
            key={section.target}
            className={`section-tab ${active ? "active" : ""}`}
            aria-current={active ? "page" : undefined}
            onClick={() => navigate(section.target)}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={section.icon} />
            </svg>
            <span>{section.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
