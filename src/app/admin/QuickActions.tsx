'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function QuickActions() {
  const router = useRouter();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const quickActions = [
    { key: 'reports', icon: '🚨', label: '신고 처리', action: () => router.push('/admin/reports') },
    { key: 'content', icon: '📝', label: '게시글 관리', action: () => router.push('/admin/content') },
    { key: 'users', icon: '👥', label: '회원 관리', action: () => router.push('/admin/users') },
    { key: 'notifications', icon: '📢', label: '공지 작성', action: () => router.push('/admin/notifications') },
    { key: 'system', icon: '🔧', label: '시스템 점검', action: () => router.push('/admin/system') },
    { key: 'payments', icon: '💰', label: '결제 내역', action: () => router.push('/admin/payments') },
  ];

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>빠른 작업</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {quickActions.map(qa => (
          <button
            key={qa.key}
            onClick={() => {
              setLoadingKey(qa.key);
              qa.action();
            }}
            disabled={loadingKey === qa.key}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: loadingKey === qa.key ? 'wait' : 'pointer',
            }}
          >
            {qa.icon} {loadingKey === qa.key ? '이동중...' : qa.label}
          </button>
        ))}
      </div>
    </div>
  );
}
