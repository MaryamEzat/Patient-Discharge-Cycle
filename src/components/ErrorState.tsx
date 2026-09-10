import { OperationalError } from "../services/data";
export function errorMessage(error: unknown) {
  return error instanceof OperationalError
    ? error.message
    : "Unable to complete this operation. Please retry.";
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="empty-state" role="alert">
      <div className="eyebrow">Unable to load</div>
      <div>{errorMessage(error)}</div>
      {retry && (
        <button type="button" onClick={retry}>
          Retry
        </button>
      )}
    </div>
  );
}
