'use client';

// 지역 셀렉 열기/닫기 — 서버가 준 실측 카운트를 그대로 넘긴다.
//
// ⚠️ 패널을 «항상 펼친 채» 두지 않는다. 목록 화면의 첫 화면은 목록이어야 한다.
//    ⛔ 다만 이미 고른 지역이 있으면(=URL 에 rg 가 있으면) 닫힌 채로도 «무엇을 고른 상태인지»
//       버튼이 말해야 한다. 안 그러면 사용자는 필터가 걸린 줄 모른 채 목록을 읽는다.

import { useState } from 'react';
import RegionSelect from '@/components/region/RegionSelect';
import type { SidoTally, Tally } from '@/lib/region/select-counts';

export interface RegionSelectPanelProps {
  sidoCounts: Record<string, SidoTally>;
  sigunguCounts: Record<string, Tally>;
  nationwide: Tally;
  initialCodes: string[];
  /** 닫힌 버튼에 쓸 요약 — 서버가 라벨로 만들어 준다. */
  summary: string;
}

export default function RegionSelectPanel(props: RegionSelectPanelProps) {
  const [open, setOpen] = useState(false);
  return (
    <section style={{ margin: '0 0 var(--sp-md)' }}>
      <button
        type="button"
        className="touch-target"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', width: '100%',
          minHeight: 44, padding: '0 var(--sp-lg)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-strong)', background: 'var(--bg-base)',
          fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-title)', color: 'var(--text-primary)', textAlign: 'left',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{props.summary}</span>
        <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>{open ? '닫기' : '지역 고르기'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 'var(--sp-md)' }}>
          <RegionSelect
            sidoCounts={props.sidoCounts}
            sigunguCounts={props.sigunguCounts}
            nationwide={props.nationwide}
            initialCodes={props.initialCodes}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </section>
  );
}
