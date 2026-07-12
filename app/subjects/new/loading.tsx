export default function NewSubjectLoading() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="animate-pulse space-y-2">
        <div className="h-8 w-48 rounded bg-slate-200" />
        <div className="h-4 w-72 rounded bg-slate-200" />
      </div>
      <div className="card space-y-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-24 rounded bg-slate-200" />
          <div className="h-10 w-full rounded bg-slate-200" />
        </div>
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-20 rounded bg-slate-200" />
          <div className="h-24 w-full rounded bg-slate-200" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="animate-pulse space-y-2">
            <div className="h-4 w-28 rounded bg-slate-200" />
            <div className="h-10 w-full rounded bg-slate-200" />
          </div>
          <div className="animate-pulse space-y-2">
            <div className="h-4 w-28 rounded bg-slate-200" />
            <div className="h-10 w-full rounded bg-slate-200" />
          </div>
        </div>
        <div className="animate-pulse h-10 w-full rounded bg-slate-200" />
      </div>
    </div>
  );
}
