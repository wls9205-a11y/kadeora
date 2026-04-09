'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import BottomSheet from '@/components/BottomSheet';
import { useToast } from '@/components/Toast';
import { track } from '@/lib/analytics';

interface Props { title: string; postId?: number | string; content?: string; compact?: boolean; category?: string; }
interface Platform { id: string; label: string; emoji: string; bg: string; color: string; isNew?: boolean; }

const BASE_PLATFORMS: Platform[] = [
  { id: 'kakao', label: '카카오톡', emoji: '💬', bg: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)' },
  { id: 'naver-blog', label: '네이버 블로그', emoji: 'N', bg: '#03C75A', color: '#fff', isNew: true },
  { id: 'naver-cafe', label: '네이버 카페', emoji: 'N', bg: '#1EC800', color: '#fff', isNew: true },
  { id: 'band', label: '밴드', emoji: '🟢', bg: '#06C755', color: '#fff' },
  { id: 'daum-cafe', label: '다음 카페', emoji: 'D', bg: '#FF5722', color: '#fff', isNew: true },
  { id: 'twitter', label: 'X', emoji: '𝕏', bg: '#1DA1F2', color: 'var(--text-inverse)' },
  { id: 'facebook', label: '페이스북', emoji: 'f', bg: '#1877F2', color: 'var(--text-inverse)' },
  { id: 'copy', label: '링크 복사', emoji: '🔗', bg: 'var(--bg-hover)', color: 'var(--text-primary)' },
];

function addUtm(url: string, platform: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}utm_source=${platform}&utm_medium=share&utm_campaign=viral`;
}

/** 네이버 블로그/카페 공유용 Rich HTML 본문 생성 */
function generateShareBody(title: string, content: string | undefined, url: string, category?: string): { html: string; plain: string } {
  const desc = content?.slice(0, 200) || '카더라에서 확인하세요';
  const ogSquare = `${url.split('/blog/')[0] || 'https://kadeora.app'}/api/og-square?title=${encodeURIComponent(title)}&category=${category || 'general'}`;
  const siteUrl = url.split('/blog/')[0] || 'https://kadeora.app';

  const catLabel = category === 'stock' ? '주식·시세' : category === 'apt' ? '청약·분양' : category === 'unsold' ? '미분양' : category === 'finance' ? '재테크·절세' : '생활정보';
  const tags = category === 'stock'
    ? '#주식분석 #종목분석 #주가전망 #투자 #카더라'
    : category === 'apt'
    ? '#아파트 #실거래가 #청약 #분양 #부동산 #카더라'
    : category === 'unsold'
    ? '#미분양 #부동산 #할인분양 #카더라'
    : '#재테크 #절세 #계산기 #카더라';

  const html = `<p><img src="${ogSquare}" alt="${title}" width="630" style="max-width:100%;border-radius:8px;" /></p>
<h3>${title}</h3>
<p>${desc}</p>
<blockquote style="border-left:3px solid #03C75A;padding:8px 12px;margin:12px 0;background:#f9f9f9;">
<b>${catLabel} 분석</b><br/>
카더라 데이터 기반 종합 분석 리포트입니다.<br/>
2026년 최신 데이터 기준으로 작성되었습니다.
</blockquote>
<p><b>관련 무료 도구</b></p>
<ul>
<li><a href="${siteUrl}/calc">무료 계산기 145종</a></li>
<li><a href="${siteUrl}/apt">전국 청약·분양 정보</a></li>
<li><a href="${siteUrl}/stock">실시간 주식 시세</a></li>
<li><a href="${siteUrl}/blog">데이터 분석 블로그</a></li>
</ul>
<p>👉 <a href="${url}"><b>전체 분석 보기</b></a></p>
<p>${tags}</p>
<p style="font-size:12px;color:#999;">ⓒ 카더라 (kadeora.app) — 부동산·주식 데이터 분석 플랫폼</p>`;

  const plain = `${title}

${desc}

━━━━━━━━━━━━━━
📊 ${catLabel} 분석
카더라 데이터 기반 종합 분석 리포트
2026년 최신 데이터 기준
━━━━━━━━━━━━━━

🔗 관련 무료 도구
• 무료 계산기 145종: ${siteUrl}/calc
• 전국 청약·분양 정보: ${siteUrl}/apt
• 실시간 주식 시세: ${siteUrl}/stock
• 데이터 분석 블로그: ${siteUrl}/blog

👉 전체 분석 보기
${url}

${tags}

ⓒ 카더라 (kadeora.app) — 부동산·주식 데이터 분석 플랫폼`;

  return { html, plain };
}

export default function ShareButtons({ title, postId, content, compact, category }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareCount, setShareCount] = useState(0);
  const [supportsNative, setSupportsNative] = useState(false);
  const { success, info } = useToast();

  useEffect(() => {
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    setSupportsNative(isMobile && !!navigator.share);
    if (postId) {
      fetch(`/api/share?post_id=${postId}`).then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.count) setShareCount(d.count); }).catch(() => {});
    }
  }, [postId]);

  const platforms = useMemo<Platform[]>(() => {
    if (!supportsNative) return BASE_PLATFORMS;
    return [
      { id: 'native', label: '공유하기', emoji: '📤', bg: 'var(--brand)', color: '#fff' },
      ...BASE_PLATFORMS,
    ];
  }, [supportsNative]);

  const copyRichHtml = useCallback(async (html: string, plain: string) => {
    try {
      if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([plain], { type: 'text/plain' }),
          }),
        ]);
        return true;
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(plain);
      return true;
    } catch {}
    return false;
  }, []);

  const share = async (platform: string) => {
    const rawUrl = typeof window !== 'undefined' ? window.location.href.split('?')[0] : '';
    const shareUrl = addUtm(rawUrl, platform);
    const shareTitle = title;
    const ogImage = typeof window !== 'undefined'
      ? `${window.location.origin}/api/og?title=${encodeURIComponent(shareTitle)}&design=2`
      : '';

    switch (platform) {
      case 'native':
        if (navigator.share) {
          try { await navigator.share({ title: shareTitle, url: shareUrl }); } catch { return; }
        }
        break;

      case 'kakao':
        if (typeof window !== 'undefined' && ensureKakaoReady()) {
          try {
            window.Kakao?.Share.sendDefault({
              objectType: 'feed',
              content: {
                title: shareTitle,
                description: content?.slice(0, 80) || '카더라에서 확인하세요',
                imageUrl: ogImage,
                link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
              },
              buttons: [{ title: '카더라에서 보기', link: { mobileWebUrl: shareUrl, webUrl: shareUrl } }],
            });
            break;
          } catch { /* fall through */ }
        }
        await navigator.clipboard.writeText(shareUrl);
        success('링크가 복사됐어요! 카카오톡에서 붙여넣기 해주세요');
        break;

      case 'naver-blog': {
        const body = generateShareBody(shareTitle, content, rawUrl, category);
        const copied = await copyRichHtml(body.html, body.plain);
        if (copied) {
          info('📋 본문이 복사됐어요! 에디터에서 붙여넣기(Ctrl+V) 해주세요');
        }
        window.open(
          `https://blog.naver.com/openapi/share?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}`,
          '_blank', 'width=600,height=700'
        );
        break;
      }

      case 'naver-cafe': {
        const body = generateShareBody(shareTitle, content, rawUrl, category);
        const copied = await copyRichHtml(body.html, body.plain);
        if (copied) {
          info('📋 본문이 복사됐어요! 카페 글쓰기에서 붙여넣기 해주세요');
        }
        window.open(
          `https://cafe.naver.com/ca-fe/home?iframe_url=${encodeURIComponent(shareUrl)}`,
          '_blank', 'width=600,height=700'
        );
        break;
      }

      case 'daum-cafe': {
        const body = generateShareBody(shareTitle, content, rawUrl, category);
        await copyRichHtml(body.html, body.plain);
        info('📋 본문이 복사됐어요! 카페 글쓰기에서 붙여넣기 해주세요');
        window.open(
          `https://cafe.daum.net/_write?url=${encodeURIComponent(shareUrl)}`,
          '_blank', 'width=600,height=700'
        );
        break;
      }

      case 'band':
        window.open(`https://band.us/plugin/share?body=${encodeURIComponent(shareTitle + '\n' + shareUrl)}&route=${encodeURIComponent(shareUrl)}`, '_blank', 'width=500,height=600');
        break;

      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle + ' #카더라')}&url=${encodeURIComponent(shareUrl)}`, '_blank');
        break;

      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
        break;

      case 'copy':
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        success('링크가 복사됐어요!');
        setTimeout(() => setCopied(false), 2000);
        trackShare(platform);
        return;
    }
    setOpen(false);
    trackShare(platform);
  };

  const trackShare = (platform: string) => {
    setShareCount(c => c + 1);
    track('share', platform, { post_id: postId });
    fetch('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post_id: postId, platform }) }).catch(() => {});
  };

  const ensureKakaoReady = (): boolean => {
    try {
      const kakao = window.Kakao;
      if (!kakao) return false;
      if (!kakao.isInitialized()) {
        const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
        if (key) kakao.init(key);
      }
      return kakao.isInitialized() && !!kakao.Share;
    } catch { return false; }
  };

  if (compact) {
    return (
      <>
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }} aria-label="공유" className="kd-action-btn" style={{ textDecoration: 'none' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          {' '}공유{shareCount > 0 ? ` ${shareCount}` : ''}
        </button>
        <BottomSheet open={open} onClose={() => setOpen(false)} title="공유하기" maxWidth={480}>
          <ShareGrid platforms={platforms} share={share} copied={copied} />
          <UrlPreview />
        </BottomSheet>
      </>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="공유" style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '8px 16px', borderRadius: 'var(--radius-md)',
        background: 'linear-gradient(135deg, rgba(59,123,246,0.08) 0%, rgba(96,165,250,0.08) 100%)',
        border: '1px solid rgba(59,123,246,0.2)',
        color: 'var(--brand)', cursor: 'pointer',
        fontSize: 13, fontWeight: 700,
        transition: 'all var(--transition-fast)',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        공유{shareCount > 0 && <span style={{ fontSize: 11, opacity: 0.8, marginLeft: 2 }}>{shareCount}</span>}
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="공유하기" maxWidth={480}>
        <ShareGrid platforms={platforms} share={share} copied={copied} />
        <UrlPreview />
      </BottomSheet>
    </>
  );
}

function ShareGrid({ platforms, share, copied }: { platforms: Platform[]; share: (id: string) => void; copied: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 'var(--sp-lg)' }}>
      {platforms.map(p => (
        <button key={p.id} onClick={() => share(p.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-sm)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, minWidth: 56, position: 'relative' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: p.id === 'copy' && copied ? 'var(--accent-green)' : p.bg, color: p.color, fontSize: p.id === 'naver-blog' || p.id === 'naver-cafe' || p.id === 'daum-cafe' ? 18 : 'var(--fs-lg)', fontWeight: 900, transition: 'transform 0.12s' }}>
            {p.id === 'copy' && copied ? '✓' : p.emoji}
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{p.id === 'copy' && copied ? '복사됨!' : p.label}</span>
          {p.isNew && <span style={{ position: 'absolute', top: -4, right: -4, fontSize: 8, background: '#EF4444', color: '#fff', padding: '1px 4px', borderRadius: 4, fontWeight: 700 }}>N</span>}
        </button>
      ))}
    </div>
  );
}

function UrlPreview() {
  return (
    <div style={{ padding: 'var(--sp-sm) var(--card-p)', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {typeof window !== 'undefined' ? window.location.href : ''}
    </div>
  );
}
