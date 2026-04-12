'use client';
import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { isTossMode, tossShare } from '@/lib/toss-mode';
import { track } from '@/lib/analytics';
import dynamic from 'next/dynamic';

const BottomSheet = dynamic(() => import('@/components/BottomSheet'), { ssr: false });

interface Props {
  section: string;
  label?: string;
  text?: string;
  pagePath: string;
}

const PLATFORMS = [
  { id: 'kakao', label: '카카오톡', emoji: '💬', bg: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)' },
  { id: 'band', label: '밴드', emoji: '🟢', bg: '#06C755', color: '#fff' },
  { id: 'twitter', label: 'X', emoji: '𝕏', bg: '#1DA1F2', color: '#fff' },
  { id: 'facebook', label: '페이스북', emoji: 'f', bg: '#1877F2', color: '#fff' },
  { id: 'copy', label: '링크 복사', emoji: '🔗', bg: 'var(--bg-hover)', color: 'var(--text-primary)' },
];

export default function SectionShareButton({ section, label, text, pagePath }: Props) {
  const { success } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const getUrl = () => {
    const path = `${pagePath}?section=${section}`;
    return typeof window !== 'undefined' ? `${window.location.origin}${path}` : '';
  };

  const ensureKakaoReady = (): boolean => {
    try {
      const kakao = (window as any).Kakao;
      if (!kakao) return false;
      if (!kakao.isInitialized()) {
        const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
        if (key) kakao.init(key);
      }
      return kakao.isInitialized() && !!kakao.Share;
    } catch { return false; }
  };

  const trackShare = (platform: string) => {
    track('share', platform, { content_type: 'section', content_ref: section });
    fetch('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform, content_type: 'section', content_ref: section }) }).catch(() => {});
  };

  const shareKakao = async () => {
    const url = getUrl();
    const shareTitle = label || '카더라';
    const ogImage = typeof window !== 'undefined'
      ? `${window.location.origin}/api/og?title=${encodeURIComponent(shareTitle)}&design=2`
      : '';
    if (typeof window !== 'undefined' && ensureKakaoReady()) {
      try {
        (window as any).Kakao.Share.sendDefault({
          objectType: 'feed',
          content: { title: shareTitle, description: text || '카더라에서 확인하세요', imageUrl: ogImage, link: { mobileWebUrl: url, webUrl: url } },
          buttons: [{ title: '카더라에서 보기', link: { mobileWebUrl: url, webUrl: url } }],
        });
        trackShare('kakao');
        return;
      } catch { /* fall through */ }
    }
    await navigator.clipboard.writeText(url);
    success('링크가 복사됐어요! 카카오톡에서 붙여넣기 해주세요');
    trackShare('kakao');
  };

  const sharePlatform = async (platform: string) => {
    const rawUrl = getUrl();
    const sep = rawUrl.includes('?') ? '&' : '?';
    const shareUrl = `${rawUrl}${sep}utm_source=${platform}&utm_medium=share&utm_campaign=viral`;
    const shareTitle = label || '카더라';
    const ogImage = typeof window !== 'undefined'
      ? `${window.location.origin}/api/og?title=${encodeURIComponent(shareTitle)}&design=2`
      : '';
    switch (platform) {
      case 'kakao':
        if (ensureKakaoReady()) {
          try {
            (window as any).Kakao.Share.sendDefault({
              objectType: 'feed',
              content: { title: shareTitle, description: text || '카더라에서 확인하세요', imageUrl: ogImage, link: { mobileWebUrl: shareUrl, webUrl: shareUrl } },
              buttons: [{ title: '카더라에서 보기', link: { mobileWebUrl: shareUrl, webUrl: shareUrl } }],
            });
            trackShare('kakao');
            setOpen(false); return;
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
        trackShare('copy');
        return;
    }
    setOpen(false);
    trackShare(platform);
  };

  const handleShare = async () => {
    if (isTossMode()) {
      const path = `${pagePath}?section=${section}`;
      const shared = await tossShare(label || '카더라', path);
      if (shared) return;
    }
    setOpen(true);
  };

  return (
    <>
      <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
        <button onClick={shareKakao} aria-label="카카오톡으로 공유" title="카카오톡으로 공유하기" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 'var(--radius-md)',
          background: 'var(--kakao-bg, #FEE500)', border: '1px solid rgba(25,25,25,0.1)',
          color: 'var(--kakao-text, #191919)', cursor: 'pointer', fontSize: 12, fontWeight: 700,
        }}>
          💬 카카오톡
        </button>
        <button onClick={handleShare} aria-label={`${label || '이 섹션'} 공유`} title="다른 곳에 공유하기" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 8px', borderRadius: 'var(--radius-md)',
          background: 'var(--bg-hover)',
          border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        </button>
      </div>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="공유하기" maxWidth={480}>
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 'var(--sp-lg)' }}>
          {PLATFORMS.map(p => (
            <button key={p.id} onClick={() => sharePlatform(p.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-sm)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, minWidth: 56 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: p.id === 'copy' && copied ? 'var(--accent-green)' : p.bg, color: p.color, fontSize: 'var(--fs-lg)', fontWeight: 900 }}>
                {p.id === 'copy' && copied ? '✓' : p.emoji}
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{p.id === 'copy' && copied ? '복사됨!' : p.label}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: 'var(--sp-sm) var(--card-p)', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {typeof window !== 'undefined' ? getUrl() : ''}
        </div>
      </BottomSheet>
    </>
  );
}
