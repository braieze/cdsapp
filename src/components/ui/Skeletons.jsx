export function PostSkeleton() {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm animate-pulse">
      <div className="flex gap-3 mb-4">
        <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
        <div className="flex-1 space-y-2 py-1">
          <div className="h-4 bg-slate-200 rounded w-1/3"></div>
          <div className="h-3 bg-slate-200 rounded w-1/4"></div>
        </div>
      </div>
      <div className="h-24 bg-slate-200 rounded-xl mb-4"></div>
      <div className="flex gap-2">
        <div className="h-8 w-16 bg-slate-200 rounded-full"></div>
        <div className="h-8 w-16 bg-slate-200 rounded-full"></div>
      </div>
    </div>
  );
}