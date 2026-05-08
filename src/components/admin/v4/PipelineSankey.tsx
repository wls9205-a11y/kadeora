"use client";
// s258 — recharts 의존성 미설치 stub. props 동일, 단순 HTML horizontal bar.

import { useMemo } from "react";

type Row = {
  lifecycle_stage: string;
  publish_decision: string;
  block_reason: string;
  cnt: number;
  published: number;
};

const COLOR_OK = "#10b981";
const COLOR_BLOCK = "#ef4444";
const COLOR_PENDING = "#f59e0b";

export default function PipelineSankey({ rows }: { rows: Row[] }) {
  const data = useMemo(() => {
    return [...rows]
      .map((r) => ({
        label: `${r.publish_decision} · ${r.block_reason || "-"}`.slice(0, 60),
        cnt: r.cnt,
        published: r.published,
        kind:
          r.published > 0
            ? "ok"
            : r.publish_decision === "draft" || r.publish_decision === "pending"
            ? "pending"
            : "block",
      }))
      .sort((a, b) => b.cnt - a.cnt)
      .slice(0, 12);
  }, [rows]);

  if (data.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-tertiary, #888)', padding: 24, textAlign: 'center' }}>
        24h 이슈 큐 데이터 없음
      </div>
    );
  }

  const max = Math.max(1, ...data.map(d => d.cnt));
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {data.map((d, i) => {
        const color = d.kind === 'ok' ? COLOR_OK : d.kind === 'pending' ? COLOR_PENDING : COLOR_BLOCK;
        const pct = (d.cnt / max) * 100;
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 8, alignItems: 'center', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
              <div style={{ height: 14, width: `${pct}%`, background: color, borderRadius: 2, minWidth: 4 }} />
            </div>
            <span style={{ textAlign: 'right', fontWeight: 700 }}>{d.cnt}</span>
          </div>
        );
      })}
    </div>
  );
}
