'use client';
/**
 * TwoStepCTA — 마이크로 커밋먼트 기반 2단계 전환 CTA
 *
 * Step 1: 맥락별 질문 ("알림 받을래요?") → [YES] / [괜찮아요]
 * Step 2: YES 후 → 카카오 가입 폼 표시
 *
 * 심리학: 작은 YES를 먼저 받으면 후속 YES 확률 3~4배 증가
 */
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { trackConversion } from '@/lib/track-conversion';

interface TwoStepCTAProps {
  category?: string;
  contextName?: string; // 단지명, 종목명 등
}

const CTA_MAP: Record<string, { question: string; benefits: string[] }> = {
  apt: {
    question: '이 단지 가격이 변동하면 알림 받으시겠어요?',
    benefits: ['실거래가 변동 알림', '주변 시세 비교', '청약 마감 D-7 알림'],
  },
  stock: {
    question: '이 종목 시세가 급변하면 알림 받으시겠어요?',
    benefits: ['급등/급락 알림', 'AI 종목 분석 리포트', '관심 종목 시세 알림'],
  },
  unsold: {
    question: '이 지역 미분양이 줄어들면 알림 받으시겠어요?',
    benefits: ['미분양 감소 알림', '할인 분양 정보', '지역 시세 동향'],
  },
  finance: {
    question: '맞춤 재테크 정보를 매주 받아보시겠어요?',
    benefits: ['주간 시장 리포트', '세금 절약 팁', '투자 트렌드 분석'],
  },
  default: {
    question: '관심 있는 정보의 업데이트를 받아보시겠어요?',
    benefits: ['맞춤 알림', '주간 리포트', '모든 기능 무료'],
  },
};

export default function TwoStepCTA({ category, contextName }: TwoStepCTAProps) {
  const { userId, loading } = useAuth();
  const pathname = usePathname();
  const [step, setStep] = useState<'ask' | 'signup' | 'dismissed'>('ask');

  if (loading || userId) return null;
  if (step === 'dismissed') return null;

  const cta = CTA_MAP[category || 'default'] || CTA_MAP.default;
  const question = contextName
    ? cta.question.replace('이 단지', contextName).replace('이 종목', contextName).replace('이 지역', contextName)
    : cta.question;

  if (step === 'ask') {
    return (
      <div data-nudge="two-step" style={{
        margin: '32px 0', padding: '24px 20px',
        background: 'var(--bg-surface)', border: '1px solid var(--brand-border)',
        borderRadius: 'var(--radius-lg)', textAlign: 'center',
      }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, lineHeight: 1.5 }}>
          {question}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={() => { setStep('signup'); trackConversion('cta_click', 'two_step', { category }); }} style={{
            padding: '12px 28px', borderRadius: 'var(--radius-pill)',
            background: 'var(--brand)', color: '#fff',
            fontWeight: 700, fontSize: 'var(--fs-base)', border: 'none', cursor: 'pointer',
          }}>네, 받을래요</button>
          <button onClick={() => { setStep('dismissed'); trackConversion('cta_click', 'two_step_dismiss', { category }); }} style={{
            padding: '12px 20px', borderRadius: 'var(--radius-pill)',
            background: 'transparent', color: 'var(--text-tertiary)',
            fontWeight: 500, fontSize: 'var(--fs-sm)', border: '1px solid var(--border)', cursor: 'pointer',
          }}>괜찮아요</button>
        </div>
      </div>
    );
  }

  // Step 2: 카카오 가입
  return (
    <div data-nudge="two-step-signup" style={{
      margin: '32px 0', padding: '28px 20px',
      background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--brand-bg) 100%)',
      border: '1px solid var(--brand-border)',
      borderRadius: 'var(--radius-lg)', textAlign: 'center',
    }}>
      <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
        좋아요!
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
        카카오 계정만 연결하면 바로 시작됩니다
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 18 }}>
        {cta.benefits.map((b, i) => (
          <span key={i} style={{
            fontSize: 12, padding: '4px 12px', borderRadius: 'var(--radius-pill)',
            background: 'var(--brand-bg)', color: 'var(--brand)', fontWeight: 600,
          }}>✓ {b}</span>
        ))}
      </div>
      <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} style={{
        display: 'inline-block', padding: '14px 36px', borderRadius: 'var(--radius-pill)',
        background: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)',
        fontWeight: 700, fontSize: 'var(--fs-base)', textDecoration: 'none',
      }}>카카오로 무료 시작</Link>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 10 }}>
        ✓ 3초 완료 · ✓ 완전 무료 · ✓ 언제든 해제
      </div>
    </div>
  );
}
