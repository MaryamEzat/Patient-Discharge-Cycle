import { useState, type ReactNode } from "react";
import { NavigationRail, type Page } from "./NavigationRail";
import { TopBar } from "./TopBar";

export function AppShell({
  children,
  page,
  navigate,
  refresh,
  updated,
  pending,
}: {
  children: ReactNode;
  page: Page;
  navigate: (p: Page) => void;
  refresh: () => void;
  updated?: Date;
  pending?: number;
}) {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  return (
    <div className={`app-root ${sidebarExpanded ? "expanded" : "collapsed"}`}>
      <NavigationRail
        page={page}
        navigate={navigate}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded((prev) => !prev)}
      />
      <TopBar refresh={refresh} updated={updated} pending={pending} />
      <main className="main">{children}</main>
    </div>
  );
}
