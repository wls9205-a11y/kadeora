// v7-D1(재작업) — 홈 블록 행.
//
// 큰 카드 → .kd-lrow 로 교체한다. 카드 3장 높이에 5건이 들어가고,
// DOM 텍스트 총량은 그대로라 색인에 손대지 않으면서 화면만 컴팩트해진다.
// 목록 3종(/apt · /stock · /blog)과 같은 행 규격이라 리듬도 맞는다.
//
// 좌측 64×64 썸네일, 행 높이 72px 상한 (.kd-lrow--thumb).
// 주식만 64×40 스파크라인을 쓴다 — 종목 사진 데이터가 0건이고 로고는 상표 문제가 있다
// (V4-C7-3 에서 정한 규격 그대로. StockListRow 를 그대로 재사용한다).

import Link from 'next/link';
import ListThumb from '@/components/ui/ListThumb';
import { aptHref } from '@/lib/apt/hub';
import { isSafeImage } from '@/lib/blog/safe-image';
import type { AptIssueScore } from '@/lib/issue/types';

/** D-day 배지 — 제목 줄 앞. 좌측 칸은 썸네일이 가져갔다. */
function ddayBadge(d: number | null): { cls: string; label: string } | null {
  if (d == null) return null;
  if (d < 0) return { cls: 'kd-lrow-badge', label: '마감' };
  if (d <= 3) return { cls: 'kd-lrow-badge is-hot', label: d === 0 ? 'D-Day' : `D-${d}` };
  if (d <= 7) return { cls: 'kd-lrow-badge is-soon', label: `D-${d}` };
  if (d <= 30) return { cls: 'kd-lrow-badge is-rest', label: `D-${d}` };
  return { cls: 'kd-lrow-badge', label: `D-${d}` };
}

function formatPyeong(p: number | null | undefined): string | null {
  if (p == null || p <= 0) return null;
  return `${Math.round(p / 10000)}만/평`;
}

export function HomeAptRow({ data }: { data: AptIssueScore }) {
  const badge = ddayBadge(data.dday);
  const pyeong = formatPyeong(data.price_per_pyeong);
  const meta = [data.region_nm, data.house_ty ? `${data.house_ty}㎡` : null]
    .filter(Boolean)
    .join(' · ');

  // ⚠️ 기존 AptIssueCard 는 /apt/subscription/{id} 로 링크했는데 그런 라우트가 없다
  //    (src/app/(main)/apt 에 subscription 디렉터리 없음 — 5건 전부 404 였다).
  //    /apt 목록과 같은 aptHref 를 쓴다.
  const href = aptHref({ house_nm: data.house_nm, house_manage_no: null, id: data.id });

  return (
    <Link href={href} className="kd-lrow kd-lrow--thumb" style={{ textDecoration: 'none', color: 'inherit' }}>
      <ListThumb src={data.thumbnail_url} name={data.house_nm || ''} />
      <span style={{ minWidth: 0 }}>
        <span className="kd-lrow-t">
          {badge && <span className={badge.cls}>{badge.label}</span>}
          {data.house_nm}
        </span>
        {meta && (
          <span className="kd-lrow-m">
            <span>{meta}</span>
          </span>
        )}
      </span>
      <span className="kd-lrow-r">
        {pyeong ?? <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)' }}>미공개</span>}
        {data.households_count ? (
          <span style={{ display: 'block', marginTop: 1, fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)' }}>
            {data.households_count.toLocaleString('ko-KR')}세대
          </span>
        ) : null}
      </span>
    </Link>
  );
}

export type HomeBlogItem = {
  slug: string;
  title: string;
  cover_image: string | null;
  category: string | null;
  readers?: number;
};

export function HomeBlogRow({ post }: { post: HomeBlogItem }) {
  // 판정은 safe-image.ts 하나만 쓴다 — 외부 스크랩(발행분 24.7%)을 통과시키지 않는다.
  // 통과 못 하면 ListThumb 이 같은 64×64 이니셜 블록을 그린다.
  const thumb = isSafeImage(post.cover_image) ? post.cover_image : null;

  return (
    <Link href={`/blog/${post.slug}`} className="kd-lrow kd-lrow--thumb" style={{ textDecoration: 'none', color: 'inherit' }}>
      <ListThumb src={thumb} name={post.title || ''} />
      <span style={{ minWidth: 0 }}>
        <span className="kd-lrow-t is-two" style={{ margin: 0 }}>{post.title}</span>
        {(post.category || post.readers) && (
          <span className="kd-lrow-m">
            {post.category && <span>{post.category}</span>}
            {/* 누적 view_count 는 봇이 섞여 있어 쓰지 않는다 — 30일 사람 조회만 표기한다. */}
            {post.readers ? (
              <span className="kd-lrow-m-fix">최근 30일 {post.readers.toLocaleString()}명</span>
            ) : null}
          </span>
        )}
      </span>
      <span className="kd-lrow-r" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>
        읽기 ›
      </span>
    </Link>
  );
}
