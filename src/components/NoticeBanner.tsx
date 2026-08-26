'use client';
import { useEffect, useState, useRef } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import Avatar from '@/components/Avatar';
import { isReadable } from '@/lib/ui/contrast';

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
  free:     { color: 'var(--accent-green)', bg: 'var(--bg-sunken)', glow: 'none', icon: '📡', speed: 35 },
  standard: { color: 'var(--accent-green)', bg: 'var(--bg-sunken)', glow: 'none', icon: '📡', speed: 30 },
  premium:  { color: 'var(--accent-yellow)', bg: 'linear-gradient(90deg, var(--ink-bg-deep) 0%, var(--ink-bg) 50%, var(--ink-bg-deep) 100%)', glow: '0 0 8px rgba(251,191,36,0.3)', icon: '⭐', speed: 28 },
  urgent:   { color: 'var(--accent-red)', bg: 'linear-gradient(90deg, #120E16 0%, #150D12 50%, #120E16 100%)', glow: '0 0 12px rgba(248,113,113,0.4)', icon: '🚨', speed: 22 },
};

export default function NoticeBanner() {
  const [notices, setNotices] = useState<NoticeData[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showSheet, setShowSheet] = useState(false);
  const [mounted, setMounted] = useState(false);
  const impressionLogged = useRef<Set<number>>(new Set());
  // v7-V8: 광고주 지정 색이 읽히는지 판정한 결과. CSS 변수를 getComputedStyle 로 펴야 해서
  //   마운트 뒤에만 잴 수 있다. 재기 전에는 안전한 쪽(기본색)으로 둔다.
  const [colorOk, setColorOk] = useState({ text: false, bg: false });
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    // 5분 캐시: 매 페이지 로드마다 DB 쿼리 방지
    const CACHE_KEY = 'kd_notices_cache';
    const CACHE_TTL = 5 * 60 * 1000;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data: cachedData, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL && cachedData?.length) {
          setNotices(cachedData);
          return;
        }
      }
    } catch {}

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
        const valid = data.filter((n: Record<string, any>) => {
          if (!n.is_paid) return true;
          const start = n.display_start ? new Date(n.display_start).getTime() : 0;
          const end = n.display_end ? new Date(n.display_end).getTime() : Infinity;
          return now >= start && now <= end;
        }).map((n: Record<string, any>) => ({
          ...n,
          tier: n.tier || 'free',
          author: Array.isArray(n.profiles) ? n.profiles[0] : n.profiles,
        })) as NoticeData[];

        if (valid.length > 0) {
          setNotices(valid);
          try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: valid, ts: Date.now() })); } catch {}
        }
      })
  }, []);

  // 유료 전광판이 여러 개면 로테이션 (15초마다)
  useEffect(() => {
    if (notices.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIdx(prev => (prev + 1) % notices.length);
    }, 15000);
    return () => clearInterval(timer);
  }, [notices.length]);

  /**
   * v7-V8 — 광고주 지정 색 대비 검사.
   *
   * site_notices.text_color / bg_color 는 광고주 입력값이다(유료 배너 기능).
   * 실제로 다크 시절 색 #00ff88 이 남아 라이트 배경 위에서 1.13:1 로 안 보였다.
   * DB 값은 고쳤지만 다음 광고주가 또 넣는다.
   *
   * ⚠️ 차단이 아니라 폴백이다 — 저장은 그대로 두고 표시만 방어한다.
   * ⚠️ 배경도 사용자 지정이므로 **배경을 먼저 판정하고, 통과한 배경 기준으로** 글자를 잰다.
   *    떨어진 배경 위에서 글자를 재면 실제로 보이는 조합과 다른 값을 재게 된다.
   * ⚠️ 그라디언트처럼 못 재는 값은 통과시키지 않는다 (기본색으로 떨어진다).
   */
  useEffect(() => {
    if (!mounted || notices.length === 0) return;
    const n = notices[currentIdx];
    if (!n) return;
    const tierStyle = TIER_STYLES[n.tier || 'free'] || TIER_STYLES.free;

    // 1) 배경: 사용자 지정이 읽을 수 있는 값인지. 티어 기본이 그라디언트면 잴 수 없다.
    const bgOk = !!n.bg_color && isReadable(tierStyle.color, n.bg_color, 'var(--bg-base)');
    const effectiveBg = bgOk ? n.bg_color! : tierStyle.bg;

    // 2) 글자: 확정된 배경 기준으로 잰다.
    const textOk = !!n.text_color && isReadable(n.text_color, effectiveBg, 'var(--bg-base)');

    setColorOk({ text: textOk, bg: bgOk });
  }, [mounted, notices, currentIdx]);

  // 노출 카운트 추적
  useEffect(() => {
    if (notices.length === 0) return;
    const notice = notices[currentIdx];
    if (!notice || impressionLogged.current.has(notice.id)) return;
    impressionLogged.current.add(notice.id);

    // fire-and-forget
  }, [currentIdx, notices]);

  // 세션 156: mount 전 + 데이터 로드 중 placeholder — CLS 방지
  if (!mounted) return <div aria-hidden="true" style={{ minHeight: 40 }} />;
  if (notices.length === 0) return null;

  const notice = notices[currentIdx];
  const tier = notice.tier || 'free';
  const style = TIER_STYLES[tier] || TIER_STYLES.free;
  // v7-V8: 대비 검사를 통과한 사용자 색만 쓴다. 나머지는 티어 기본색.
  //   colorOk 는 마운트 뒤에 채워지므로 첫 페인트는 항상 기본색이다 (안전한 쪽).
  const safeBgColor = colorOk.bg ? notice.bg_color : null;
  const textColor = colorOk.text && notice.text_color ? notice.text_color : style.color;
  const bgStyle = { background: safeBgColor || style.bg };

  const handleClick = () => {
    // 클릭 카운트 추적
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
          height: 34,
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 50,
          flexShrink: 0,
          cursor: 'pointer',
          padding: '4px 0',
        }}
        onClick={handleClick}
      >
        {/* 좌/우 페이드 그라데이션 */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 40, background: `linear-gradient(to right, ${safeBgColor || (tier === 'urgent' ? 'var(--ink-bg)' : tier === 'premium' ? 'var(--ink-bg-deep)' : 'var(--bg-sunken)')}, transparent)`, zIndex: 2, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: notices.length > 1 ? 44 : 0, top: 0, bottom: 0, width: 40, background: `linear-gradient(to left, ${safeBgColor || (tier === 'urgent' ? 'var(--ink-bg)' : tier === 'premium' ? 'var(--ink-bg-deep)' : 'var(--bg-sunken)')}, transparent)`, zIndex: 2, pointerEvents: 'none' }} />

        {/* 스크롤 텍스트 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            whiteSpace: 'nowrap',
            animation: `kd-marquee-v2 ${style.speed}s linear infinite`,
            paddingLeft: '100%',
            fontSize: 13,
            fontWeight: 600,
            color: textColor,
            letterSpacing: '0.03em',
            textShadow: style.glow,
          }}
        >
          {[0, 1, 2].map(i => (
            <span key={i}>
              {i > 0 && <span style={{ margin: '0 40px', color: 'var(--text-tertiary)', fontSize: 'var(--fs-base)' }}>◆</span>}
              <span>{style.icon}&nbsp;{notice.content}</span>
              {notice.is_paid && notice.author?.nickname && (
                <span style={{ marginLeft: 8, fontSize: 'var(--fs-xs)', opacity: 0.6 }}>— {notice.author.nickname}</span>
              )}
            </span>
          ))}
        </div>

        {/* 여러 전광판일 때 인디케이터 */}
        {notices.length > 1 && (
          <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4, zIndex: 3 }}>
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
          <div onClick={() => setShowSheet(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100 }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 90, background: 'var(--bg-surface)', borderRadius: '16px 16px 0 0', padding: '20px 16px', maxHeight: '65vh', overflowY: 'auto' }} className="animate-modalIn">

            {/* 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
                <span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {style.icon} {notice.is_paid ? '전광판 광고' : '공지사항'}
                </span>
                {notice.is_paid && (
                  <span style={{
                    fontSize: 'var(--fs-xs)', padding: '3px 8px', borderRadius: 'var(--radius-md)', fontWeight: 500,
                    background: tier === 'urgent' ? 'rgba(248,113,113,0.12)' : tier === 'premium' ? 'rgba(251,191,36,0.12)' : 'rgba(52,211,153,0.12)',
                    color: tier === 'urgent' ? 'var(--accent-red)' : tier === 'premium' ? 'var(--accent-yellow)' : 'var(--accent-green)',
                  }}>
                    {{ standard: '기본', premium: '프리미엄', urgent: '긴급' }[tier] || tier}
                  </span>
                )}
              </div>
              <button onClick={() => setShowSheet(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 'var(--fs-lg)', cursor: 'pointer' }} aria-label="닫기">✕</button>
            </div>

            {/* 작성자 (유료) */}
            {notice.author && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)', padding: '12px 16px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-card)', marginBottom: 'var(--sp-lg)' }}>
                <Avatar src={notice.author.avatar_url} nickname={notice.author.nickname} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)' }}>{notice.author.nickname ?? '사용자'}</div>
                  {notice.author.grade_title && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>{notice.author.grade_title}</div>}
                </div>
                <a href={`/profile/${notice.author.id}`} style={{ fontSize: 'var(--fs-sm)', color: 'var(--brand)', textDecoration: 'none', fontWeight: 600, padding: '6px 12px', border: '1px solid var(--brand)', borderRadius: 'var(--radius-sm)', flexShrink: 0 }}>프로필</a>
              </div>
            )}

            {/* 내용 */}
            <div style={{ fontSize: 'var(--fs-base)', lineHeight: 1.7, color: 'var(--text-primary)', whiteSpace: 'pre-line', marginBottom: 'var(--sp-lg)', padding: '16px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-card)', borderLeft: `3px solid ${textColor}` }}>
              {notice.content}
            </div>

            {/* 게시글 링크 */}
            {notice.linked_post_id && (
              <a href={`/feed/${notice.linked_post_id}`} style={{ display: 'block', padding: '12px 16px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textDecoration: 'none', marginBottom: 'var(--sp-lg)', fontSize: 'var(--fs-sm)', color: 'var(--brand)', fontWeight: 600 }}>
                📄 관련 게시글 보기 →
              </a>
            )}

            {/* 통계 (유료만) */}
            {notice.is_paid && (
              <div style={{ display: 'flex', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-lg)' }}>
                <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>{notice.impression_count || 0}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>노출</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>{notice.click_count || 0}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>클릭</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--brand)' }}>
                    {notice.impression_count ? ((notice.click_count / notice.impression_count) * 100).toFixed(1) : '0.0'}%
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>클릭률</div>
                </div>
                {getTimeRemaining() && (
                  <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--warning)' }}>{getTimeRemaining()}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>잔여</div>
                  </div>
                )}
              </div>
            )}

            {/* 유료 표시 + 구매 유도 */}
            {notice.is_paid && (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textAlign: 'center', marginBottom: 'var(--sp-md)' }}>
                이 전광판은 유료 노출 상품으로 등록된 콘텐츠입니다
              </div>
            )}

            <button aria-label="닫기" onClick={() => setShowSheet(false)} style={{ width: '100%', padding: '12px 0', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 'var(--fs-base)', fontWeight: 600, cursor: 'pointer' }}>닫기</button>
          </div>
        </>
      )}
    </>
  );
}
