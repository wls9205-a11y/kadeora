'use client';
import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';

interface Props {
  postId: number | string;
  title: string;
  content?: string;
}

declare global { interface Window { Kakao: any; } }

export default function ShareButtons({ postId, title, content }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasNativeShare, setHasNativeShare] = useState(false);
  const { success } = useToast();

  useEffect(() => {
    setHasNativeShare(typeof navigator !== 'undefined' && !!navigator.share);
  }, []);

  const url = `https://kadeora.app/feed/${postId}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const platforms = [
    {
      key: 'kakao', label: '카카오톡',
      bg: '#FEE500', color: '#000', icon: '💬',
      action: () => {
        if (typeof window !== 'undefined' && window.Kakao?.isInitialized?.()) {
          window.Kakao.Share.sendDefault({
            objectType: 'feed',
            content: {
              title,
              description: content?.slice(0, 80) || title,
              imageUrl: 'https://kadeora.app/og-image.png',
              link: { mobileWebUrl: url, webUrl: url },
            },
            buttons: [{ title: '카더라에서 보기', link: { mobileWebUrl: url, webUrl: url } }],
          });
        } else {
          navigator.clipboard.writeText(url);
          success('링크가 복사됐어요!');
        }
        setOpen(false);
      }
    },
    {
      key: 'twitter', label: 'X(트위터)',
      bg: '#000', color: '#fff', icon: '✕',
      action: () => {
        window.open(`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`, '_blank');
        setOpen(false);
      }
    },
    {
      key: 'band', label: '밴드',
      bg: '#03C75A', color: '#fff', icon: '🎯',
      action: () => {
        window.open(`https://band.us/plugin/share?body=${encodedTitle}%0A${encodedUrl}&route=share`, '_blank');
        setOpen(false);
      }
    },
    {
      key: 'threads', label: '스레드',
      bg: '#1a1a1a', color: '#fff', icon: '@',
      action: () => {
        window.open(`https://www.threads.net/intent/post?text=${encodedTitle}%0A${encodedUrl}`, '_blank');
        setOpen(false);
      }
    },
    {
      key: 'line', label: '라인',
      bg: '#06C755', color: '#fff', icon: '💚',
      action: () => {
        window.open(`https://social-plugins.line.me/lineit/share?url=${encodedUrl}`, '_blank');
        setOpen(false);
      }
    },
    {
      key: 'copy', label: copied ? '복사됨!' : '링크복사',
      bg: 'var(--bg-hover)', color: 'var(--text-primary)', icon: copied ? '✓' : '🔗',
      action: async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        success('링크가 복사됐어요!');
        setTimeout(() => setCopied(false), 2000);
      }
    },
    ...(hasNativeShare ? [{
      key: 'native', label: '더보기',
      bg: 'var(--brand)', color: '#fff', icon: '📤',
      action: () => {
        navigator.share({ title, text: content?.slice(0, 80) || title, url });
        setOpen(false);
      }
    }] : []),
  ];

  return (
    <>
      <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true); }}
        style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 10px', borderRadius:20, background:'var(--bg-hover)', border:'1px solid var(--border)', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>
        🔗 <span>공유</span>
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:9998 }} />
      )}

      <div style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:9999,
        background:'var(--bg-surface)', borderRadius:'20px 20px 0 0',
        padding:'12px 20px 32px',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition:'transform 0.25s ease',
        boxShadow:'0 -4px 24px rgba(0,0,0,0.3)',
      }}>
        <div style={{ width:40, height:4, background:'var(--border)', borderRadius:2, margin:'0 auto 16px' }} />
        <div style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', marginBottom:20 }}>공유하기</div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:16 }}>
          {platforms.map(p => (
            <button key={p.key} onClick={(e) => { e.stopPropagation(); p.action(); }}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, background:'transparent', border:'none', cursor:'pointer', padding:0 }}>
              <div style={{
                width:56, height:56, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                background: p.bg, color: p.color, fontSize:22, flexShrink:0,
              }}>{p.icon}</div>
              <span style={{ fontSize:11, color:'var(--text-secondary)', textAlign:'center', wordBreak:'keep-all' }}>{p.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
