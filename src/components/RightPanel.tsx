'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { GRADE_EMOJI, gradeTitle } from '@/lib/constants';
import { getAvatarColor } from '@/lib/avatar';
import { useAuth } from '@/components/AuthProvider';
import dynamic from 'next/dynamic';

const MiniLounge = dynamic(() => import('@/components/MiniLounge'), { ssr: false });

const GRADES = [
  { emoji: '🌱', title: '새싹', pts: '0' }, { emoji: '📡', title: '정보통', pts: '100' },
  { emoji: '🏘️', title: '동네어른', pts: '500' }, { emoji: '🏠', title: '소문난집', pts: '1.5K' },
  { emoji: '⚡', title: '인플루언서', pts: '3K' }, { emoji: '🔥', title: '빅마우스', pts: '6K' },
  { emoji: '💎', title: '찐고수', pts: '15K' }, { emoji: '🌟', title: '전설', pts: '30K' },
  { emoji: '👑', title: '신의경지', pts: '60K' }, { emoji: '🚀', title: '카더라신', pts: '∞' },
];

const FALLBACK = ['삼성전자', 'AI 반도체', '청약 경쟁률', '엔비디아', '기준금리', '아파트 실거래', 'KOSPI', '전세가율', '미분양', 'ETF 비교'];

export default function RightPanel() {
  const [trending, setTrending] = useState<{ keyword: string }[]>([]);
  const { userId, profile: authProfile } = useAuth();
  const pathname = usePathname();
  const [recBlogs, setRecBlogs] = useState<{ slug: string; title: string }[]>([]);
  const [indices, setIndices] = useState<{name:string;price:number;pct:number}[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1200) return;

    fetch('/api/search/trending').then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.keywords?.length) setTrending(d.keywords.slice(0, 10)); })

    const sb = createSupabaseBrowser();
    sb.from('blog_posts').select('slug, title')
      .eq('is_published', true)
      .order('view_count', { ascending: false })
      .limit(3)
      .then(({ data }) => { if (data?.length) setRecBlogs(data); })

    sb.from('stock_quotes').select('name, price, change_pct').in('name', ['KOSPI', 'KOSDAQ']).then(({data}) => {
      if (data) setIndices(data.map((d:any) => ({name: d.name, price: Number(d.price), pct: Number(d.change_pct) || 0})));
    });
  }, []);

  const display = trending.length > 0 ? trending : FALLBACK.map(k => ({ keyword: k }));

  return (
    <div style={{ width: 200, flexShrink: 0, position: 'sticky', top: 72, height: 'fit-content', display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)', paddingTop: 8 }}>
      {/* 프로필 카드 */}
      {userId && authProfile && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 'var(--card-p)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: getAvatarColor(authProfile.nickname ?? '유저'), display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-inverse)', fontSize: 'var(--fs-base)', fontWeight: 700,
            }}>
              {(authProfile.nickname ?? '유')[0].toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)' }}>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{authProfile.nickname}</span>
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                {GRADE_EMOJI[authProfile.grade] ?? '🌱'} {gradeTitle(authProfile.grade)} · {(authProfile.points ?? 0).toLocaleString()}P
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Link href={`/profile/${userId}`} style={{
              flex: 1, textAlign: 'center', fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '6px 0', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-hover)', color: 'var(--text-secondary)', textDecoration: 'none',
            }}>내 프로필</Link>
            <Link href="/write" style={{
              flex: 1, textAlign: 'center', fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '6px 0', borderRadius: 'var(--radius-sm)',
              background: 'var(--brand)', color: 'var(--text-inverse)', textDecoration: 'none',
            }}>글쓰기</Link>
          </div>
        </div>
      )}
      {!userId && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 'var(--card-p)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--sp-sm)' }}>주식 알림 · 청약 마감 알림</div>
          <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} style={{
            display: 'block', padding: '8px 0', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)', fontWeight: 700,
            background: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)', textDecoration: 'none',
          }}>카카오로 3초 가입</Link>
        </div>
      )}

      {/* 친구 초대 미니 배너 (로그인 유저만) */}
      {userId && (
        <Link href={`/profile/${userId}#invite`} style={{ display: 'block', background: 'linear-gradient(135deg, rgba(59,123,246,0.06), rgba(46,232,165,0.04))', border: '1px solid rgba(59,123,246,0.12)', borderRadius: 'var(--radius-card)', padding: '10px 12px', textDecoration: 'none', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)' }}>👥 친구 초대하면 둘 다 +50P!</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>내 초대코드 확인하기 →</div>
        </Link>
      )}

      {/* 실시간 라운지 채팅 */}
      <MiniLounge />

      {/* 인기 검색어 (10개) */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 'var(--sp-md) var(--card-p)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>🔥 인기 검색어</span>
          <Link href="/search" style={{ fontSize: 10, color: 'var(--text-tertiary)', textDecoration: 'none' }}>더보기</Link>
        </div>
        {display.slice(0, 10).map((item, i) => (
          <Link key={i} href={`/search?q=${encodeURIComponent(item.keyword)}`} className="kd-card-hover" style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', padding: '4px 4px', borderRadius: 'var(--radius-xs)', margin: '0 -4px' }}>
            <span style={{ fontSize: 10, fontWeight: 800, width: 16, textAlign: 'center', color: i === 0 ? 'var(--brand)' : i < 3 ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
              {i + 1}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: i < 3 ? 600 : 400 }}>{item.keyword}</span>
          </Link>
        ))}
      </div>

      {/* 미니 시황 */}
      {indices.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 'var(--sp-md) var(--card-p)', marginTop: 'var(--sp-sm)' }}>
          <Link href="/stock" style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 'var(--sp-sm)', display: 'block', textDecoration: 'none' }}>📊 시장 현황</Link>
          <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
            {indices.map(idx => (
              <div key={idx.name} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>{idx.name}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{idx.price.toLocaleString()}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: idx.pct > 0 ? 'var(--accent-red)' : idx.pct < 0 ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}>
                  {idx.pct > 0 ? '▲' : idx.pct < 0 ? '▼' : '━'}{Math.abs(idx.pct).toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 추천 읽을거리 */}
      {recBlogs.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 'var(--sp-md) var(--card-p)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)' }}>추천 읽을거리</span>
            <Link href="/blog" style={{ fontSize: 'var(--fs-xs)', color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>더보기 →</Link>
          </div>
          {recBlogs.map((b: Record<string, any>) => (
            <Link key={b.slug} href={`/blog/${b.slug}`} style={{
              display: 'block', padding: '5px 0', textDecoration: 'none',
              fontSize: 'var(--fs-xs)', color: 'var(--text-primary)', lineHeight: 1.4,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              borderBottom: '1px solid var(--border)',
            }}>{b.title}</Link>
          ))}
        </div>
      )}

      {/* 등급 안내 (항상 펼침) */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
        <div style={{
          padding: 'var(--sp-md) var(--card-p)', fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)',
        }}>
          등급 안내
        </div>
        <div style={{ padding: '0 14px 12px' }}>
          {GRADES.map((g, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 'var(--fs-sm)' }}>
              <span>{g.emoji}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{g.title}</span>
              <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>{g.pts}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 푸터 정보 */}
      <div style={{ padding: '8px 4px', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
        <Link href="/guide" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>가이드</Link>
        {' · '}
        <Link href="/terms" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>이용약관</Link>
        {' · '}
        <Link href="/privacy" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>개인정보</Link>
        <div style={{ marginTop: 'var(--sp-xs)' }}>카더라 · 사업자 278-57-00801</div>
      </div>
    </div>
  );
}
