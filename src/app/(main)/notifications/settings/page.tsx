'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/Toast';
import PushSubscribeButton from '@/components/PushSubscribeButton';

interface Settings {
  push_comments: boolean;
  push_likes: boolean;
  push_follows: boolean;
  push_apt_deadline: boolean;
  push_hot_posts: boolean;
  push_stock_alert: boolean;
  push_attendance: boolean;
  push_marketing: boolean;
}

const ITEMS: { key: keyof Settings; label: string; desc: string }[] = [
  { key: 'push_comments', label: '댓글 알림', desc: '내 글에 댓글이 달리면 알려드려요' },
  { key: 'push_likes', label: '좋아요 알림', desc: '내 글에 좋아요가 달리면 알려드려요' },
  { key: 'push_follows', label: '팔로우 알림', desc: '누군가 팔로우하면 알려드려요' },
  { key: 'push_apt_deadline', label: '청약 마감 알림', desc: 'D-1, D-0 청약 마감을 알려드려요' },
  { key: 'push_hot_posts', label: 'HOT 게시글', desc: '이번 주 인기 글을 알려드려요' },
  { key: 'push_stock_alert', label: '주식 급등/급락', desc: '등락률 5% 이상 종목을 알려드려요' },
  { key: 'push_attendance', label: '출석 리마인더', desc: '출석체크를 잊지 않도록 알려드려요' },
  { key: 'push_marketing', label: '마케팅 알림', desc: '이벤트, 혜택 소식을 받아보세요' },
];

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const { success } = useToast();

  useEffect(() => {
    fetch('/api/notifications/settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && !d.error) setSettings(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const toggle = async (key: keyof Settings) => {
    if (!settings) return;
    const newVal = !settings[key];
    setSettings({ ...settings, [key]: newVal });
    await fetch('/api/notifications/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: newVal }),
    });
    success(newVal ? '알림을 켰어요' : '알림을 껐어요');
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-tertiary)' }}>로딩 중...</div>;
  if (!settings) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-tertiary)' }}>로그인이 필요합니다. <Link href="/login" style={{ color: 'var(--brand)' }}>로그인</Link></div>;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <Link href="/notifications" style={{ color: 'var(--text-tertiary)', textDecoration: 'none', fontSize: 'var(--fs-base)' }}>← 알림</Link>
        <h1 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>알림 설정</h1>
      </div>

      {/* 푸시 알림 구독 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>푸시 알림</div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 12, lineHeight: 1.5 }}>
          청약 마감, 종목 알림, 출석 리마인더를 실시간으로 받으려면 아래 버튼을 눌러 알림을 허용해주세요.
        </div>
        <PushSubscribeButton />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {ITEMS.map(item => (
          <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginTop: 2 }}>{item.desc}</div>
            </div>
            <button onClick={() => toggle(item.key)} style={{
              width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: settings[item.key] ? 'var(--brand)' : 'var(--border)',
              position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: 'white',
                position: 'absolute', top: 2,
                left: settings[item.key] ? 22 : 2,
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
