import type { ReactNode } from "react";
import { SectionTabs, type Page } from "./NavigationRail";
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
  return (
    <div className="app-root">
      <TopBar
        refresh={refresh}
        updated={updated}
        pending={pending}
        sections={<SectionTabs page={page} navigate={navigate} />}
      />
      <main className="main">{children}</main>
    </div>
  );
}
