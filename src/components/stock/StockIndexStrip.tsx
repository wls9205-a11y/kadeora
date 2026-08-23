// v7-C2 — /stock 상단 지수 스트립. 3칸 한 줄 (코스피 · 코스닥 · 환율).
//
// ⚠️ 코스피·코스닥 **지수 값(2,650 같은 숫자)은 DB 에 없다.** 저장된 것은 종목 시세뿐이고
//    지수 레벨을 적재하는 테이블·크론이 없다. 없는 값을 지어내지 않는다.
//    대신 같은 화면에서 실제로 답할 수 있는 것을 낸다 — **등락 종목 수(시장 폭)**.
//    라벨도 '코스피 2,650' 이 아니라 '상승 180 · 하락 121' 이라고 쓴다.
//    지수 레벨을 넣으려면 적재 크론이 먼저 필요하다.
//
// 환율은 exchange_rates(USD 기준, 크론 갱신)에 실재하는 값이라 그대로 쓴다.

export type MarketBreadth = { up: number; down: number; flat: number; avg: number | null };
export type StripData = {
  kospi: MarketBreadth;
  kosdaq: MarketBreadth;
  usdkrw: number | null;
  usdkrwAt: string | null;
};

const CELL: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '8px 10px',
  borderRight: '1px solid var(--border)',
};

function Breadth({ label, b }: { label: string; b: MarketBreadth }) {
  const total = b.up + b.down + b.flat;
  return (
    <div style={CELL}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 3 }}>
        {label}
      </div>
      {total === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color: 'var(--accent-red)' }}>▲{b.up}</span>
            <span style={{ color: 'var(--accent-blue)' }}>▼{b.down}</span>
          </div>
          {b.avg !== null && (
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
              평균 {b.avg > 0 ? '+' : ''}{b.avg.toFixed(2)}%
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function StockIndexStrip({ data }: { data: StripData }) {
  return (
    <div
      aria-label="시장 요약"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        margin: '0 6px 10px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-surface)',
        overflow: 'hidden',
      }}
    >
      <Breadth label="코스피 등락" b={data.kospi} />
      <Breadth label="코스닥 등락" b={data.kosdaq} />
      <div style={{ ...CELL, borderRight: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 3 }}>
          원/달러
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {data.usdkrw ? data.usdkrw.toLocaleString('ko-KR', { maximumFractionDigits: 1 }) : '—'}
        </div>
        {data.usdkrwAt && (
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
            {new Date(data.usdkrwAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })} 기준
          </div>
        )}
      </div>
    </div>
  );
}
