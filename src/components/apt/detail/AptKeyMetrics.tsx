// v10 — 현장 상세 핵심 지표 4칸.
//
// 분양가 · 세대수 · 입주 · D-day. **이 네 값은 페이지에 여기 한 번만 나온다.**
//
// 실측(두산위브더제니스 대연)에서 같은 값이 반복되고 있었다 —
// 세대수 5회 · 분양가 5회 · 입주 3회. AptHero·KpiCards·AptKpiGrid·ComplexScale·
// AptDDayCard 가 각자 같은 숫자를 다시 그렸다. 그 다섯을 이 한 벌로 대체한다.
//
// V15 C-3: 세대수 칸은 '세대수 176' 이 아니라 '분양 공급 176 / 총 258세대' 로 낸다.
// 무엇을 세는 숫자인지 밝히지 않으면 경쟁률의 분모(분양 공급)와 단지 규모(단지 전체)가
// 섞인다. 실측 2,800쌍 중 2,698(96.4%)이 total_units 에 공급 수치를 담고 있었다.
//
// 공급 정보 표에는 입주·세대수 행이 남는다 — 표는 원장(ledger) 성격이라 예외다.
// 값이 없으면 칸을 '미공개' 로 두되 칸 수는 4로 고정한다: 현장마다 칸 수가 달라지면
// 첫 화면이 현장마다 달라진다 (규격화의 핵심 — s-v2 공급 정보 표와 같은 원칙).

import { toDateKey, todayKST } from '@/lib/apt/subscription-status';
// V15 C-3: 세대수는 '분양 공급' 과 '단지 전체' 두 축이다. 어느 쪽인지 라벨이 밝힌다.
import { unitCell, type UnitCounts } from '@/lib/apt/units';

type Props = {
  priceMin?: number | null;   // 만원
  priceMax?: number | null;   // 만원
  /** 세대수 두 축. lib/apt/units.ts 의 resolveUnits() 결과를 그대로 넘긴다. */
  units: UnitCounts;
  /** 'YYYY-MM' 또는 'YYYYMM' */
  moveInDate?: string | null;
  /** 접수 마감일 (YYYY-MM-DD). D-day 계산 기준. */
  receiptEnd?: string | null;
  /** 접수 시작일 — 아직 시작 전이면 '접수 시작까지' 를 센다. */
  receiptStart?: string | null;
};

/** 만원 → 억 표기. 1억 미만은 만원 그대로 둔다 (0.7억 은 읽기 어렵다). */
function fmtEok(v: number): string {
  if (v < 10000) return `${v.toLocaleString('ko-KR')}만`;
  const eok = v / 10000;
  return `${eok % 1 === 0 ? eok : eok.toFixed(1)}억`;
}

function priceText(min?: number | null, max?: number | null): string | null {
  const lo = min && min > 0 ? min : 0;
  const hi = max && max > 0 ? max : 0;
  if (!lo && !hi) return null;
  if (lo && hi && lo !== hi) return `${fmtEok(lo)}~${fmtEok(hi)}`;
  return fmtEok(lo || hi);
}

function moveInText(v?: string | null): string | null {
  if (!v) return null;
  const digits = String(v).replace(/[^0-9]/g, '');
  if (digits.length < 6) return null;
  const y = digits.slice(0, 4);
  const m = Number(digits.slice(4, 6));
  if (!m || m > 12) return null;
  return `${y}.${String(m).padStart(2, '0')}`;
}

/**
 * D-day. 접수 시작 전이면 시작까지, 접수 중이면 마감까지 센다.
 * 지난 날짜는 '마감' 으로 접는다 — 'D+120' 은 아무에게도 쓸모가 없다.
 */
function ddayCell(start?: string | null, end?: string | null): { value: string; note: string } {
  const today = toDateKey(todayKST());
  const days = (target: string) => {
    const a = new Date(`${today}T00:00:00+09:00`).getTime();
    const b = new Date(`${target}T00:00:00+09:00`).getTime();
    if (!Number.isFinite(b)) return null;
    return Math.round((b - a) / 86400000);
  };

  const s = start ? toDateKey(new Date(start)) : null;
  const e = end ? toDateKey(new Date(end)) : null;

  if (s) {
    const d = days(s);
    if (d !== null && d > 0) return { value: `D-${d}`, note: '접수 시작까지' };
  }
  if (e) {
    const d = days(e);
    if (d !== null && d > 0) return { value: `D-${d}`, note: '접수 마감까지' };
    if (d === 0) return { value: 'D-Day', note: '오늘 마감' };
    if (d !== null) return { value: '마감', note: '접수 종료' };
  }
  return { value: '미정', note: '일정 미공개' };
}

const CELL: React.CSSProperties = {
  minWidth: 0,
  padding: '10px 8px',
  textAlign: 'center',
  borderRight: '1px solid var(--border)',
};

function Cell({ label, value, note, accent }: { label: string; value: string; note?: string; accent?: boolean }) {
  return (
    <div style={CELL}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 3, letterSpacing: '.02em' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 800,
          lineHeight: 1.25,
          letterSpacing: '-.03em',
          color: accent ? 'var(--brand)' : 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
      {note && (
        <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {note}
        </div>
      )}
    </div>
  );
}

export default function AptKeyMetrics({
  priceMin, priceMax, units, moveInDate, receiptEnd, receiptStart,
}: Props) {
  const price = priceText(priceMin, priceMax);
  const unit = unitCell(units);
  const move = moveInText(moveInDate);
  const dday = ddayCell(receiptStart, receiptEnd);

  return (
    <section
      aria-label="핵심 지표"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        margin: '0 0 var(--sp-md)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-surface)',
        overflow: 'hidden',
      }}
    >
      <Cell label="분양가" value={price ?? '미공개'} note={price ? '세대별 상이' : undefined} accent={!!price} />
      <Cell label={unit.label} value={unit.value} note={unit.note} />
      <Cell label="입주" value={move ?? '미정'} note={move ? '예정' : undefined} />
      <div style={{ ...CELL, borderRight: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 3 }}>청약</div>
        <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.25, letterSpacing: '-.03em', color: dday.value.startsWith('D-') ? 'var(--accent-red)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {dday.value}
        </div>
        <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {dday.note}
        </div>
      </div>
    </section>
  );
}
