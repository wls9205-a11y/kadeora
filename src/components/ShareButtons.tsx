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
        // SDK 미초기화 — init 재시도
        const kakao2 = (window as any).Kakao;
        const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
        if (kakao2 && key && !kakao2.isInitialized()) kakao2.init(key);
        if (kakao2?.isInitialized?.()) {
          kakao2.Share.sendDefault({
            objectType: 'feed',
            content: { title, description: (content || '카더라에서 확인해보세요').slice(0, 100), imageUrl: `https://kadeora.app/api/og?title=${encodeURIComponent(title)}`, link: { mobileWebUrl: url, webUrl: url } },
            buttons: [{ title: '카더라에서 보기', link: { mobileWebUrl: url, webUrl: url } }],
          });
        } else {
          // SDK 완전 불가 — navigator.share → 링크 복사 fallback
          if (navigator.share) {
            try { await navigator.share({ title, url }); } catch {}
          } else {
            await navigator.clipboard.writeText(url).catch(() => {});
            setCopied(true); setTimeout(() => setCopied(false), 2000);
          }
        }
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
      <button onClick={() => setOpen(true)} aria-label="공유" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
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
