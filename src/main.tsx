import { createRoot } from "react-dom/client";
import { Component, type ReactNode } from "react";
import App from "./App";
import "./styles/app.css";
class AppBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error("Application error", error);
  }
  render() {
    return this.state.failed ? (
      <div className="empty-state" role="alert">
        The application could not be displayed.{" "}
        <button onClick={() => location.reload()}>Reload</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <AppBoundary>
    <App />
  </AppBoundary>,
);
