/**
 * H5-2 — 2단 목록 한 덩어리.
 *
 *   첫 2건: 카드로 승격 (이미지 + 세대수 + 단계)
 *   나머지: 42px 텍스트 줄 (.kd-lrow 프리미티브 재사용)
 *
 * ⚠️ 승격 카드를 «네이비로 칠하지 않는다». 지시서 §1-8 이 「네이비 덩어리는 한 화면에
 *    하나」이고 부동산 홈에서 그 하나는 «선택된 타일·칩» 이다. 여기까지 네이비면
 *    화면에 네이비가 셋이 된다. 기존 카드면(--bg-surface)을 그대로 쓴다.
 *
 * ⚠️ AptCurationCard 를 재사용하지 않았다. 그 컴포넌트는 `AptHubItem`(청약 RPC 모양 —
 *    house_nm · region_nm · dday · thumb_url)을 받는데 여기 데이터는 `apt_sites` 모양이다.
 *    억지로 맞추려면 필드를 지어내야 한다. 지어낸 값은 화면에서 사실처럼 보인다.
 *
 * ⛔ `apt_sites.images` 를 참조하지 않는다 (S7-2 에서 걷어낸 배열이다).
 *    hero_image_url → cover_image_url 순으로만 본다. 둘 다 없으면 «이미지 자리를 안 만든다».
 */

import Link from 'next/link';
import type { RegionBlockItem } from '@/lib/apt/region-blocks';
import SafeImg from '@/components/apt/SafeImg';

const STAGE_LABEL: Record<string, string> = {
  site_planning: '사업 준비',
  union_established: '조합 설립',
  plan_approved: '사업시행인가',
  mgmt_approved: '관리처분인가',
  construction: '착공',
  pre_announcement: '분양예정',
  announced: '분양중',
  open: '접수중',
  leftover: '선착순',
  award_pending: '발표 대기',
  award_announced: '당첨자 발표',
  move_in_ready: '입주 예정',
  post_move_in: '입주 완료',
};

function fmtDate(d: string | null): string {
  if (!d) return '';
  const [, m, day] = d.split('-');
  return m && day ? `${Number(m)}월 ${Number(day)}일` : '';
}

function href(it: RegionBlockItem): string {
  return `/apt/${encodeURIComponent(it.slug || it.id)}`;
}

function thumb(it: RegionBlockItem): string | null {
  return it.hero_image_url || it.cover_image_url || null;
}

function sub(it: RegionBlockItem): string {
  return [
    it.sigungu,
    it.total_units ? `${it.total_units.toLocaleString()}세대` : '',
    it.lifecycle_stage ? (STAGE_LABEL[it.lifecycle_stage] || '') : '',
  ].filter(Boolean).join(' · ');
}

export default function RegionBlockList({
  items,
  title,
  meta,
  moreHref,
  moreLabel,
  emptyNote,
  anchorId,
}: {
  items: RegionBlockItem[];
  title: string;
  meta?: string;
  /** ⚠️ 실재하는 라우트만 넘긴다. 없는 곳으로 보내는 「더보기」는 이탈이다. */
  moreHref?: string;
  moreLabel?: string;
  emptyNote?: string;
  /** B7-0 — 캐러셀 꼬리 카드가 여기로 스크롤한다. 한글 제목을 id 로 쓰지 않는다. */
  anchorId?: string;
}) {
  const promoted = items.slice(0, 2);
  const rows = items.slice(2);

  return (
    <section className="apt-block" id={anchorId} aria-labelledby={`blk-${title}`}>
      <h2 id={`blk-${title}`} className="apt-block__h">
        {title}
        {meta && <span className="apt-block__meta">{meta}</span>}
      </h2>

      {items.length === 0 ? (
        <p className="apt-block__empty">{emptyNote || '해당하는 현장이 없습니다.'}</p>
      ) : (
        <>
          <div className="apt-block__cards">
            {promoted.map((it) => {
              const img = thumb(it);
              return (
                <Link key={it.id} href={href(it)} className="apt-pcard">
                  {img && (
                    <span className="apt-pcard__img">
                      {/* H7-3 ③ — 서버 컴포넌트지만 SafeImg 가 클라이언트 경계를 만든다. */}
                      <SafeImg src={img} />
                    </span>
                  )}
                  <span className="apt-pcard__body">
                    <span className="apt-pcard__t">{it.display_name || it.name}</span>
                    <span className="apt-pcard__m">{sub(it)}</span>
                    {it.rcept_bgnde && (
                      <span className="apt-pcard__d">청약 접수 {fmtDate(it.rcept_bgnde)}</span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>

          {rows.length > 0 && (
            <div className="apt-block__rows">
              {rows.map((it) => (
                <Link key={it.id} href={href(it)} className="kd-lrow">
                  <span className="kd-lrow-t">{it.display_name || it.name}</span>
                  <span className="kd-lrow-m">{sub(it)}</span>
                  <span className="kd-lrow-r">{fmtDate(it.rcept_bgnde)}</span>
                </Link>
              ))}
            </div>
          )}

          {moreHref && (
            <Link href={moreHref} className="apt-block__more">{moreLabel || '더 보기'}</Link>
          )}
        </>
      )}
    </section>
  );
}
