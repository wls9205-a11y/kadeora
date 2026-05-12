// app/apt/[slug]/loading.tsx
export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 animate-pulse">
      <div className="h-64 bg-slate-200 dark:bg-slate-800" />
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
        <div className="grid grid-cols-3 gap-2 mt-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
