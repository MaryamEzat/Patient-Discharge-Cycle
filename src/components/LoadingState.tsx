export function LoadingState({
  message = "Loading...",
  subtitle,
}: {
  message?: string;
  subtitle?: string;
}) {
  return (
    <div className="loading-state-container" role="status" aria-live="polite">
      <div className="loading-spinner-ring">
        <div className="spinner-dot" />
      </div>
      <div className="loading-state-content">
        <div className="loading-state-message">{message}</div>
        {subtitle && <div className="loading-state-subtitle">{subtitle}</div>}
      </div>
    </div>
  );
}
