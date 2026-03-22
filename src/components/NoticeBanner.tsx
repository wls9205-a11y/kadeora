'use client';
import { useEffect, useState, useRef } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import Avatar from '@/components/Avatar';

interface NoticeData {
  id: number;
  content: string;
  is_active: boolean;
  is_paid: boolean;
  tier: string;
  text_color: string | null;
  bg_color: string | null;
  display_start: string | null;
  display_end: string | null;
  linked_post_id: string | null;
  author_id: string | null;
  click_count: number;
  impression_count: number;
  max_impressions: number | null;
  priority: number;
  author?: {
    id: string;
    nickname: string | null;
    avatar_url: string | null;
    grade_title: string | null;
  } | null;
}

// 티어별 스타일
const TIER_STYLES: Record<string, { color: string; bg: string; glow: string; icon: string; speed: number }> = {
  free:     { color: '#4ade80', bg: 'var(--bg-sunken)', glow: 'none', icon: '📡', speed: 35 },
  standard: { color: '#4ade80', bg: 'var(--bg-sunken)', glow: 'none', icon: '📡', speed: 30 },
  premium:  { color: '#fbbf24', bg: 'linear-gradient(90deg, #0a1a0a 0%, #1a1a0a 50%, #0a1a0a 100%)', glow: '0 0 8px rgba(251,191,36,0.3)', icon: '⭐', speed: 28 },
  urgent:   { color: '#f87171', bg: 'linear-gradient(90deg, #1a0505 0%, #200a0a 50%, #1a0505 100%)', glow: '0 0 12px rgba(248,113,113,0.4)', icon: '🚨', speed: 22 },
};

export default function NoticeBanner() {
  const [notices, setNotices] = useState<NoticeData[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showSheet, setShowSheet] = useState(false);
  const impressionLogged = useRef<Set<number>>(new Set());

  useEffect(() => {
    const sb = createSupabaseBrowser();

    sb.from('site_notices')
      .select('id, content, is_active, is_paid, tier, text_color, bg_color, display_start, display_end, linked_post_id, author_id, click_count, impression_count, max_impressions, priority, profiles:author_id(id, nickname, avatar_url, grade_title)')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .order('id', { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) return;

        const now = Date.now();
        const valid = data.filter((n: any) => {
          if (!n.is_paid) return true;
          const start = n.display_start ? new Date(n.display_start).getTime() : 0;
          const end = n.display_end ? new Date(n.display_end).getTime() : Infinity;
          return now >= start && now <= end;
        }).map((n: any) => ({
          ...n,
          tier: n.tier || 'free',
          author: Array.isArray(n.profiles) ? n.profiles[0] : n.profiles,
        })) as NoticeData[];

        if (valid.length > 0) setNotices(valid);
      })
      .catch(() => {});
  }, []);

  // 유료 전광판이 여러 개면 로테이션 (15초마다)
  useEffect(() => {
    if (notices.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIdx(prev => (prev + 1) % notices.length);
    }, 15000);
    return () => clearInterval(timer);
  }, [notices.length]);

  // 노출 카운트 추적
  useEffect(() => {
    if (notices.length === 0) return;
    const notice = notices[currentIdx];
    if (!notice || impressionLogged.current.has(notice.id)) return;
    impressionLogged.current.add(notice.id);

    // fire-and-forget
    createSupabaseBrowser().rpc('increment_banner_impression', { p_notice_id: notice.id }).catch(() => {});
  }, [currentIdx, notices]);

  if (notices.length === 0) return null;

  const notice = notices[currentIdx];
  const tier = notice.tier || 'free';
  const style = TIER_STYLES[tier] || TIER_STYLES.free;
  const textColor = notice.text_color || style.color;
  const bgStyle = notice.bg_color
    ? { background: notice.bg_color }
    : style.bg.startsWith('linear')
      ? { background: style.bg }
      : { background: style.bg };

  const handleClick = () => {
    // 클릭 카운트 추적
    createSupabaseBrowser().rpc('increment_banner_click', { p_notice_id: notice.id }).catch(() => {});
    setShowSheet(true);
  };

  // 남은 시간 계산 (유료)
  const getTimeRemaining = () => {
    if (!notice.display_end) return null;
    const diff = new Date(notice.display_end).getTime() - Date.now();
    if (diff <= 0) return '만료됨';
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}시간 남음`;
    return `${Math.ceil(hours / 24)}일 남음`;
  };

  return (
    <>
      {/* ═══ 전광판 배너 ═══ */}
      <div
        style={{
          ...bgStyle,
          borderBottom: tier === 'urgent' ? '1px solid rgba(248,113,113,0.3)' : tier === 'premium' ? '1px solid rgba(251,191,36,0.2)' : '1px solid var(--border)',
          height: 45,
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 52,
          flexShrink: 0,
          cursor: 'pointer',
          padding: '6px 0',
        }}
        onClick={handleClick}
      >
        {/* 좌/우 페이드 그라데이션 */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 40, background: `linear-gradient(to right, ${notice.bg_color || (tier === 'urgent' ? '#1a0505' : tier === 'premium' ? '#0a1a0a' : 'var(--bg-sunken)')}, transparent)`, zIndex: 2, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: notices.length > 1 ? 44 : 0, top: 0, bottom: 0, width: 40, background: `linear-gradient(to left, ${notice.bg_color || (tier === 'urgent' ? '#1a0505' : tier === 'premium' ? '#0a1a0a' : 'var(--bg-sunken)')}, transparent)`, zIndex: 2, pointerEvents: 'none' }} />

        {/* 스크롤 텍스트 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            whiteSpace: 'nowrap',
            animation: `kd-marquee-v2 ${style.speed}s linear infinite`,
            paddingLeft: '100%',
            fontSize: 'var(--fs-base)',
            fontWeight: 600,
            color: textColor,
            letterSpacing: '0.03em',
            textShadow: style.glow,
          }}
        >
          {[0, 1, 2].map(i => (
            <span key={i}>
              {i > 0 && <span style={{ margin: '0 60px', color: 'var(--text-tertiary)', fontSize: 'var(--fs-base)' }}>◆</span>}
              <span>{style.icon}&nbsp;{notice.content}</span>
              {notice.is_paid && notice.author?.nickname && (
                <span style={{ marginLeft: 8, fontSize: 'var(--fs-xs)', opacity: 0.6 }}>— {notice.author.nickname}</span>
              )}
            </span>
          ))}
        </div>

        {/* 여러 전광판일 때 인디케이터 */}
        {notices.length > 1 && (
          <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 3, zIndex: 3 }}>
            {notices.map((_, i) => (
              <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: i === currentIdx ? textColor : 'rgba(255,255,255,0.2)', transition: 'background 0.3s' }} />
            ))}
          </div>
        )}

        <style>{`@keyframes kd-marquee-v2 { 0% { transform: translateX(0); } 100% { transform: translateX(-33.33%); } }`}</style>
      </div>

      {/* ═══ 바텀시트 상세 ═══ */}
      {showSheet && (
        <>
          <div onClick={() => setShowSheet(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999 }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10000, background: 'var(--bg-surface)', borderRadius: '16px 16px 0 0', padding: '20px 16px', maxHeight: '65vh', overflowY: 'auto' }} className="animate-modalIn">

            {/* 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {style.icon} {notice.is_paid ? '전광판 광고' : '공지사항'}
                </span>
                {notice.is_paid && (
                  <span style={{
                    fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                    background: tier === 'urgent' ? '#ef444420' : tier === 'premium' ? '#f59e0b20' : '#22c55e20',
                    color: tier === 'urgent' ? '#f87171' : tier === 'premium' ? '#fbbf24' : '#4ade80',
                  }}>
                    {{ standard: '기본', premium: '프리미엄', urgent: '긴급' }[tier] || tier}
                  </span>
                )}
              </div>
              <button onClick={() => setShowSheet(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 'var(--fs-lg)', cursor: 'pointer' }}>✕</button>
            </div>

            {/* 작성자 (유료) */}
            {notice.author && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-hover)', borderRadius: 12, marginBottom: 16 }}>
                <Avatar src={notice.author.avatar_url} nickname={notice.author.nickname} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>{notice.author.nickname ?? '사용자'}</div>
                  {notice.author.grade_title && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>{notice.author.grade_title}</div>}
                </div>
                <a href={`/profile/${notice.author.id}`} style={{ fontSize: 'var(--fs-sm)', color: 'var(--brand)', textDecoration: 'none', fontWeight: 600, padding: '6px 12px', border: '1px solid var(--brand)', borderRadius: 8, flexShrink: 0 }}>프로필</a>
              </div>
            )}

            {/* 내용 */}
            <div style={{ fontSize: 'var(--fs-base)', lineHeight: 1.7, color: 'var(--text-primary)', whiteSpace: 'pre-line', marginBottom: 16, padding: '16px', background: 'var(--bg-hover)', borderRadius: 12, borderLeft: `3px solid ${textColor}` }}>
              {notice.content}
            </div>

            {/* 게시글 링크 */}
            {notice.linked_post_id && (
              <a href={`/feed/${notice.linked_post_id}`} style={{ display: 'block', padding: '12px 16px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none', marginBottom: 16, fontSize: 'var(--fs-sm)', color: 'var(--brand)', fontWeight: 600 }}>
                📄 관련 게시글 보기 →
              </a>
            )}

            {/* 통계 (유료만) */}
            {notice.is_paid && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px', background: 'var(--bg-hover)', borderRadius: 8 }}>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)' }}>{notice.impression_count || 0}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>노출</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px', background: 'var(--bg-hover)', borderRadius: 8 }}>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)' }}>{notice.click_count || 0}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>클릭</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px', background: 'var(--bg-hover)', borderRadius: 8 }}>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--brand)' }}>
                    {notice.impression_count ? ((notice.click_count / notice.impression_count) * 100).toFixed(1) : '0.0'}%
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>클릭률</div>
                </div>
                {getTimeRemaining() && (
                  <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px', background: 'var(--bg-hover)', borderRadius: 8 }}>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--warning)' }}>{getTimeRemaining()}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>잔여</div>
                  </div>
                )}
              </div>
            )}

            {/* 유료 표시 + 구매 유도 */}
            {notice.is_paid ? (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textAlign: 'center', marginBottom: 12 }}>
                이 전광판은 유료 노출 상품으로 등록된 콘텐츠입니다
              </div>
            ) : (
              <a href="/shop/banner" style={{ display: 'block', textAlign: 'center', padding: '10px 16px', background: 'var(--brand-light)', borderRadius: 10, textDecoration: 'none', marginBottom: 12, fontSize: 'var(--fs-sm)', color: 'var(--brand)', fontWeight: 600 }}>
                📡 나도 전광판에 광고하기 →
              </a>
            )}

            <button onClick={() => setShowSheet(false)} style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 'var(--fs-base)', fontWeight: 600, cursor: 'pointer' }}>닫기</button>
          </div>
        </>
      )}
    </>
  );
}
