'use client';

import { useState, useTransition } from 'react';

const REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

interface ProfileCheongak {
  cheongak_score: number | null;
  no_house_period_months: number | null;
  dependents_count: number | null;
  savings_period_months: number | null;
  cheongak_target_regions: string[] | null;
  cheongak_target_unit_min: number | null;
  cheongak_target_unit_max: number | null;
  cheongak_score_updated_at: string | null;
}

interface Props {
  initial: ProfileCheongak;
}

function formatMonths(m: number | null): string {
  if (m == null) return '';
  if (m < 12) return `${m}개월`;
  const y = Math.floor(m / 12);
  const rem = m % 12;
  return rem === 0 ? `${y}년` : `${y}년 ${rem}개월`;
}

export default function CheongakForm({ initial }: Props) {
  const [no_house, setNoHouse] = useState<number>(initial.no_house_period_months ?? 0);
  const [deps, setDeps] = useState<number>(initial.dependents_count ?? 0);
  const [savings, setSavings] = useState<number>(initial.savings_period_months ?? 0);
  const [regions, setRegions] = useState<string[]>(initial.cheongak_target_regions ?? []);
  const [unitMin, setUnitMin] = useState<string>(initial.cheongak_target_unit_min != null ? String(initial.cheongak_target_unit_min) : '');
  const [unitMax, setUnitMax] = useState<string>(initial.cheongak_target_unit_max != null ? String(initial.cheongak_target_unit_max) : '');
  const [score, setScore] = useState<number | null>(initial.cheongak_score ?? null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initial.cheongak_score_updated_at ?? null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const previewScore =
    Math.min(32, Math.max(0, Math.floor((no_house || 0) / 6))) +
    Math.min(35, 5 + (deps || 0) * 5) +
    Math.min(17, Math.max(0, Math.floor((savings || 0) / 6)));

  function toggleRegion(r: string) {
    setRegions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r].slice(0, 10));
  }

  function save() {
    setMsg(null); setErr(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/profile/cheongak', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            no_house_period_months: no_house,
            dependents_count: deps,
            savings_period_months: savings,
            cheongak_target_regions: regions,
            cheongak_target_unit_min: unitMin ? Number(unitMin) : null,
            cheongak_target_unit_max: unitMax ? Number(unitMax) : null,
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErr(j?.error || '저장에 실패했습니다');
          return;
        }
        setScore(j?.profile?.cheongak_score ?? null);
        setUpdatedAt(j?.profile?.cheongak_score_updated_at ?? null);
        setMsg('저장 완료');
      } catch {
        setErr('네트워크 오류');
      }
    });
  }

  const scoreToShow = score ?? previewScore;
  const scoreColor = scoreToShow >= 60 ? '#00FF87' : scoreToShow >= 40 ? '#FAC775' : 'var(--text-tertiary)';

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Score 카드 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 700, letterSpacing: 1 }}>예상 가점 (실시간 미리보기)</div>
        <div style={{ fontSize: 64, fontWeight: 900, color: scoreColor, letterSpacing: -2, marginTop: 6 }}>{scoreToShow}<span style={{ fontSize: 24, color: 'var(--text-tertiary)' }}> / 84</span></div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
          {scoreToShow >= 60 ? '수도권 인기 단지 당첨 가능권' : scoreToShow >= 40 ? '지역 단지 매칭 활발' : '추가 입력 권장'}
        </div>
        {updatedAt && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>마지막 저장: {new Date(updatedAt).toLocaleString('ko-KR')}</div>}
      </div>

      {/* 무주택 기간 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>무주택 기간</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)' }}>{formatMonths(no_house)} <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 12 }}>· {Math.min(32, Math.floor(no_house / 6))}점</span></span>
        </label>
        <input type="range" min={0} max={240} step={6} value={no_house} onChange={e => setNoHouse(Number(e.target.value))} style={{ width: '100%' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
          <span>0개월</span><span>20년+</span>
        </div>
      </div>

      {/* 부양가족 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>부양가족 (본인 제외)</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)' }}>{deps}명 <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 12 }}>· {Math.min(35, 5 + deps * 5)}점</span></span>
        </label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[0, 1, 2, 3, 4, 5, 6].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setDeps(n)}
              style={{ padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: deps === n ? 'var(--brand)' : 'var(--bg-hover)', color: deps === n ? 'var(--text-inverse)' : 'var(--text-secondary)', border: `1px solid ${deps === n ? 'var(--brand)' : 'var(--border)'}` }}
            >{n}{n === 6 ? '+' : ''}</button>
          ))}
        </div>
      </div>

      {/* 청약통장 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>청약통장 가입 기간</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)' }}>{formatMonths(savings)} <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 12 }}>· {Math.min(17, Math.floor(savings / 6))}점</span></span>
        </label>
        <input type="range" min={0} max={240} step={6} value={savings} onChange={e => setSavings(Number(e.target.value))} style={{ width: '100%' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
          <span>0개월</span><span>20년+</span>
        </div>
      </div>

      {/* 관심 지역 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>관심 지역</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>최대 10개. 선택한 시도에 청약이 열리면 가점 매칭 알림을 받습니다.</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {REGIONS.map(r => {
            const on = regions.includes(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => toggleRegion(r)}
                style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: on ? 'var(--brand)' : 'var(--bg-hover)', color: on ? 'var(--text-inverse)' : 'var(--text-secondary)', border: `1px solid ${on ? 'var(--brand)' : 'var(--border)'}` }}
              >{r}</button>
            );
          })}
        </div>
      </div>

      {/* 저장 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          style={{ padding: '12px 24px', borderRadius: 999, background: pending ? 'var(--bg-hover)' : 'var(--brand)', color: pending ? 'var(--text-tertiary)' : 'var(--text-inverse)', fontWeight: 800, fontSize: 14, border: 'none', cursor: pending ? 'default' : 'pointer' }}
        >{pending ? '저장 중...' : '저장'}</button>
        {msg && <span style={{ fontSize: 13, color: 'var(--success, #00FF87)', fontWeight: 700 }}>✓ {msg}</span>}
        {err && <span style={{ fontSize: 13, color: '#FF6B6B', fontWeight: 700 }}>✗ {err}</span>}
      </div>
    </section>
  );
}
