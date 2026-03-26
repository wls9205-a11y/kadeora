'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { GRADE_EMOJI, gradeTitle } from '@/lib/constants';
import { getAvatarColor } from '@/lib/avatar';
import { useAuth } from '@/components/AuthProvider';

const GRADES = [
  { emoji: '🌱', title: '새싹', pts: '0' }, { emoji: '📡', title: '정보통', pts: '100' },
  { emoji: '🏘️', title: '동네어른', pts: '500' }, { emoji: '🏠', title: '소문난집', pts: '1.5K' },
  { emoji: '⚡', title: '인플루언서', pts: '3K' }, { emoji: '🔥', title: '빅마우스', pts: '6K' },
  { emoji: '💎', title: '찐고수', pts: '15K' }, { emoji: '🌟', title: '전설', pts: '30K' },
  { emoji: '👑', title: '신의경지', pts: '60K' }, { emoji: '🚀', title: '카더라신', pts: '∞' },
];

const FALLBACK = ['삼성전자', 'AI 반도체', '청약 경쟁률', '엔비디아', '기준금리'];

export default function RightPanel() {
  const [trending, setTrending] = useState<{ keyword: string }[]>([]);
  const { userId, profile: authProfile } = useAuth();
  const pathname = usePathname();
  const [recBlogs, setRecBlogs] = useState<{ slug: string; title: string }[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1200) return;

    fetch('/api/search/trending').then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.keywords?.length) setTrending(d.keywords.slice(0, 5)); })

    const sb = createSupabaseBrowser();
    sb.from('blog_posts').select('slug, title')
      .eq('is_published', true)
      .order('view_count', { ascending: false })
      .limit(3)
      .then(({ data }) => { if (data?.length) setRecBlogs(data); })
  }, []);

  const display = trending.length > 0 ? trending : FALLBACK.map(k => ({ keyword: k }));

  return (
    <div style={{ width: 200, flexShrink: 0, position: 'sticky', top: 72, height: 'fit-content', display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
      {/* 프로필 카드 */}
      {userId && authProfile && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{authProfile.nickname}</span>
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                {GRADE_EMOJI[authProfile.grade] ?? '🌱'} {gradeTitle(authProfile.grade)} · {(authProfile.points ?? 0).toLocaleString()}P
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Link href={`/profile/${userId}`} style={{
              flex: 1, textAlign: 'center', fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '6px 0', borderRadius: 8,
              background: 'var(--bg-hover)', color: 'var(--text-secondary)', textDecoration: 'none',
            }}>내 프로필</Link>
            <Link href="/write" style={{
              flex: 1, textAlign: 'center', fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '6px 0', borderRadius: 8,
              background: 'var(--brand)', color: 'var(--text-inverse)', textDecoration: 'none',
            }}>글쓰기</Link>
          </div>
        </div>
      )}
      {!userId && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>카더라와 함께하세요!</div>
          <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} style={{
            display: 'block', padding: '8px 0', borderRadius: 8, fontSize: 'var(--fs-sm)', fontWeight: 700,
            background: 'var(--brand)', color: 'var(--text-inverse)', textDecoration: 'none',
          }}>로그인 / 회원가입</Link>
        </div>
      )}

      {/* 인기 검색어 (5개) */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>인기 검색어</div>
        {display.map((item, i) => (
          <Link key={i} href={`/search?q=${encodeURIComponent(item.keyword)}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', padding: '4px 0' }}>
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, minWidth: 14, color: i < 3 ? 'var(--brand)' : 'var(--text-tertiary)' }}>{i + 1}</span>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.keyword}</span>
          </Link>
        ))}
      </div>

      {/* 추천 읽을거리 */}
      {recBlogs.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
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

      {/* 비로그인 가입 유도 */}
      {!userId && (
        <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} style={{
          display: 'block', textAlign: 'center', padding: '12px 14px',
          borderRadius: 12, background: 'var(--kakao-bg, #FEE500)', textDecoration: 'none',
          fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--kakao-text, #191919)',
        }}>카카오로 3초 가입</Link>
      )}

      {/* 등급 안내 (항상 펼침) */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{
          padding: '10px 14px', fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)',
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
        <div style={{ marginTop: 4 }}>카더라 · 사업자 278-57-00801</div>
      </div>
    </div>
  );
}
