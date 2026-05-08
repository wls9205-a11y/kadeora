"use client";
// components/admin/v4/SeoHealthCard.tsx — s258

type Health = "ok" | "stale" | "no_data";

const HEALTH_STYLE: Record<Health, { border: string; bg: string; label: string }> = {
  ok: { border: "border-emerald-200", bg: "bg-emerald-50", label: "✅ 정상" },
  stale: { border: "border-amber-200", bg: "bg-amber-50", label: "⚠️ 정체" },
  no_data: { border: "border-red-200", bg: "bg-red-50", label: "❌ 데이터 없음" },
};

export default function SeoHealthCard({
  title,
  health,
  metrics,
  warning,
}: {
  title: string;
  health: Health;
  metrics: { label: string; value: string | number }[];
  warning?: string;
}) {
  const style = HEALTH_STYLE[health];
  return (
    <div className={`rounded-lg border p-4 ${style.border} ${style.bg}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-xs">{style.label}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {metrics.map((m, i) => (
          <div key={i} className="flex justify-between border-b border-white/50 pb-1">
            <dt className="text-gray-600">{m.label}</dt>
            <dd className="tabular-nums font-mono">{String(m.value)}</dd>
          </div>
        ))}
      </dl>
      {warning && (
        <div className="mt-3 text-xs text-red-700 bg-red-100 rounded p-2">
          ⚠️ {warning}
        </div>
      )}
    </div>
  );
}
