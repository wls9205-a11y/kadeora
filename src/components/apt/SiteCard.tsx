// s3 — 큐레이션 현장 카드.
//
// 히어로 이미지는 satellite_image_url 하나만 쓴다 (Architecture Rule #71).
// 시행사 완공 예상도는 DB 에 0장이고, images 배열은 뉴스 썸네일 스크랩이라 출처 혼재·오매칭이 있다.
// 위성 이미지는 VWorld(국토교통부 공간정보 오픈플랫폼) 타일을 자체 호스팅한 것으로,
// 그 부지의 실제 모습이라 청약홈 원본으로 정확한 정보를 내는 서비스 성격과 맞는다.
//
// 위성이 없는 행은 빈 이미지 슬롯을 만들지 않고 표 행(SiteRow)으로 떨어뜨린다.

import Link from 'next/link';
import Image from 'next/image';
import LifecycleRail from '@/components/apt/LifecycleRail';

export interface CuratedSite {
  slug: string;
  name: string;
  region: string | null;
  sigungu: string | null;
  builder: string | null;
  curated_status: string | null;
  curated_copy: string | null;
  satellite_image_url: string | null;
  price_min: number | null;   // 만원
  price_max: number | null;   // 만원
  total_units: number | null;
  lifecycle_stage: string | null;
}

/** 상태 → 토큰. 신규 색 도입 없이 S1 의 --status-* 만 쓴다. */
const STATUS_COLOR: Record<string, string> = {
  선착순: 'var(--status-fcfs)',
  분양중: 'var(--status-open)',
  접수중: 'var(--status-open)',
  분양예정: 'var(--status-soon)',
  분양완료: 'var(--status-closed)',
};

export function statusColor(status: string | null | undefined): string {
  return (status && STATUS_COLOR[status]) || 'var(--status-closed)';
}

/** 만원 → '4.86억'. 10억 미만은 소수 2자리, 이상은 1자리. */
function eok(manwon: number): string {
  const v = manwon / 10000;
  return `${v >= 10 ? v.toFixed(1) : v.toFixed(2)}억`;
}

export function priceRange(site: CuratedSite): string | null {
  const lo = site.price_min || 0;
  const hi = site.price_max || 0;
  if (!lo && !hi) return null;
  if (lo && hi && lo !== hi) return `${eok(lo)} ~ ${eok(hi)}`;
  return eok(lo || hi);
}

/** '코오롱글로벌주식회사' → '코오롱글로벌' */
export function shortBuilder(builder: string | null): string | null {
  if (!builder) return null;
  return builder.replace(/주식회사|\(주\)|㈜/g, '').split('(')[0].trim() || null;
}

const MONO = {
  fontFamily: 'var(--font-mono)',
  fontVariantNumeric: 'tabular-nums' as const,
};

function StatusPill({ status }: { status: string | null }) {
  if (!status) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 9px',
        borderRadius: 4,
        fontSize: 'var(--fs-xs)',
        fontWeight: 500,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        color: 'var(--text-inverse)',
        background: statusColor(status),
      }}
    >
      {status}
    </span>
  );
}

export default function SiteCard({ site }: { site: CuratedSite }) {
  const href = `/apt/${encodeURIComponent(site.slug)}`;
  const price = priceRange(site);
  const builder = shortBuilder(site.builder);

  return (
    <Link
      href={href}
      className="site-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: 640,
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
        background: 'var(--bg-surface)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        style={{
          position: 'relative',
          aspectRatio: '16 / 10',
          background: 'var(--bg-elevated)',
        }}
      >
        {site.satellite_image_url ? (
          <Image
            src={site.satellite_image_url}
            alt={`${site.name} 위성 사진`}
            fill
            sizes="(max-width: 767px) 100vw, 400px"
            style={{ objectFit: 'cover' }}
          />
        ) : null}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: 8,
            gap: 8,
          }}
        >
          <StatusPill status={site.curated_status} />
          {site.sigungu ? (
            <span
              style={{
                padding: '3px 9px',
                borderRadius: 4,
                fontSize: 'var(--fs-xs)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                background: 'var(--bg-surface-translucent)',
                color: 'var(--text-secondary)',
              }}
            >
              {site.sigungu}
            </span>
          ) : null}
        </div>
      </div>

      <div className="site-card-body" style={{ padding: '10px 12px 12px' }}>
        <div
          className="site-card-title"
          style={{
            fontSize: 'var(--fs-lg)',
            fontWeight: 600,
            lineHeight: 1.3,
            letterSpacing: '-.02em',
            color: 'var(--text-primary)',
            wordBreak: 'keep-all',
          }}
        >
          {site.name}
        </div>

        {builder ? (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginTop: 3 }}>
            {builder}
          </div>
        ) : null}

        {site.curated_copy ? (
          <p
            style={{
              fontSize: 'var(--fs-xs)',
              color: 'var(--text-tertiary)',
              lineHeight: 1.55,
              margin: '5px 0 0',
              wordBreak: 'keep-all',
            }}
          >
            {site.curated_copy}
          </p>
        ) : null}

        {price ? (
          <div style={{ ...MONO, fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--text-primary)', marginTop: 9 }}>
            {price}
          </div>
        ) : null}

        {site.total_units ? (
          <div style={{ ...MONO, fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
            일반분양 {site.total_units.toLocaleString('ko-KR')}세대
          </div>
        ) : null}

        <div style={{ marginTop: 10 }}>
          <LifecycleRail stage={site.lifecycle_stage} size="mini" />
        </div>
      </div>

      <style>{`
        .site-card-title {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        @media (max-width: 479.98px) {
          .site-card-body { padding: 9px 10px 10px; }
          .site-card-title { -webkit-line-clamp: 3; }
        }
      `}</style>
    </Link>
  );
}

/**
 * 위성 이미지가 없는 현장. 빈 이미지 슬롯 대신 표 한 행으로 낸다.
 * apt-satellite-crawl 크론이 30분 주기로 채우므로 코드에서 특별 처리하지 않는다.
 */
export function SiteRow({ site }: { site: CuratedSite }) {
  const price = priceRange(site);
  const builder = shortBuilder(site.builder);
  const meta = [builder, site.sigungu].filter(Boolean).join(' · ');

  return (
    <Link
      href={`/apt/${encodeURIComponent(site.slug)}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 12px',
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--bg-surface)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <StatusPill status={site.curated_status} />
        </div>
        <div
          style={{
            fontSize: 'var(--fs-sm)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {site.name}
        </div>
        {meta ? (
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{meta}</div>
        ) : null}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ ...MONO, fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          {price ?? '분양가 미공개'}
        </div>
        {site.total_units ? (
          <div style={{ ...MONO, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
            {site.total_units.toLocaleString('ko-KR')}세대
          </div>
        ) : null}
      </div>
    </Link>
  );
}
