/**
 * H5-2 1단 — 17 시도 타일.
 *
 * ── 왜 타일인가 ─────────────────────────────────────────────────────────────
 * 지금까지 `/apt` 는 처음 열면 «어느 한 지역» 을 이미 골라 놓은 상태로 시작했다.
 * 전국 플랫폼인데 첫 화면이 한 지역이면, 다른 지역 사용자는 자기 지역이 여기
 * 있는지조차 모른다. 타일은 「전국이 다 있다」를 한눈에 보여주는 자리다.
 *
 * ⚠️ 0건인 시도를 «숨기지 않는다». 회색으로 둔다.
 *    숨기면 「우리 지역은 없구나」가 아니라 「이 사이트에 없구나」로 읽힌다.
 *
 * ⚠️ 미디어쿼리가 아니라 «컨테이너 쿼리» 다(H5-D4). 데스크탑 2단에서 이 그리드가
 *    좁은 좌측 컬럼에 들어가는데, 뷰포트는 넓다 — 뷰포트 기준이면 8열로 펴져 깨진다.
 *
 * ⛔ 시도 실루엣·아이콘 없음. 17개를 그리면 관리 대상이 17개 늘고,
 *    글자보다 알아보기 어렵다.
 */

import Link from 'next/link';
import RegionTileLink from './RegionTileLink';

export interface RegionTileItem {
  /** 시도 라벨 */
  region: string;
  /** content_score ≥ 40 인 현장 수 */
  count: number;
}

/**
 * 세종·제주는 묶어서 낸다. 둘 다 물량이 적어 단독 타일이면 계속 빈칸처럼 보인다.
 * ⚠️ 묶는 것은 «표시» 뿐이다. 링크는 각각의 시도로 간다(대표는 건수가 많은 쪽).
 */
const PAIRED: Array<[string, string]> = [['세종', '제주']];

export default function RegionTileGrid({
  items,
  current,
}: {
  items: RegionTileItem[];
  /** 선택된 시도. 1단에서는 보통 비어 있다. */
  current?: string;
}) {
  const byName = new Map(items.map((i) => [i.region, i.count]));
  const used = new Set<string>();
  const tiles: Array<{ label: string; href: string; count: number; region: string }> = [];

  for (const [a, b] of PAIRED) {
    const ca = byName.get(a) ?? 0;
    const cb = byName.get(b) ?? 0;
    if (!byName.has(a) && !byName.has(b)) continue;
    used.add(a); used.add(b);
    const lead = ca >= cb ? a : b;
    tiles.push({
      label: `${a}·${b}`,
      region: lead,
      href: `/apt?region=${encodeURIComponent(lead)}`,
      count: ca + cb,
    });
  }
  for (const it of items) {
    if (used.has(it.region)) continue;
    tiles.push({
      label: it.region,
      region: it.region,
      href: `/apt?region=${encodeURIComponent(it.region)}`,
      count: it.count,
    });
  }

  if (tiles.length === 0) return null;

  return (
    <section className="region-grid" aria-labelledby="region-grid-h">
      <h2 id="region-grid-h" className="region-grid__h">지역을 고르세요</h2>
      <div className="region-grid__tiles">
        {tiles.map((t) => (
          <RegionTileLink
            key={t.label}
            href={t.href}
            region={t.region}
            label={t.label}
            count={t.count}
            active={!!current && current === t.region}
          />
        ))}
      </div>
      {/* 경로형 허브는 색인 자산이라 그대로 둔다 — 타일은 `?region=`(noindex) 로 간다. */}
      <p className="region-grid__note">
        지역별 종합 정보는 <Link href="/apt/region/부산">지역 허브</Link>에서 볼 수 있습니다.
      </p>
    </section>
  );
}
