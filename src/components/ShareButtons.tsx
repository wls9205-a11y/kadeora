'use client';
import { useState, useEffect } from 'react';

interface Props { title: string; postId: number | string; content?: string; }

const PLATFORMS = [
  { id: 'kakao', label: '카카오톡', bg: '#FEE500', color: '#191919', emoji: '💬' },
  { id: 'x', label: 'X', bg: '#000000', color: '#ffffff', emoji: '𝕏' },
  { id: 'naver', label: '밴드', bg: '#03C75A', color: '#ffffff', emoji: '📢' },
  { id: 'copy', label: '링크복사', bg: '#374151', color: '#ffffff', emoji: '🔗' },
];

export default function ShareButtons({ title, postId, content }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = `https://kadeora.app/feed/${postId}`;

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handleEsc);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', handleEsc); };
  }, [open]);

  const share = async (pid: string) => {
    if (pid === 'kakao') {
      const kakao = (window as any).Kakao;
      if (kakao?.isInitialized?.()) {
        kakao.Share.sendDefault({
          objectType: 'feed',
          content: { title, description: (content || '').slice(0, 80), imageUrl: `https://kadeora.app/api/og?title=${encodeURIComponent(title)}`, link: { mobileWebUrl: url, webUrl: url } },
          buttons: [{ title: '카더라에서 보기', link: { mobileWebUrl: url, webUrl: url } }],
        });
      } else {
        // SDK 미초기화 — 카카오톡 공유 picker URL
        const kakaoShareUrl = `https://sharer.kakao.com/talk/friends/picker/link?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
        window.open(kakaoShareUrl, '_blank');
      }
    } else if (pid === 'x') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title + ' via 카더라')}&url=${encodeURIComponent(url)}`, '_blank');
    } else if (pid === 'naver') {
      window.open(`https://band.us/plugin/share?body=${encodeURIComponent(title + '\n' + url)}&route=shareButton`, '_blank');
    } else if (pid === 'copy') {
      await navigator.clipboard.writeText(url);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
    if (pid !== 'copy') setOpen(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 20, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
        🔗 공유
      </button>
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
          <div style={{ position: 'relative', background: 'var(--bg-surface)', zIndex: 1, borderRadius: '20px 20px 0 0', padding: '20px 24px 40px', maxWidth: 480, width: '100%', margin: '0 auto' }}>
            <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 20px' }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>공유하기</div>
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
              {PLATFORMS.map(p => (
                <button key={p.id} onClick={() => share(p.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, minWidth: 60 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: p.id === 'copy' && copied ? '#10b981' : p.bg, color: p.color, fontSize: 22, fontWeight: 900 }}>
                    {p.id === 'copy' && copied ? '✓' : p.emoji}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.id === 'copy' && copied ? '복사됨!' : p.label}</span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 20, padding: '10px 14px', background: 'var(--bg-hover)', borderRadius: 8, fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</div>
          </div>
        </div>
      )}
    </>
  );
}
