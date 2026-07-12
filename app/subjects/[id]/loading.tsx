export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Skeleton Card 1 */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-5 w-2/5 rounded bg-slate-200 mb-3" />
        <div className="h-4 w-4/5 rounded bg-slate-100 mb-2" />
        <div className="h-4 w-3/5 rounded bg-slate-100" />
      </div>
      {/* Skeleton Card 2 */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-5 w-1/3 rounded bg-slate-200 mb-3" />
        <div className="h-4 w-5/6 rounded bg-slate-100 mb-2" />
        <div className="h-4 w-1/2 rounded bg-slate-100" />
      </div>
      {/* Skeleton Card 3 */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-5 w-1/4 rounded bg-slate-200 mb-3" />
        <div className="h-4 w-3/4 rounded bg-slate-100 mb-2" />
        <div className="h-4 w-2/3 rounded bg-slate-100" />
      </div>
    </div>
  );
}
