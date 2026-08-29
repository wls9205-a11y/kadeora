// v7-C3 — /stock 데스크탑 우측 레일.
//
// /apt 의 AptHubRail 과 같은 패턴이다. 레일은 페이지가 소유한다 —
// 전역 RightPanel 을 지운 이유가 페이지 맥락과 무관해서였고, 그 자리를 이렇게 메운다.
//
// ①시장 지수 ②급등·급락 ③테마.
// 데이터는 페이지가 이미 받은 것만 쓴다 — 새 조회 0건.

import Link from 'next/link';
import { formatChangePct, getStockTone, stockChipTextColor } from '@/lib/stockColor';
import { stockHref, type StockParams } from '@/lib/stock/filters';
import type { StripData } from '@/components/stock/StockIndexStrip';

export type MoverRow = { symbol: string; name: string; change_pct: number | null };

function MoverList({ rows }: { rows: MoverRow[] }) {
  return (
    <>
      {rows.map((r) => {
        // 배경 없이 글자로만 쓴다 — chip.color 는 limit 계열에서 #FFFFFF 라 쓰면 안 된다.
        const chipFg = stockChipTextColor(getStockTone(r.change_pct));
        return (
          <Link
            key={r.symbol}
            href={`/stock/${r.symbol}`}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}
          >
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.name}
            </span>
            <span style={{ flexShrink: 0, fontSize: 'var(--fs-2xs)', fontWeight: 700, color: chipFg, fontVariantNumeric: 'tabular-nums' }}>
              {formatChangePct(r.change_pct)}
            </span>
          </Link>
        );
      })}
    </>
  );
}

export default function StockHubRail({
  params,
  strip,
  gainers,
  losers,
  themes,
}: {
  params: StockParams;
  strip: StripData;
  gainers: MoverRow[];
  losers: MoverRow[];
  themes: string[];
}) {
  return (
    <>
      {/* ① 시장 지수 — 지수 레벨은 DB 에 없어 등락 종목 수로 낸다 (StockIndexStrip 주석 참조) */}
      <div className="kd-rail-panel">
        <h2>시장</h2>
        <div style={{ display: 'grid', gap: 6, fontSize: 'var(--fs-2xs)' }}>
          {([
            { label: '코스피', b: strip.kospi, key: 'kospi' as const },
            { label: '코스닥', b: strip.kosdaq, key: 'kosdaq' as const },
          ]).map(({ label, b, key }) => (
            <Link
              key={key}
              href={stockHref(params, { market: key })}
              scroll={false}
              style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: 0, padding: '4px 0' }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
              <span style={{ flexShrink: 0, fontSize: 'var(--fs-2xs)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: 'var(--accent-red)' }}>▲{b.up}</span>
                <span style={{ marginLeft: 5, color: 'var(--accent-blue)' }}>▼{b.down}</span>
              </span>
            </Link>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', color: 'var(--text-secondary)' }}>
            <span style={{ flex: 1, minWidth: 0 }}>원/달러</span>
            <span style={{ flexShrink: 0, fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {strip.usdkrw ? strip.usdkrw.toLocaleString('ko-KR', { maximumFractionDigits: 1 }) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* ② 급등·급락 */}
      {(gainers.length > 0 || losers.length > 0) && (
        <div className="kd-rail-panel">
          <h2>급등</h2>
          <MoverList rows={gainers} />
          {losers.length > 0 && (
            <>
              <h2 style={{ marginTop: 12 }}>급락</h2>
              <MoverList rows={losers} />
            </>
          )}
        </div>
      )}

      {/* ③ 테마 */}
      {themes.length > 0 && (
        <div className="kd-rail-panel">
          <h2>테마</h2>
          <div style={{ display: 'flex', gap: 'var(--sp-xs)', flexWrap: 'wrap' }}>
            {themes.slice(0, 10).map((t) => (
              <Link
                key={t}
                href={stockHref(params, { theme: t })}
                scroll={false}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: 30,
                  padding: '0 10px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--border)',
                  background: params.theme === t ? 'var(--brand)' : 'var(--bg-sunken)',
                  color: params.theme === t ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  fontSize: 'var(--fs-2xs)',
                  fontWeight: params.theme === t ? 600 : 500,
                  textDecoration: 'none',
                  borderBottom: params.theme === t ? '1px solid var(--brand)' : '1px solid var(--border)',
                }}
              >
                #{t}
              </Link>
            ))}
          </div>
          <Link href="/stock/themes" style={{ borderBottom: 0, marginTop: 8, color: 'var(--text-secondary)' }}>
            테마 전체 보기 →
          </Link>
        </div>
      )}

      <div className="kd-rail-panel">
        <h2>바로가기</h2>
        <Link href="/stock/compare">종목 비교</Link>
        <Link href="/stock/short-selling">공매도 현황</Link>
        <Link href="/stock/overseas">해외 증시</Link>
        <Link href="/stock/signals">시그널</Link>
        <Link href="/stock/search">종목 검색</Link>
      </div>
    </>
  );
}
