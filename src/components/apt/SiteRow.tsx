/**
 * B7-1 — 전 목록 공용 «컴팩트 2줄 행».
 *
 *   1줄  [단계] 표시명 …………………………………                    날짜(우측)
 *   2줄  구군 · 세대 · 분양가 · 경쟁률 · D-day · 태그
 *
 * ── 왜 하나로 모으나 ────────────────────────────────────────────────────────
 * 같은 「현장 한 줄」을 /apt 두 덩어리 · 홈 · 지역 허브 · 검색 · 「다른 현장」이
 * 제각기 그리고 있었다. 줄 높이도 정보 순서도 화면마다 달라 눈이 익지 않는다.
 *
 * ⛔ null 은 «항목째» 사라진다. 구분점만 남기지 않는다 —
 *    「해운대구 ·  · 」 같은 줄은 데이터가 없다는 사실조차 못 전한다.
 * ⚠️ 분양가는 «이미 판정된» 값만 받는다(lib/home/sections.ts priceOf).
 *    여기서 다시 판정하지 않는다 — 판정이 두 곳에 있으면 한쪽만 고치게 된다.
 * ⚠️ 숫자는 tabular-nums. 날짜·세대수가 우측에서 흔들리면 목록이 지저분해진다.
 * ⚠️ 단계 라벨은 «지금은» lifecycleLabel 이다. B7-2 에서 stageLabel(site) 로 수렴한다
 *    (청약 현장의 construction 은 「착공」이 아니라 「공사 중 · 잔여세대」여야 한다).
 */

import Link from 'next/link';
import { lifecycleLabel } from '@/lib/apt/lifecycle-label';
import { siteDisplayName } from '@/lib/apt/site-name';

export interface SiteRowItem {
  slug: string | null;
  name: string;
  region?: string | null;
  sigungu?: string | null;
  lifecycle_stage?: string | null;
  total_units?: number | null;
  /** 만원 단위. ⚠️ 가짜 가격 판정을 «통과한» 값만 넘길 것. */
  price?: { min: number; max: number } | null;
  /** 최고 경쟁률. */
  competition?: number | null;
  /** 청약 단계에서만 넘긴다. 지난 날짜는 넘기지 않는다. */
  dday?: number | null;
  /** 우측 날짜(YYYY-MM-DD). */
  date?: string | null;
  /**
   * 배지를 «갈아 끼운다». 없으면 단계 라벨.
   *
   * ⚠️ 홈 「최근 움직인 현장」의 배지는 단계가 아니라 «이동»(「접수중 → 당첨자 발표」)이다.
   *    그게 그 섹션의 의미라 단계 배지로 덮으면 섹션이 말하려던 것을 잃는다.
   */
  badge?: string | null;
  /** 청약 라인처럼 «먼저 읽혀야 하는» 배지. */
  badgeAccent?: boolean;
  /**
   * 2줄 meta 를 통째로 갈아 끼운다.
   *
   * ⚠️ 홈 「최근 움직인」의 meta 에는 세대수 뒤의 「예정」(confidence 미확정)과 시공사가
   *    들어 있다. 표시광고법 때문에 넣은 조건이라 기본 meta 로 바꾸면 «빠진다».
   * ⛔ 「줄을 통일한다」가 「정보를 버린다」가 되지 않게 하는 탈출구다. 남용하지 말 것.
   */
  metaOverride?: string | null;
}

/** 12개월 안이면 `12.22`, 넘으면 `'25.12.22`. 연도는 «필요할 때만» 쓴다. */
function dateText(d: string | null | undefined): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return '';
  const t = new Date(`${d}T00:00:00+09:00`).getTime();
  if (Number.isNaN(t)) return '';
  const months = Math.abs(Date.now() - t) / (1000 * 60 * 60 * 24 * 30.44);
  const short = `${Number(m)}.${Number(day)}`;
  return months > 12 ? `'${y.slice(2)}.${short}` : short;
}

function priceText(p: { min: number; max: number }): string {
  const a = Math.round((p.min / 10000) * 10) / 10;
  const b = Math.round((p.max / 10000) * 10) / 10;
  return a === b ? `${a}억` : `${a}~${b}억`;
}

export default function SiteRow({ item }: { item: SiteRowItem }) {
  const { name, tags } = siteDisplayName(item.name, item.region, item.sigungu);
  const badge = item.badge ?? lifecycleLabel(item.lifecycle_stage);

  // ⛔ filter(Boolean) 로 «항목째» 걸러 낸 뒤 합친다. 빈 조각을 넣고 구분점을 다듬지 않는다.
  const meta = item.metaOverride ?? [
    item.sigungu || item.region || '',
    item.total_units && item.total_units > 0 ? `${item.total_units.toLocaleString('ko-KR')}세대` : '',
    item.price ? priceText(item.price) : '',
    item.competition && item.competition > 0 ? `최고 ${item.competition}:1` : '',
    item.dday != null && item.dday >= 0 ? (item.dday === 0 ? '오늘 마감' : `D-${item.dday}`) : '',
    ...tags,
  ].filter(Boolean).join(' · ');

  return (
    <Link href={`/apt/${encodeURIComponent(item.slug || '')}`} className="kd-srow">
      <span className="kd-srow__l1">
        {badge && (
          <span className={item.badgeAccent ? 'kd-srow__badge kd-srow__badge--accent' : 'kd-srow__badge'}>
            {badge}
          </span>
        )}
        <span className="kd-srow__name">{name}</span>
        {item.date && <span className="kd-srow__date">{dateText(item.date)}</span>}
      </span>
      {meta && <span className="kd-srow__l2">{meta}</span>}
    </Link>
  );
}

/** 목록 컨테이너. 구분선을 «행이 아니라 목록» 이 그린다(마지막 줄 아래에 선이 남지 않게). */
export function SiteRowList({ items }: { items: SiteRowItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="kd-srows">
      {items.map((it) => <SiteRow key={it.slug || it.name} item={it} />)}
    </div>
  );
}
