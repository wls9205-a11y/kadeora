'use client';
import { useState, useEffect, useMemo } from 'react';
import BottomSheet from '@/components/BottomSheet';
import { useToast } from '@/components/Toast';

interface Props { title: string; postId?: number | string; content?: string; }

interface Platform {
  id: string; label: string; emoji: string; bg: string; color: string;
}

const BASE_PLATFORMS: Platform[] = [
  { id: 'kakao', label: '카카오톡', emoji: '💬', bg: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)' },
  { id: 'twitter', label: 'X', emoji: '𝕏', bg: '#1DA1F2', color: 'var(--text-inverse)' },
  { id: 'facebook', label: '페이스북', emoji: 'f', bg: '#1877F2', color: 'var(--text-inverse)' },
  { id: 'copy', label: '링크 복사', emoji: '🔗', bg: 'var(--bg-hover)', color: 'var(--text-primary)' },
];

export default function ShareButtons({ title, postId, content }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [supportsNative, setSupportsNative] = useState(false);
  const { success } = useToast();

  useEffect(() => {
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    setSupportsNative(isMobile && !!navigator.share);
  }, []);

  const platforms = useMemo<Platform[]>(() => {
    if (!supportsNative) return BASE_PLATFORMS;
    return [
      { id: 'native', label: '공유하기', emoji: '📤', bg: 'var(--brand)', color: '#fff' },
      ...BASE_PLATFORMS,
    ];
  }, [supportsNative]);

  const share = async (platform: string) => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    const shareTitle = title;
    const shareDesc = content?.slice(0, 80) || '카더라에서 확인하세요';
    const ogImage = typeof window !== 'undefined'
      ? `${window.location.origin}/api/og?title=${encodeURIComponent(shareTitle)}&design=2`
      : '';

    switch (platform) {
      case 'native':
        if (navigator.share) {
          try {
            await navigator.share({ title: shareTitle, text: shareDesc, url: shareUrl });
          } catch { /* 사용자가 취소 */ }
          setOpen(false);
          return;
        }
        break;
      case 'kakao':
        if (typeof window !== 'undefined' && ensureKakaoReady()) {
          try {
            window.Kakao?.Share.sendDefault({
              objectType: 'feed',
              content: {
                title: shareTitle,
                description: shareDesc,
                imageUrl: ogImage,
                link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
              },
              buttons: [{ title: '카더라에서 보기', link: { mobileWebUrl: shareUrl, webUrl: shareUrl } }],
            });
            break;
          } catch { /* fall through to clipboard */ }
        }
        await navigator.clipboard.writeText(shareUrl);
        success('링크가 복사됐어요! 카카오톡에서 붙여넣기 해주세요');
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
        setTimeout(() => setCopied(false), 2000);
        fetch('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post_id: postId, platform: 'copy' }) }).catch(() => {});
        return;
    }
    setOpen(false);
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

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="공유" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', minWidth: 44, minHeight: 44 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="공유하기" maxWidth={480}>
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          {platforms.map(p => (
            <button key={p.id} onClick={() => share(p.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, minWidth: 60 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: p.id === 'copy' && copied ? 'var(--accent-green)' : p.bg, color: p.color, fontSize: 'var(--fs-xl)', fontWeight: 900 }}>
                {p.id === 'copy' && copied ? '✓' : p.emoji}
              </div>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>{p.id === 'copy' && copied ? '복사됨!' : p.label}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: '10px 14px', background: 'var(--bg-hover)', borderRadius: 8, fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {typeof window !== 'undefined' ? window.location.href : ''}
        </div>
      </BottomSheet>
    </>
  );
}
