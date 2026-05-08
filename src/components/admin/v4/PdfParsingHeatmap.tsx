"use client";
// components/admin/v4/PdfParsingHeatmap.tsx — s258

import { useMemo } from "react";

type Row = {
  parse_version: number;
  raw_band: string;
  cnt: number;
  false_success_count?: number;
};

const RAW_BANDS = ["null", "<100", "100-999", "1k-5k", "5k+"];
const VERSIONS = [1, -1, 0]; // 성공, 실패, NULL

export default function PdfParsingHeatmap({ rows }: { rows: Row[] }) {
  const grid = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      m.set(`${r.parse_version}|${r.raw_band}`, r.cnt);
    }
    return m;
  }, [rows]);

  const max = useMemo(
    () =>
      Math.max(0, ...rows.map((r) => r.cnt)),
    [rows],
  );

  const cellColor = (cnt: number, version: number, band: string) => {
    if (cnt === 0) return "bg-gray-50 text-gray-300";
    const isFalseSuccess =
      version === 1 && (band === "null" || band === "<100");
    if (isFalseSuccess) {
      const pct = max > 0 ? cnt / max : 0;
      return `text-white font-bold ${
        pct > 0.5 ? "bg-red-700" : pct > 0.2 ? "bg-red-500" : "bg-red-300"
      }`;
    }
    const isOk =
      version === 1 && (band === "1k-5k" || band === "5k+" || band === "100-999");
    if (isOk) {
      const pct = max > 0 ? cnt / max : 0;
      return `${pct > 0.5 ? "bg-emerald-600 text-white" : pct > 0.2 ? "bg-emerald-300" : "bg-emerald-100"}`;
    }
    if (version === -1) {
      return "bg-amber-100 text-amber-900";
    }
    return "bg-gray-100";
  };

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="p-2 text-xs text-gray-500 text-left">↓version / →raw 길이</th>
            {RAW_BANDS.map((b) => (
              <th key={b} className="p-2 text-xs text-gray-500 text-center w-24">
                {b}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {VERSIONS.map((v) => (
            <tr key={v}>
              <td className="p-2 text-xs font-mono">
                {v === 1 ? "✅ 1" : v === -1 ? "❌ -1" : "0"}
              </td>
              {RAW_BANDS.map((b) => {
                const cnt = grid.get(`${v}|${b}`) || 0;
                return (
                  <td
                    key={b}
                    className={`p-3 text-center text-sm border ${cellColor(cnt, v, b)}`}
                    title={`version=${v}, raw=${b}: ${cnt}건`}
                  >
                    {cnt > 0 ? cnt.toLocaleString() : "-"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 text-xs text-gray-500 space-x-4">
        <span className="inline-block w-3 h-3 bg-emerald-600 mr-1 align-middle"></span>실제 성공
        <span className="inline-block w-3 h-3 bg-red-500 mr-1 ml-3 align-middle"></span>거짓 성공 (version=1+raw 부족)
        <span className="inline-block w-3 h-3 bg-amber-100 mr-1 ml-3 align-middle"></span>실패로 마크됨
      </div>
    </div>
  );
}
