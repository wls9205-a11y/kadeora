'use client';
import { useState } from 'react';

const FAQS = [
  { q: 'KADEORA는 어떤 서비스인가요?', a: 'KADEORA는 주식, 청약, 재테크 정보를 공유하는 금융 커뮤니티입니다. 실제 투자자들이 직접 경험한 정보와 분석을 공유합니다.' },
  { q: '회원가입은 어떻게 하나요?', a: '별도의 회원가입 절차 없이 카카오 또는 Google 계정으로 바로 로그인하실 수 있습니다. 첫 로그인 시 자동으로 계정이 생성됩니다.' },
  { q: '게시글 작성은 누구나 가능한가요?', a: '로그인한 회원이라면 누구나 게시글을 작성할 수 있습니다. 단, 허위 정보나 투자 사기, 타인 비방 등의 내용은 삭제 및 계정 정지 조치가 취해질 수 있습니다.' },
  { q: '등급 시스템은 어떻게 작동하나요?', a: '게시글 작성, 댓글, 좋아요 활동에 따라 점수가 쌓이며 씨앗 → 새싹 → 브론즈 → 실버 → 골드 → 플래티넘 → 다이아 순으로 등급이 올라갑니다.' },
  { q: '메가폰 서비스는 무엇인가요?', a: '상점에서 구매할 수 있는 유료 기능으로, 내 게시글을 피드 상단에 고정시켜 더 많은 사용자에게 노출시켜드립니다.' },
  { q: '개인정보는 안전하게 보호되나요?', a: 'Supabase의 Row Level Security(RLS)를 통해 개인정보를 철저히 보호합니다. 서드파티에 정보를 판매하거나 공유하지 않습니다.' },
  { q: '게시글을 신고하려면 어떻게 해야 하나요?', a: '게시글 상세 페이지에서 신고 버튼을 클릭하시거나, 버그/신고 API를 통해 제보해 주시면 빠르게 검토하겠습니다.' },
  { q: '토론방은 어떤 기능인가요?', a: '실시간 채팅으로 다른 투자자들과 즉각적인 정보를 교환할 수 있는 기능입니다. 주식, 청약, 자유 토픽별 방이 운영됩니다.' },
];

export default function FAQPage() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 0' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--kd-text)', marginBottom: 8 }}>자주 묻는 질문</h1>
      <p style={{ color: 'var(--kd-text-dim)', fontSize: 13, marginBottom: 32 }}>KADEORA 사용에 관해 자주 묻는 질문들을 모았습니다</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {FAQS.map((faq, i) => (
          <div key={i} style={{ background: 'var(--kd-surface)', border: '1px solid var(--kd-border)', borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.15s' }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              style={{
                width: '100%', padding: '16px 20px', background: 'transparent', border: 'none',
                color: 'var(--kd-text)', textAlign: 'left', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                fontSize: 15, fontWeight: 600, lineHeight: 1.4,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--kd-primary)', fontWeight: 800, flexShrink: 0 }}>Q</span>
                {faq.q}
              </span>
              <span style={{
                fontSize: 18, flexShrink: 0, color: 'var(--kd-text-dim)',
                transform: open === i ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}>▾</span>
            </button>
            {open === i && (
              <div style={{ padding: '0 20px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }} className="animate-slideDown">
                <span style={{ color: 'var(--kd-success)', fontWeight: 800, flexShrink: 0, fontSize: 15 }}>A</span>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--kd-text-muted)', lineHeight: 1.7 }}>{faq.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 40, padding: '24px', background: 'var(--kd-surface)', border: '1px solid var(--kd-border)', borderRadius: 14, textAlign: 'center' }}>
        <p style={{ margin: '0 0 12px', color: 'var(--kd-text-muted)', fontSize: 14 }}>찾는 답이 없으신가요?</p>
        <a href="mailto:support@kadeora.com" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '10px 20px', borderRadius: 8,
          background: 'var(--kd-primary)', color: 'white',
          textDecoration: 'none', fontSize: 14, fontWeight: 600,
        }}>📧 문의하기</a>
      </div>
    </div>
  );
}
