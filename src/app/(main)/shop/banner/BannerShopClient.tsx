'use client';
import { useState } from 'react';
import Link from 'next/link';
import BannerPurchaseForm from '@/components/BannerPurchaseForm';

export default function BannerShopClient() {
  const [showForm, setShowForm] = useState(true);

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>
          📡 전광판 노출권
        </h1>
        <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
          내 글을 전광판에 노출하여 더 많은 사용자에게 알리세요
        </p>
      </div>

      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '24px 20px',
        }}
      >
        {showForm ? (
          <BannerPurchaseForm onClose={() => setShowForm(false)} />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              등록이 완료되었습니다
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 20 }}>
              전광판에 곧 노출됩니다
            </div>
            <Link
              href="/feed"
              style={{
                display: 'inline-block',
                padding: '10px 24px',
                background: 'var(--brand)',
                color: 'var(--text-inverse)',
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 'var(--fs-base)',
              }}
            >
              피드로 돌아가기
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
