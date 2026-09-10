export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="loading" role="status">
      {message}
    </div>
  );
}
