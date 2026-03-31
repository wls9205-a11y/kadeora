'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface PopupAd {
  id: number;
  title: string;
  content?: string;
  image_url?: string;
  link_url?: string;
  link_label?: string;
  position: 'center' | 'bottom' | 'top';
  display_type: 'modal' | 'banner' | 'toast';
  dismiss_duration_hours: number;
}

const LS_PREFIX = 'kd_popup_dismiss_';

export default function PopupAdManager() {
  const [popups, setPopups] = useState<PopupAd[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const pathname = usePathname();

  useEffect(() => {
    // 이미 닫은 팝업 확인
    const now = Date.now();
    const dismissedIds = new Set<number>();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(LS_PREFIX)) {
        const until = Number(localStorage.getItem(key));
        const id = Number(key.replace(LS_PREFIX, ''));
        if (until > now) dismissedIds.add(id);
        else localStorage.removeItem(key);
      }
    }
    setDismissed(dismissedIds);

    // 활성 팝업 조회
    fetch(`/api/popup?page=${encodeURIComponent(pathname)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.popups) setPopups(d.popups); })
      .catch(() => {});
  }, [pathname]);

  const handleDismiss = (popup: PopupAd) => {
    const hours = popup.dismiss_duration_hours || 24;
    localStorage.setItem(`${LS_PREFIX}${popup.id}`, String(Date.now() + hours * 3600000));
    setDismissed(prev => new Set(prev).add(popup.id));
  };

  const handleClick = (popup: PopupAd) => {
    // 클릭 추적
    const sb = createSupabaseBrowser() as any;
    sb.rpc('increment_popup_click', { popup_id: popup.id }).catch(() => {});
    if (popup.link_url) {
      if (popup.link_url.startsWith('http')) window.open(popup.link_url, '_blank');
      else window.location.href = popup.link_url;
    }
    handleDismiss(popup);
  };

  const visible = popups.filter(p => !dismissed.has(p.id));
  if (visible.length === 0) return null;

  return (
    <>
      {visible.map(popup => {
        if (popup.display_type === 'banner') return <BannerAd key={popup.id} popup={popup} onDismiss={handleDismiss} onClick={handleClick} />;
        if (popup.display_type === 'toast') return <ToastAd key={popup.id} popup={popup} onDismiss={handleDismiss} onClick={handleClick} />;
        return <ModalAd key={popup.id} popup={popup} onDismiss={handleDismiss} onClick={handleClick} />;
      })}
    </>
  );
}

function ModalAd({ popup, onDismiss, onClick }: { popup: PopupAd; onDismiss: (p: PopupAd) => void; onClick: (p: PopupAd) => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', padding: 20 }}
      onClick={() => onDismiss(popup)}>
      <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', maxWidth: 400, width: '100%', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}>
        {popup.image_url && (
          <div style={{ width: '100%', aspectRatio: '16/9', overflow: 'hidden', cursor: popup.link_url ? 'pointer' : 'default' }}
            onClick={() => popup.link_url && onClick(popup)}>
            <img src={popup.image_url} alt={popup.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
          </div>
        )}
        <div style={{ padding: '20px' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>{popup.title}</div>
          {popup.content && <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>{popup.content}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            {popup.link_url && (
              <button onClick={() => onClick(popup)} style={{
                flex: 1, padding: '12px 0', borderRadius: 'var(--radius-sm)', border: 'none',
                background: 'var(--brand)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>{popup.link_label || '자세히 보기'}</button>
            )}
            <button onClick={() => onDismiss(popup)} style={{
              flex: popup.link_url ? 0 : 1, padding: '12px 16px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-tertiary)',
              fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>{popup.dismiss_duration_hours >= 24 ? '오늘 하루 안 보기' : '닫기'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BannerAd({ popup, onDismiss, onClick }: { popup: PopupAd; onDismiss: (p: PopupAd) => void; onClick: (p: PopupAd) => void }) {
  return (
    <div style={{
      position: 'fixed', top: 44, left: 0, right: 0, zIndex: 100,
      background: 'linear-gradient(90deg, var(--brand), #6366F1)',
      padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0, cursor: popup.link_url ? 'pointer' : 'default' }} onClick={() => popup.link_url && onClick(popup)}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{popup.title}</div>
        {popup.content && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 1 }}>{popup.content}</div>}
      </div>
      {popup.link_url && (
        <button onClick={() => onClick(popup)} style={{ padding: '5px 12px', borderRadius: 'var(--radius-xs)', border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
          {popup.link_label || '보기'}
        </button>
      )}
      <button onClick={() => onDismiss(popup)} aria-label="닫기" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 16, cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>✕</button>
    </div>
  );
}

function ToastAd({ popup, onDismiss, onClick }: { popup: PopupAd; onDismiss: (p: PopupAd) => void; onClick: (p: PopupAd) => void }) {
  return (
    <div style={{
      position: 'fixed', bottom: 72, left: 16, right: 16, zIndex: 100,
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '14px 16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 10,
      maxWidth: 400, margin: '0 auto',
    }}>
      {popup.image_url && <img src={popup.image_url} alt="" style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0, cursor: popup.link_url ? 'pointer' : 'default' }} onClick={() => popup.link_url && onClick(popup)}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{popup.title}</div>
        {popup.content && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{popup.content}</div>}
      </div>
      <button onClick={() => onDismiss(popup)} aria-label="닫기" style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 14, cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>✕</button>
    </div>
  );
}
