"use client";
// components/admin/v4/SilentFailTable.tsx — s258
// Architecture Rule #14: hooks 무조건 최상단

import { useMemo, useState } from "react";

type Row = {
  cron_name: string;
  runs: number;
  ok: number;
  processed: number;
  failed: number;
  created: number;
  fail_pct: number | null;
  fully_failed_runs: number;
  empty_success_runs: number;
  success_with_err_msg: number;
  latest_run: string;
  health: "silent_fail" | "all_failed" | "ok";
};

type Sample = {
  cron_name: string;
  metadata: any;
  error_message: string | null;
  started_at: string;
};

const HEALTH_BADGE: Record<string, string> = {
  silent_fail: "bg-amber-100 text-amber-800",
  all_failed: "bg-red-100 text-red-800",
  ok: "bg-emerald-100 text-emerald-800",
};

export default function SilentFailTable({
  rows,
  samples,
}: {
  rows: Row[];
  samples: Sample[];
}) {
  const [filter, setFilter] = useState<"all" | "silent_fail" | "all_failed">(
    "silent_fail",
  );
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? rows
        : rows.filter((r) => r.health === filter),
    [rows, filter],
  );

  const samplesByCron = useMemo(() => {
    const m = new Map<string, Sample[]>();
    for (const s of samples) {
      const arr = m.get(s.cron_name) || [];
      arr.push(s);
      m.set(s.cron_name, arr);
    }
    return m;
  }, [samples]);

  return (
    <section className="rounded-lg border">
      <div className="flex items-center gap-2 p-3 border-b bg-gray-50">
        <button
          className={`px-3 py-1 text-xs rounded ${
            filter === "all" ? "bg-gray-900 text-white" : "bg-white border"
          }`}
          onClick={() => setFilter("all")}
        >
          전체 ({rows.length})
        </button>
        <button
          className={`px-3 py-1 text-xs rounded ${
            filter === "silent_fail"
              ? "bg-amber-600 text-white"
              : "bg-white border"
          }`}
          onClick={() => setFilter("silent_fail")}
        >
          Silent Fail
        </button>
        <button
          className={`px-3 py-1 text-xs rounded ${
            filter === "all_failed" ? "bg-red-600 text-white" : "bg-white border"
          }`}
          onClick={() => setFilter("all_failed")}
        >
          All Failed
        </button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="p-2">cron_name</th>
            <th className="p-2 text-right">runs</th>
            <th className="p-2 text-right">processed</th>
            <th className="p-2 text-right">failed</th>
            <th className="p-2 text-right">fail %</th>
            <th className="p-2 text-right">empty_success</th>
            <th className="p-2">latest</th>
            <th className="p-2">health</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => {
            const isOpen = expanded === r.cron_name;
            const cronSamples = samplesByCron.get(r.cron_name) || [];
            return (
              <>
                <tr key={r.cron_name} className="border-t">
                  <td className="p-2 font-mono text-xs">{r.cron_name}</td>
                  <td className="p-2 text-right tabular-nums">{r.runs}</td>
                  <td className="p-2 text-right tabular-nums">{r.processed}</td>
                  <td className="p-2 text-right tabular-nums">{r.failed}</td>
                  <td className="p-2 text-right tabular-nums">
                    {r.fail_pct ?? "-"}%
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {r.empty_success_runs}
                  </td>
                  <td className="p-2 text-xs text-gray-500">
                    {new Date(r.latest_run).toLocaleString("ko-KR")}
                  </td>
                  <td className="p-2">
                    <span
                      className={`px-2 py-0.5 text-xs rounded ${HEALTH_BADGE[r.health]}`}
                    >
                      {r.health}
                    </span>
                  </td>
                  <td className="p-2">
                    {cronSamples.length > 0 && (
                      <button
                        className="text-xs text-blue-600 underline"
                        onClick={() =>
                          setExpanded(isOpen ? null : r.cron_name)
                        }
                      >
                        {isOpen ? "닫기" : `샘플 ${cronSamples.length}`}
                      </button>
                    )}
                  </td>
                </tr>
                {isOpen && cronSamples.length > 0 && (
                  <tr key={r.cron_name + "-detail"}>
                    <td colSpan={9} className="p-3 bg-gray-50">
                      <div className="space-y-2 max-h-72 overflow-auto">
                        {cronSamples.map((s, i) => (
                          <div
                            key={i}
                            className="text-xs font-mono bg-white border rounded p-2"
                          >
                            <div className="text-gray-500 text-[10px]">
                              {new Date(s.started_at).toLocaleString("ko-KR")}
                            </div>
                            {s.error_message && (
                              <div className="text-red-600">{s.error_message}</div>
                            )}
                            {s.metadata && (
                              <pre className="whitespace-pre-wrap break-all text-[11px] text-gray-700">
                                {JSON.stringify(s.metadata, null, 2).slice(0, 800)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
