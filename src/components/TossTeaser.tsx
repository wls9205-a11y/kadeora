'use client';
import { isTossMode, openInBrowser } from '@/lib/toss-mode';

/**
 * TossTeaser — 토스 앱인토스 → 카더라 본앱 유입 CTA
 * 
 * 사용법:
 * <TossTeaser path="/stock" label="주식 시세 전체 보기" />
 * <TossTeaser path="/blog/slug" variant="inline" />
 * <TossTeaser variant="banner" /> // 하단 고정 배너
 */

interface Props {
  path?: string;
  label?: string;
  subtitle?: string;
  variant?: 'card' | 'inline' | 'banner' | 'gate';
}

export default function TossTeaser({
  path = '/',
  label = '카더라에서 전체 보기',
  subtitle,
  variant = 'card',
}: Props) {
  // 토스 모드가 아니면 아무것도 렌더하지 않음
  if (typeof window !== 'undefined' && !isTossMode()) return null;

  const handleOpen = () => openInBrowser(path);

  // 인라인: 텍스트 링크
  if (variant === 'inline') {
    return (
      <button
        onClick={handleOpen}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#3182F6', fontWeight: 700, fontSize: 13,
          padding: '4px 0', fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}
      >
        {label} →
      </button>
    );
  }

  // 하단 고정 배너
  if (variant === 'banner') {
    return (
      <div
        className="toss-funnel-banner"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
          padding: '12px 20px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12,
          background: 'linear-gradient(135deg, #1B64DA 0%, #3182F6 100%)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        }}
      >
        <div>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>카더라</div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 1 }}>
            {subtitle || '주식·청약·부동산 정보를 더 자세히'}
          </div>
        </div>
        <button
          onClick={handleOpen}
          style={{
            padding: '10px 20px', borderRadius: 999, border: 'none',
            background: '#fff', color: '#1B64DA', fontWeight: 800,
            fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          {label}
        </button>
      </div>
    );
  }

  // 콘텐츠 게이트 (블러 + CTA)
  if (variant === 'gate') {
    return (
      <div style={{
        textAlign: 'center', padding: '32px 20px',
        background: 'linear-gradient(180deg, rgba(245,246,248,0) 0%, #F5F6F8 20%)',
        borderRadius: 'var(--radius-lg)', margin: '0 -4px',
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <div style={{ fontWeight: 800, fontSize: 16, color: '#191F28', marginBottom: 6 }}>
          전체 콘텐츠는 카더라에서
        </div>
        <div style={{ fontSize: 13, color: '#8B95A1', marginBottom: 16, lineHeight: 1.5 }}>
          {subtitle || '투자 정보 블로그, 실시간 종목 시세\n무료 가입하고 전부 확인하세요'}
        </div>
        <button
          onClick={handleOpen}
          style={{
            padding: '14px 32px', borderRadius: 'var(--radius-card)', border: 'none',
            background: 'linear-gradient(135deg, #1B64DA, #3182F6)',
            color: '#fff', fontWeight: 800, fontSize: 15,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 16px rgba(49,130,246,0.3)',
          }}
        >
          카더라 앱 열기
        </button>
        <div style={{ marginTop: 10, fontSize: 11, color: '#B0B8C1' }}>
          가입 10초 · 카카오 로그인
        </div>
      </div>
    );
  }

  // 기본: 카드 스타일 CTA
  return (
    <button
      onClick={handleOpen}
      style={{
        width: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 12,
        padding: '14px 18px', borderRadius: 'var(--radius-card)',
        background: 'linear-gradient(135deg, rgba(49,130,246,0.06) 0%, rgba(49,130,246,0.02) 100%)',
        border: '1.5px solid rgba(49,130,246,0.15)',
        cursor: 'pointer', fontFamily: 'inherit',
        marginTop: 8, marginBottom: 8,
      }}
    >
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#191F28' }}>
          {label}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: '#8B95A1', marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      <div style={{
        padding: '8px 16px', borderRadius: 999,
        background: '#3182F6', color: '#fff',
        fontWeight: 700, fontSize: 12, flexShrink: 0,
      }}>
        열기 →
      </div>
    </button>
  );
}

/**
 * TossFunnelGate — 토스 모드에서 콘텐츠를 N개로 제한하고 CTA 표시
 * 
 * <TossFunnelGate limit={5} path="/feed" label="전체 피드 보기">
 *   {posts.map(p => <PostCard key={p.id} />)}
 * </TossFunnelGate>
 */
export function TossFunnelGate({
  children,
  limit = 5,
  path = '/',
  label = '전체 보기',
  subtitle,
  showCount,
  totalCount,
}: {
  children: React.ReactNode;
  limit?: number;
  path?: string;
  label?: string;
  subtitle?: string;
  showCount?: number;
  totalCount?: number;
}) {
  // SSR에서는 children 그대로 반환
  if (typeof window === 'undefined') return <>{children}</>;
  if (!isTossMode()) return <>{children}</>;

  // children에서 limit개만 표시
  const arr = Array.isArray(children)
    ? children.slice(0, limit)
    : children;

  const countText = totalCount
    ? `${showCount || limit}개만 표시 중 · 전체 ${totalCount.toLocaleString()}개`
    : `${showCount || limit}개만 미리보기`;

  return (
    <>
      {arr}
      <div style={{ padding: '4px 0' }}>
        <div style={{
          textAlign: 'center', fontSize: 12, color: '#8B95A1',
          marginBottom: 8,
        }}>
          {countText}
        </div>
        <TossTeaser
          path={path}
          label={label}
          subtitle={subtitle || '카더라에서 전체 데이터를 확인하세요'}
        />
      </div>
    </>
  );
}
