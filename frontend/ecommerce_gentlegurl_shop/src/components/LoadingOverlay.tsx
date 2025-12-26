type LoadingOverlayProps = {
  message?: string;
  show?: boolean;
};

export default function LoadingOverlay({ message = "Loading...", show = true }: LoadingOverlayProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--background-soft)]/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--muted)] border-t-[var(--accent)]"></div>
        <p className="text-sm font-medium text-[var(--foreground)]/70">{message}</p>
      </div>
    </div>
  );
}
