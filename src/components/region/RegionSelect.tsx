'use client';

// 지역 셀렉(검색형) — 시안 v3 1탭. U-1b.
//
// ── 시안에서 «일부러 다르게» 한 것 둘 ──────────────────────────────────────
// ① 「전국 17개 시·도」 → **16개**. 광주·전남이 통합 코드(12) 하나라 실측이 16이다.
//    라벨이 데이터를 앞지르면 «라벨을 데이터에 맞춘다»(DS_RULES §2-2).
// ② 「인기」 칩 → **「분양예정 많은 곳」**. 「인기」는 이 저장소의 금칙어다(§2-3 · smoke 검사).
//    근거 없는 최상급을 쓰지 않는다. 실제로 세어서 많은 곳을 그 이름으로 부른다.
//
// ⚠️ 숫자는 서버가 «실측» 해 내려준다. 0 은 0 으로 적는다 — 빈 곳을 숨기면
//    사용자는 고를 수 없는 칸을 계속 누른다.

import { useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { REGION_TREE, searchRegions, serializeRegionSelection, type SidoNode } from '@/lib/region/select-tree';
import type { SidoTally, Tally } from '@/lib/region/select-counts';

export interface RegionSelectProps {
  sidoCounts: Record<string, SidoTally>;
  sigunguCounts: Record<string, Tally>;
  nationwide: Tally;
  initialCodes?: readonly string[];
  onClose?: () => void;
}

const num = (n: number) => n.toLocaleString('ko-KR');

export default function RegionSelect({
  sidoCounts, sigunguCounts, nationwide, initialCodes = [], onClose,
}: RegionSelectProps) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initialCodes));
  const [openSido, setOpenSido] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const hits = useMemo(() => (q.trim() ? searchRegions(q) : []), [q]);

  const pickedLabels = useMemo(() => {
    const out: string[] = [];
    for (const s of REGION_TREE) for (const n of s.sigungus) if (n.codes.some((c) => picked.has(c))) out.push(n.label);
    return out;
  }, [picked]);

  function toggleNode(codes: readonly string[]) {
    setPicked((prev) => {
      const next = new Set(prev);
      const on = codes.some((c) => next.has(c));
      for (const c of codes) { if (on) next.delete(c); else next.add(c); }
      return next;
    });
  }

  function toggleSidoAll(sido: SidoNode) {
    const all = sido.sigungus.flatMap((n) => n.codes);
    setPicked((prev) => {
      const next = new Set(prev);
      const every = all.every((c) => next.has(c));
      for (const c of all) { if (every) next.delete(c); else next.add(c); }
      return next;
    });
  }

  function apply() {
    const rg = serializeRegionSelection([...picked]);
    router.push(rg ? `/apt?rg=${rg}` : '/apt');
    onClose?.();
  }

  // 「분양예정 많은 곳」 — 세어서 뽑는다. ⛔ 손으로 적은 목록이 아니다.
  const topRegions = useMemo(() => {
    const rows: Array<{ label: string; codes: readonly string[]; n: number }> = [];
    for (const s of REGION_TREE) {
      for (const n of s.sigungus) rows.push({ label: n.label, codes: n.codes, n: sigunguCounts[n.label]?.upcoming ?? 0 });
    }
    return rows.filter((r) => r.n > 0).sort((a, b) => b.n - a.n).slice(0, 4);
  }, [sigunguCounts]);

  const openNode = openSido ? REGION_TREE.find((s) => s.code === openSido) ?? null : null;

  const total: Tally = useMemo(() => {
    if (!picked.size) return nationwide;
    let t = { upcoming: 0, open: 0 };
    for (const s of REGION_TREE) {
      for (const n of s.sigungus) {
        if (!n.codes.some((c) => picked.has(c))) continue;
        const v = sigunguCounts[n.label];
        if (v) t = { upcoming: t.upcoming + v.upcoming, open: t.open + v.open };
      }
    }
    return t;
  }, [picked, sigunguCounts, nationwide]);

  const cell: CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, minHeight: 56,
    padding: 'var(--sp-sm) var(--sp-md)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-base)', textAlign: 'left',
  };
  const chip: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-xs)', height: 32,
    padding: '0 var(--sp-md)', borderRadius: 999, border: '1px solid var(--border-strong)',
    background: 'var(--bg-base)', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)',
  };
  const chipOn: CSSProperties = {
    ...chip, background: 'var(--brand-navy)', borderColor: 'var(--brand-navy)',
    color: 'var(--text-inverse)', fontWeight: 600,
  };

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '0 var(--sp-md) var(--sp-lg)' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--sp-lg)' }}>
        <h2 style={{ fontSize: 'var(--fs-lg)', letterSpacing: '-0.02em', margin: 0 }}>어디 분양 소식을 찾으세요?</h2>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
          전국 {REGION_TREE.length}개 시·도, 시·군·구 단위로 골라 보세요
        </p>
      </div>

      <div style={{ position: 'relative', marginBottom: 'var(--sp-md)' }}>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="시·군·구 검색 (예: 사상, 수원, 해운대)"
          aria-label="지역 검색"
          style={{
            width: '100%', height: 52, borderRadius: 'var(--radius-lg)',
            border: '2px solid var(--brand-navy)', background: 'var(--bg-base)',
            color: 'var(--text-primary)', padding: '0 var(--sp-lg)', fontSize: 'var(--fs-sm)',
          }}
        />
        {q.trim() !== '' && (
          <div style={{
            position: 'absolute', left: 0, right: 0, top: 56, zIndex: 20,
            background: 'var(--bg-base)', border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)', boxShadow: '0 12px 32px rgba(0,0,0,.16)', overflow: 'hidden',
          }}>
            {hits.length === 0 ? (
              <p style={{ margin: 0, padding: 'var(--sp-md) var(--sp-lg)', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>
                「{q.trim()}」 결과 없음 — 시·군·구 이름으로 검색하세요
              </p>
            ) : hits.map((h) => (
              <button
                key={h.sidoCode + ':' + (h.node ? h.node.label : '*')}
                type="button"
                className="touch-target"
                onClick={() => {
                  const sido = REGION_TREE.find((s) => s.code === h.sidoCode);
                  if (!sido) return;
                  toggleNode(h.node ? h.node.codes : sido.sigungus.flatMap((n) => n.codes));
                  setOpenSido(h.sidoCode);
                  setQ('');
                }}
                style={{
                  display: 'flex', width: '100%', alignItems: 'center', gap: 'var(--sp-sm)',
                  minHeight: 44, padding: '0 var(--sp-lg)', fontSize: 'var(--fs-xs)',
                  borderBottom: '1px solid var(--border)', textAlign: 'left', background: 'none',
                }}
              >
                <span style={{ fontWeight: 600 }}>{h.node ? h.node.short : h.sidoName}</span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-2xs)' }}>
                  {h.node ? h.sidoName : '시·도 전체'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {topRegions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-lg)', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-tertiary)' }}>분양예정 많은 곳</span>
          {topRegions.map((r) => {
            const on = r.codes.some((c) => picked.has(c));
            return (
              <button key={r.label} type="button" className="touch-target" aria-pressed={on}
                onClick={() => toggleNode(r.codes)} style={on ? chipOn : chip}>
                {r.label} <b style={{ color: on ? 'inherit' : 'var(--kd-accent)' }}>{num(r.n)}</b>
              </button>
            );
          })}
        </div>
      )}

      <div className="kd-rg-grid">
        {REGION_TREE.map((s) => {
          const t = sidoCounts[s.code];
          const n = s.sigungus.filter((x) => x.codes.some((c) => picked.has(c))).length;
          const on = n > 0 || openSido === s.code;
          return (
            <button
              key={s.code}
              type="button"
              className="touch-target"
              aria-pressed={on}
              aria-expanded={openSido === s.code}
              onClick={() => setOpenSido((cur) => (cur === s.code ? null : s.code))}
              style={on
                ? { ...cell, borderColor: 'var(--brand-navy)', background: 'var(--brand-light)', boxShadow: 'inset 0 0 0 1px var(--brand-navy)' }
                : cell}
            >
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {s.name}
                {n > 0 && <span style={{ color: 'var(--brand-navy)', fontWeight: 800 }}> · {n}</span>}
              </span>
              <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-tertiary)' }}>
                예정 <b style={{ color: 'var(--kd-accent)', fontWeight: 700 }}>{num(t ? t.total.upcoming : 0)}</b>
              </span>
            </button>
          );
        })}
      </div>

      {openNode && (
        <div style={{
          marginTop: 'var(--sp-md)', padding: 'var(--sp-md)', background: 'var(--bg-surface)',
          border: '1px solid var(--brand-navy)', borderRadius: 'var(--radius-md)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-sm)', fontSize: 'var(--fs-xs)', fontWeight: 800 }}>
            {openNode.name} 시·군·구
            <button type="button" className="touch-target" onClick={() => toggleSidoAll(openNode)}
              style={{ marginLeft: 'auto', fontSize: 'var(--fs-2xs)', color: 'var(--brand-navy)', fontWeight: 700, background: 'none' }}>
              {openNode.sigungus.flatMap((n) => n.codes).every((c) => picked.has(c)) ? '전체 해제' : '전체 선택'}
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-sm)' }}>
            {openNode.sigungus.map((n) => {
              const on = n.codes.some((c) => picked.has(c));
              const t = sigunguCounts[n.label];
              return (
                <button key={n.label} type="button" className="touch-target" aria-pressed={on}
                  onClick={() => toggleNode(n.codes)} style={on ? chipOn : chip}>
                  {n.short}
                  <span style={{ opacity: 0.75, fontSize: 'var(--fs-3xs)' }}>{num(t ? t.upcoming : 0)}</span>
                </button>
              );
            })}
          </div>
          {(sidoCounts[openNode.code] ? sidoCounts[openNode.code].other.upcoming : 0) > 0 && (
            <p style={{ margin: 'var(--sp-sm) 0 0', fontSize: 'var(--fs-2xs)', color: 'var(--text-tertiary)' }}>
              시·군·구가 확인되지 않은 현장 {num(sidoCounts[openNode.code].other.upcoming)}곳은 칩으로 고를 수 없습니다.
            </p>
          )}
        </div>
      )}

      <div style={{
        position: 'sticky', bottom: 0, zIndex: 10, marginTop: 'var(--sp-lg)', height: 48,
        display: 'flex', alignItems: 'center', gap: 'var(--sp-md)', padding: '0 var(--sp-lg)',
        background: 'var(--bg-base)', border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-md) var(--radius-md) 0 0', boxShadow: '0 -6px 20px rgba(12,30,86,.12)',
      }}>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {picked.size === 0 ? (
            <>전국 전체 · 분양예정 <b style={{ color: 'var(--brand-navy)' }}>{num(nationwide.upcoming)}</b> · 분양중 <b style={{ color: 'var(--brand-navy)' }}>{num(nationwide.open)}</b></>
          ) : (
            <>선택 <b style={{ color: 'var(--brand-navy)' }}>{pickedLabels.length}곳</b> — {pickedLabels.slice(0, 3).join(' · ')}{pickedLabels.length > 3 ? ' 외 ' + (pickedLabels.length - 3) : ''} · 분양예정 <b style={{ color: 'var(--brand-navy)' }}>{num(total.upcoming)}</b></>
          )}
        </span>
        <button type="button" className="touch-target" onClick={() => { setPicked(new Set()); setOpenSido(null); }}
          style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textDecoration: 'underline', background: 'none' }}>
          초기화
        </button>
        <button type="button" className="touch-target" onClick={apply}
          style={{ height: 36, padding: '0 var(--sp-xl)', borderRadius: 'var(--radius-sm)', background: 'var(--brand-navy)', color: 'var(--text-inverse)', fontWeight: 800 }}>
          이 조건으로 보기
        </button>
      </div>
    </div>
  );
}
