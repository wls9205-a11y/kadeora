'use client';
import Link from 'next/link';
import { PRO_PRICING } from '@/lib/plan-limits';

interface Props {
  feature: string;        // "관심 종목을 더 추가하려면"
  current?: string;       // "현재 5/5개 사용 중"
  onClose: () => void;
}

export default function UpgradeModal({ feature, current, onClose }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 'var(--radius-xl)',
        padding: '28px 24px', maxWidth: 400, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⭐</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)' }}>
            {feature}
          </div>
          {current && (
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginTop: 4 }}>
              {current}
            </div>
          )}
        </div>

        <div style={{
          background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)',
          padding: '14px 16px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            프로 멤버십으로 업그레이드하면<br/>
            관심 종목·단지 무제한 + 급등락 알림 + AI 분석까지
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 6, marginBottom: 16 }}>
          <span style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)' }}>{PRO_PRICING.monthly.label}</span>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>({PRO_PRICING.monthly.perDay})</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link href="/shop" style={{
            display: 'block', padding: '13px 0', borderRadius: 'var(--radius-card)',
            background: 'var(--brand)', color: '#fff',
            fontWeight: 700, fontSize: 'var(--fs-md)', textDecoration: 'none', textAlign: 'center',
          }}>
            {PRO_PRICING.trial.label} 시작하기
          </Link>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-tertiary)',
            fontSize: 'var(--fs-sm)', cursor: 'pointer', padding: '8px 0', textAlign: 'center',
          }}>
            나중에 할게요
          </button>
        </div>
      </div>
    </div>
  );
}
