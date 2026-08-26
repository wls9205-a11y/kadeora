'use client';
import React from 'react';

interface StageStat { ok?: number; fail?: number }

interface Props {
  stages: Record<string, StageStat>;
  order?: string[];
}

const DEFAULT_ORDER = [
  'issue-detect',
  'issue-draft',
  'issue-fact-check',
  'issue-image-attach',
  'issue-publish',
  'issue-pipeline-orchestrator',
];

const SHORT: Record<string, string> = {
  'issue-detect':                '감지',
  'issue-draft':                 '초안',
  'issue-fact-check':            '팩트',
  'issue-image-attach':          '이미지',
  'issue-publish':               '발행',
  'issue-pipeline-orchestrator': '오케스트레이터',
};

function statusColor(stat: StageStat): string {
  const fail = stat?.fail ?? 0;
  const ok = stat?.ok ?? 0;
  if (ok === 0 && fail === 0) return 'var(--text-tertiary)';
  if (fail > 0)               return 'var(--accent-orange)';
  return 'var(--accent-green)';
}

export default function PipelineStages({ stages, order = DEFAULT_ORDER }: Props) {
  const items = order.filter(k => stages[k] != null);
  return (
    <div style={{
      display: 'flex', gap: 6, flexWrap: 'wrap',
      padding: 10, borderRadius: 'var(--radius-md, 10px)',
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
    }}>
      {items.map(k => {
        const st = stages[k];
        const color = statusColor(st);
        return (
          <div key={k} style={{
            flex: '1 1 96px', minWidth: 90,
            padding: '8px 10px', borderRadius: 'var(--radius-sm, 6px)',
            background: 'var(--bg-elevated)',
            border: `1px solid ${color}33`, borderLeft: `3px solid ${color}`,
            display: 'flex', flexDirection: 'column', gap: 3,
          }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
              {SHORT[k] ?? k}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color }}>
              성공 {st?.ok ?? 0} <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>·</span> 실패 {st?.fail ?? 0}
            </div>
          </div>
        );
      })}
    </div>
  );
}
