/**
 * AnonymousFeedHero — 비로그인 사용자에게 가입 가치 + 라이브 데이터 노출
 *
 * 위치: /feed 진입 시 비로그인이면 FeedClient 위에 배치
 * 데이터: get_homepage_for_anonymous() RPC (SECURITY DEFINER + EXCEPTION 핸들러)
 *   → cta + hot_blogs(6) + hot_topics(8) + value_props + upcoming_apts(5)
 *
 * 목표: 비로그인 0.34% → 1% 로그인 페이지 진입율 향상
 *
 * SSR 컴포넌트 (서버에서 렌더 → 크롤러도 가입 가치 인덱싱)
 */
import Link from 'next/link';
import { SITE_URL } from '@/lib/constants';

interface ValueProp {
  icon: string;
  title: string;
  desc: string;
}
interface HotBlog {
  id: number;
  slug: string;
  title: string;
  category: string;
  view_count: number;
  cover_image: string | null;
}
interface HotTopic {
  slug: string;
  label: string;
  blog_count: number;
  search_volume: number;
}
interface UpcomingApt {
  house_nm: string;
  region_nm: string;
  rcept_endde: string;
  days_left: number;
}
interface HomepageData {
  cta?: {
    primary?: { label: string; href: string };
    subtitle?: string;
    social_proof?: string;
  };
  hot_blogs?: HotBlog[];
  hot_topics?: HotTopic[];
  upcoming_apts?: UpcomingApt[];
  value_props?: {
    value_props?: ValueProp[];
    real_active_users?: number;
    community_post_count?: number;
    apt_active_count?: number;
    apt_complex_count?: number;
    blog_count?: number;
    calc_count?: number;
    stock_count?: number;
  };
}

const DEFAULT_VALUE_PROPS: ValueProp[] = [
  { icon: '🏠', title: '관심 단지 알림', desc: '실거래가·청약 마감 자동 알림' },
  { icon: '📊', title: '계산 결과 저장', desc: '50개 계산기 결과 영구 보관·공유' },
  { icon: '📈', title: '관심 종목 추적', desc: '실시간 주가·AI 분석 받기' },
];

export default function AnonymousFeedHero({ data }: { data: HomepageData | null }) {
  const cta = data?.cta || { primary: { label: '카카오로 3초 가입', href: '/login?source=anon_feed_hero' }, subtitle: '가입하면 관심 단지·종목·청약을 자동으로 추적합니다', social_proof: '활성 사용자 110명이 사용 중' };
  const valuePropsList: ValueProp[] = (data?.value_props?.value_props && data.value_props.value_props.length > 0)
    ? data.value_props.value_props.slice(0, 4)
    : DEFAULT_VALUE_PROPS;
  const hotBlogs = (data?.hot_blogs || []).slice(0, 4);
  const hotTopics = (data?.hot_topics || []).slice(0, 6);
  const upcomingApts = (data?.upcoming_apts || []).slice(0, 3);
  const stats = data?.value_props || {};

  return (
    <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* s173: 거대 🚀 CTA 카드 제거. 컴팩트 1줄 CTA 는 FeedClient 가 피드 중간 (i===2) 에 삽입. */}

      {/* 2. 가치 제안 그리드 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
        gap: 10,
      }}>
        {valuePropsList.map((p, i) => (
          <div key={i} style={{
            padding: 14, background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{p.icon}</span>
            <div>
              <div style={{ fontSize: 'var(--fs-sm, 13px)', fontWeight: 700, color: 'var(--text-primary)' }}>{p.title}</div>
              <div style={{ marginTop: 2, fontSize: 'var(--fs-xs, 12px)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{p.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 3. 라이브 통계 (사이트 활성도 증명) */}
      {(stats.blog_count || stats.community_post_count || stats.apt_complex_count || stats.stock_count) && (
        <div style={{
          padding: '12px 16px', background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center',
          fontSize: 'var(--fs-xs, 12px)', color: 'var(--text-tertiary)',
        }}>
          {stats.blog_count != null && (<span>📰 블로그 <strong style={{ color: 'var(--text-primary)' }}>{stats.blog_count.toLocaleString('ko-KR')}편</strong></span>)}
          {stats.community_post_count != null && (<span>💬 커뮤니티 글 <strong style={{ color: 'var(--text-primary)' }}>{stats.community_post_count.toLocaleString('ko-KR')}+</strong></span>)}
          {stats.apt_complex_count != null && (<span>🏢 단지 <strong style={{ color: 'var(--text-primary)' }}>{stats.apt_complex_count.toLocaleString('ko-KR')}+</strong></span>)}
          {stats.stock_count != null && (<span>📈 종목 <strong style={{ color: 'var(--text-primary)' }}>{stats.stock_count.toLocaleString('ko-KR')}+</strong></span>)}
        </div>
      )}

      {/* 4. 마감 임박 청약 (긴급성 부여) */}
      {upcomingApts.length > 0 && (
        <div>
          <div style={{ fontSize: 'var(--fs-sm, 13px)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            🔥 마감 임박 청약
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {upcomingApts.map((apt, i) => (
              <Link
                key={i}
                href={`/apt?q=${encodeURIComponent(apt.house_nm)}&source=anon_feed_hero`}
                style={{
                  flexShrink: 0, minWidth: 200, padding: 12, textDecoration: 'none',
                  background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--accent-red, #ef4444)', fontWeight: 700, marginBottom: 4 }}>
                  D-{apt.days_left} · {apt.region_nm}
                </div>
                <div style={{ fontSize: 'var(--fs-sm, 13px)', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {apt.house_nm}
                </div>
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
                  마감 {apt.rcept_endde}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 5. 인기 블로그 (콘텐츠 가치 증명) */}
      {hotBlogs.length > 0 && (
        <div>
          <div style={{ fontSize: 'var(--fs-sm, 13px)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            📰 지금 인기 블로그
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {hotBlogs.map((b) => (
              <Link
                key={b.id}
                href={`/blog/${b.slug}?source=anon_feed_hero`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', textDecoration: 'none',
                  background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8,
                  fontSize: 'var(--fs-sm, 13px)', color: 'var(--text-primary)',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 12 }}>
                  {b.title}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                  👁 {b.view_count.toLocaleString('ko-KR')}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 6. 인기 계산기 토픽 (검색 의도 매칭) */}
      {hotTopics.length > 0 && (
        <div>
          <div style={{ fontSize: 'var(--fs-sm, 13px)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            🧮 자주 찾는 계산기
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {hotTopics.map((t) => (
              <Link
                key={t.slug}
                href={`/calc/topic/${t.slug}?source=anon_feed_hero`}
                style={{
                  padding: '6px 12px', textDecoration: 'none',
                  background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 999,
                  fontSize: 12, color: 'var(--text-secondary)',
                }}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
