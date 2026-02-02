export default function SettingsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-5 w-48 rounded bg-muted" />
      <div className="h-8 w-32 rounded bg-muted" />

      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="h-6 w-6 rounded bg-muted" />
            <div className="flex-1 space-y-3">
              <div className="h-5 w-40 rounded bg-muted" />
              <div className="h-4 w-72 rounded bg-muted" />
              <div className="h-9 w-36 rounded-lg bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
