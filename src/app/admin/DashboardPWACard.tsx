'use client';
import { useState } from 'react';

interface Props {
  total: number;
  android: number;
  ios: number;
  desktop: number;
}

export default function DashboardPWACard({ total, android, ios, desktop }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--text-primary)' }}>{total}건</div>
        <button
          onClick={() => setShowTooltip(p => !p)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', padding: 0,
          }}
          title="측정 방법"
        >ⓘ</button>
      </div>
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
        Android {android} · iOS {ios} · PC {desktop}
      </div>
      {showTooltip && (
        <div style={{
          position: 'absolute', top: -8, right: 0, zIndex: 10,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '8px 12px', fontSize: 'var(--fs-xs)',
          color: 'var(--text-secondary)', maxWidth: 240, lineHeight: 1.5,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>PWA 설치 측정 방법</div>
          <div>display-mode: standalone 감지 시 세션당 1회 /api/pwa/install POST 호출. 실제 홈화면 추가가 아닌 PWA 모드 진입을 카운트합니다.</div>
          <button
            onClick={() => setShowTooltip(false)}
            style={{ marginTop: 4, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
          >닫기</button>
        </div>
      )}
    </div>
  );
}
