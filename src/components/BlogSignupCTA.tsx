'use client';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useState, useEffect } from 'react';

/** 블로그 상단 회원가입 유도 배너 */
export function BlogTopBanner({ slug }: { slug: string }) {
  const { userId } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  if (userId || dismissed) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, var(--brand-bg) 0%, var(--accent-green-bg) 100%)',
      border: '1px solid var(--brand-border)',
      borderRadius: 'var(--radius-card)',
      padding: '14px 16px',
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      position: 'relative',
    }}>
      <div style={{ fontSize: 28, flexShrink: 0 }}>🎯</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
          무료 가입하고 매일 AI 투자 분석 받아보세요
        </div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          청약 마감 알림 · 급등주 알림 · 데일리 리포트 · 모든 콘텐츠 무료
        </div>
      </div>
      <Link href={`/login?redirect=/blog/${slug}`} style={{
        padding: '8px 18px', borderRadius: 'var(--radius-pill)',
        background: 'var(--kakao-bg)', color: 'var(--kakao-text)',
        fontWeight: 700, fontSize: 13, textDecoration: 'none',
        flexShrink: 0, whiteSpace: 'nowrap',
      }}>
        3초 가입
      </Link>
      <button onClick={() => setDismissed(true)} aria-label="닫기" style={{
        position: 'absolute', top: 6, right: 6,
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text-tertiary)', fontSize: 14, lineHeight: 1, padding: 4,
      }}>✕</button>
    </div>
  );
}

/** 블로그 본문 중간 회원가입 유도 카드 */
export function BlogMidCTA({ slug, category }: { slug: string; category: string }) {
  const { userId } = useAuth();
  if (userId) return null;

  const ctaTexts: Record<string, { title: string; desc: string }> = {
    stock: { title: '이 종목 분석이 도움이 됐다면?', desc: '매일 AI가 분석한 종목 리포트를 무료로 받아보세요' },
    apt: { title: '청약 정보, 놓치지 마세요', desc: '접수 마감 전 알림을 무료로 받을 수 있어요' },
    unsold: { title: '미분양 정보를 먼저 받아보세요', desc: '전국 미분양 업데이트 알림 · 완전 무료' },
    finance: { title: '재테크 정보 매일 받아보기', desc: '투자 트렌드와 수익률 분석을 매일 받아보세요' },
    general: { title: '유용한 정보를 놓치지 마세요', desc: '카더라 가입하고 매일 새로운 정보를 받아보세요' },
  };
  const cta = ctaTexts[category] || ctaTexts.general;

  return (
    <div style={{
      margin: '28px 0', padding: '20px',
      background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--brand-bg) 100%)',
      border: '1px solid var(--brand-border)', borderRadius: 'var(--radius-lg)', textAlign: 'center',
    }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>📬</div>
      <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>{cta.title}</div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>{cta.desc}</div>
      <Link href={`/login?redirect=/blog/${slug}`} style={{
        display: 'inline-block', padding: '10px 28px', borderRadius: 'var(--radius-pill)',
        background: 'var(--kakao-bg)', color: 'var(--kakao-text)',
        fontWeight: 700, fontSize: 'var(--fs-base)', textDecoration: 'none',
      }}>카카오로 3초 가입</Link>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>✓ 무료 ✓ 광고 없음 ✓ 3초 완료</div>
    </div>
  );
}

/** 블로그 하단 플로팅 가입 배너 */
export function BlogFloatingCTA({ slug }: { slug: string }) {
  const { userId } = useAuth();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (userId || dismissed) return;
    const handleScroll = () => {
      const scrollPct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
      setVisible(scrollPct > 0.25);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [userId, dismissed]);

  if (userId || dismissed || !visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 70, left: 16, right: 16,
      maxWidth: 500, margin: '0 auto', zIndex: 90,
      padding: '12px 16px', borderRadius: 'var(--radius-lg)',
      background: 'var(--bg-surface)', border: '1px solid var(--brand-border)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', gap: 10,
      animation: 'slideUp 0.3s ease-out',
    }}>
      <span style={{ fontSize: 24 }}>🚀</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>회원가입하면 전체 글 열람!</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>카카오로 3초 · 완전 무료</div>
      </div>
      <Link href={`/login?redirect=/blog/${slug}`} style={{
        padding: '8px 16px', borderRadius: 'var(--radius-pill)',
        background: 'var(--brand)', color: '#fff',
        fontWeight: 700, fontSize: 12, textDecoration: 'none', flexShrink: 0,
      }}>가입하기</Link>
      <button onClick={() => setDismissed(true)} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text-tertiary)', fontSize: 14, padding: 2,
      }}>✕</button>
    </div>
  );
}
