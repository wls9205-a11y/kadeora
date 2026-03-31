'use client';
import { useState, useEffect, useMemo } from 'react';
import BottomSheet from '@/components/BottomSheet';
import { useToast } from '@/components/Toast';

interface Props { title: string; postId?: number | string; content?: string; compact?: boolean; }

interface Platform {
  id: string; label: string; emoji: string; bg: string; color: string;
}

const BASE_PLATFORMS: Platform[] = [
  { id: 'kakao', label: '카카오톡', emoji: '💬', bg: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)' },
  { id: 'band', label: '밴드', emoji: '🟢', bg: '#06C755', color: '#fff' },
  { id: 'twitter', label: 'X', emoji: '𝕏', bg: '#1DA1F2', color: 'var(--text-inverse)' },
  { id: 'facebook', label: '페이스북', emoji: 'f', bg: '#1877F2', color: 'var(--text-inverse)' },
  { id: 'copy', label: '링크 복사', emoji: '🔗', bg: 'var(--bg-hover)', color: 'var(--text-primary)' },
];

/** UTM 파라미터 추가 */
function addUtm(url: string, platform: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}utm_source=${platform}&utm_medium=share&utm_campaign=viral`;
}

export default function ShareButtons({ title, postId, content, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareCount, setShareCount] = useState(0);
  const [supportsNative, setSupportsNative] = useState(false);
  const { success } = useToast();

  useEffect(() => {
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    setSupportsNative(isMobile && !!navigator.share);

    // 공유 횟수 가져오기
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

  const share = async (platform: string) => {
    const rawUrl = typeof window !== 'undefined' ? window.location.href : '';
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
      case 'band':
        window.open(`https://band.us/plugin/share?body=${encodeURIComponent(shareTitle + '\n' + shareUrl)}&route=${encodeURIComponent(shareUrl)}`, '_blank', 'width=500,height=600');
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
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

  // 컴팩트 모드: 피드 카드용
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
    <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 'var(--sp-lg)' }}>
      {platforms.map(p => (
        <button key={p.id} onClick={() => share(p.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-sm)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, minWidth: 56 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: p.id === 'copy' && copied ? 'var(--accent-green)' : p.bg, color: p.color, fontSize: 'var(--fs-lg)', fontWeight: 900, transition: 'transform 0.12s' }}>
            {p.id === 'copy' && copied ? '✓' : p.emoji}
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{p.id === 'copy' && copied ? '복사됨!' : p.label}</span>
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
