'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import type { User } from '@supabase/supabase-js';

const BANNER_TIERS = [
  {
    id: 'megaphone',
    tier: 'standard',
    name: '기본 전광판 — 2회 노출',
    desc: '전체 유저에게 스크롤 배너로 2회 노출',
    pointPrice: 3000,
    cashPrice: 4900,
    maxImpressions: 2,
    durationDays: null,
    color: '#34D399',
    icon: '📡',
    priority: 10,
  },
  {
    id: 'megaphone_standard',
    tier: 'standard',
    name: '전광판 5회 노출',
    desc: '초록 강조 텍스트 + 게시글 링크 포함. 5회 노출 보장.',
    pointPrice: null,
    cashPrice: 9900,
    maxImpressions: 5,
    durationDays: null,
    color: '#34D399',
    icon: '📡',
    priority: 10,
  },
  {
    id: 'megaphone_premium',
    tier: 'premium',
    name: '프리미엄 — 3일 무제한',
    desc: '3일간 무제한 노출. 금색 강조 + 게시글 링크 + 실시간 통계.',
    pointPrice: null,
    cashPrice: 29900,
    maxImpressions: null,
    durationDays: 3,
    color: '#FBBF24',
    icon: '⭐',
    priority: 50,
  },
  {
    id: 'megaphone_urgent',
    tier: 'urgent',
    name: '긴급 — 최우선 10회',
    desc: '빨간 강조로 최우선 노출 10회. 최고 주목도 + 클릭 통계.',
    pointPrice: null,
    cashPrice: 19900,
    maxImpressions: 10,
    durationDays: null,
    color: '#F87171',
    icon: '🚨',
    priority: 100,
  },
];

interface BannerPurchaseFormProps {
  onClose: () => void;
}

export default function BannerPurchaseForm({ onClose }: BannerPurchaseFormProps) {
  const [user, setUser] = useState<User | null>(null);
  const [userPoints, setUserPoints] = useState(0);
  const [selected, setSelected] = useState<typeof BANNER_TIERS[number] | null>(null);
  const [content, setContent] = useState('');
  const [linkedPostId, setLinkedPostId] = useState('');
  const [myPosts, setMyPosts] = useState<{ id: number; title: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'select' | 'compose' | 'confirm'>('select');
  const { success, error } = useToast();

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) {
        sb.from('profiles').select('points').eq('id', u.id).single().then(({ data: p }) => setUserPoints(p?.points ?? 0));
        sb.from('posts').select('id, title').eq('author_id', u.id).eq('is_deleted', false).order('created_at', { ascending: false }).limit(20)
          .then(({ data: posts }) => setMyPosts(posts ?? []));
      }
    });
  }, []);

  const handleSubmit = async () => {
    if (!user || !selected || !content.trim()) return;
    setSubmitting(true);

    try {
      const sb = createSupabaseBrowser();

      // 포인트 결제인 경우 잔액 체크
      if (selected.pointPrice) {
        if (userPoints < selected.pointPrice) {
          error(`포인트 부족! 필요: ${selected.pointPrice}P, 보유: ${userPoints}P`);
          setSubmitting(false);
          return;
        }
      }

      // 노출 기간 계산
      const displayStart = new Date();
      const displayEnd = selected.durationDays
        ? new Date(Date.now() + selected.durationDays * 24 * 60 * 60 * 1000)
        : null;

      // site_notices INSERT
      const { error: insertErr } = await sb.from('site_notices').insert({
        content: content.trim(),
        is_active: true,
        is_paid: true,
        tier: selected.tier,
        text_color: selected.color,
        author_id: user.id,
        linked_post_id: linkedPostId || null,
        display_start: displayStart.toISOString(),
        display_end: displayEnd?.toISOString() || null,
        max_impressions: selected.maxImpressions,
        priority: selected.priority,
      });
      if (insertErr) throw insertErr;

      // 포인트 차감 (포인트 결제인 경우)
      if (selected.pointPrice) {
        await sb.rpc('deduct_points', { p_user_id: user.id, p_amount: selected.pointPrice });
      }

      // TODO: 현금 결제는 토스 라이브키 전환 후 구현
      // 현재는 포인트 결제만 실제 동작

      success(`전광판 등록 완료! ${selected.durationDays ? `${selected.durationDays}일간` : `${selected.maxImpressions}회`} 노출됩니다.`);
      onClose();
    } catch {
      error('등록에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', marginBottom: 12 }}>전광판 등록은 로그인이 필요합니다</div>
        <a href="/login" style={{ display: 'inline-block', padding: '10px 24px', background: 'var(--brand)', color: 'var(--text-inverse)', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>로그인</a>
      </div>
    );
  }

  return (
    <div>
      {/* Step 1: 상품 선택 */}
      {step === 'select' && (
        <div>
          <h3 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>전광판 노출권 선택</h3>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 16 }}>보유 포인트: <b style={{ color: 'var(--brand)' }}>{userPoints.toLocaleString()}P</b></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {BANNER_TIERS.map(t => (
              <div key={t.id} onClick={() => { setSelected(t); setStep('compose'); }} role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') { setSelected(t); setStep('compose'); } }}
                style={{
                  padding: '16px 18px', background: 'var(--bg-hover)', border: `1px solid ${selected?.id === t.id ? t.color : 'var(--border)'}`,
                  borderRadius: 12, cursor: 'pointer', borderLeft: `3px solid ${t.color}`, transition: 'all 0.15s',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-primary)' }}>{t.icon} {t.name}</span>
                  <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: t.color }}>
                    {t.pointPrice ? `${t.pointPrice.toLocaleString()}P` : `₩${t.cashPrice.toLocaleString()}`}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>{t.desc}</div>
                {t.pointPrice && userPoints < t.pointPrice && (
                  <div style={{ fontSize: 'var(--fs-xs)', color: '#F87171', marginTop: 4 }}>포인트 부족 ({(t.pointPrice - userPoints).toLocaleString()}P 더 필요)</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: 내용 작성 */}
      {step === 'compose' && selected && (
        <div>
          <h3 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>전광판 내용 작성</h3>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 16 }}>{selected.icon} {selected.name}</div>

          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="전광판에 표시할 내용을 입력하세요 (최대 100자)"
            maxLength={100} rows={3}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-base)', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', lineHeight: 1.5 }} />
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textAlign: 'right', marginTop: 4 }}>{content.length}/100</div>

          {/* 미리보기 */}
          {content.trim() && (
            <div style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', border: `1px solid ${selected.color}30` }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', padding: '4px 10px', background: 'var(--bg-hover)' }}>미리보기</div>
              <div style={{ background: selected.tier === 'urgent' ? '#1A0A0E' : selected.tier === 'premium' ? '#1A1508' : '#0A1A12', height: 36, display: 'flex', alignItems: 'center', overflow: 'hidden', paddingLeft: 16 }}>
                <span style={{ whiteSpace: 'nowrap', fontSize: 'var(--fs-sm)', fontWeight: 600, color: selected.color }}>{selected.icon}&nbsp;{content}</span>
              </div>
            </div>
          )}

          {myPosts.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>연결할 게시글 (선택)</label>
              <select value={linkedPostId} onChange={e => setLinkedPostId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit' }}>
                <option value="">연결 안함</option>
                {myPosts.map(p => <option key={p.id} value={String(p.id)}>{p.title}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button onClick={() => setStep('select')} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 'var(--fs-base)', fontWeight: 600, cursor: 'pointer' }}>이전</button>
            <button onClick={() => setStep('confirm')} disabled={!content.trim()} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: content.trim() ? 'var(--brand)' : 'var(--bg-hover)', color: content.trim() ? 'var(--text-inverse)' : 'var(--text-tertiary)', fontSize: 'var(--fs-base)', fontWeight: 600, cursor: content.trim() ? 'pointer' : 'not-allowed' }}>다음</button>
          </div>
        </div>
      )}

      {/* Step 3: 확인 & 결제 */}
      {step === 'confirm' && selected && (
        <div>
          <h3 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>등록 확인</h3>

          {/* 미리보기 */}
          <div style={{ marginBottom: 16, borderRadius: 8, overflow: 'hidden', border: `1px solid ${selected.color}30` }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', padding: '4px 10px', background: 'var(--bg-hover)' }}>전광판 미리보기</div>
            <div style={{ background: selected.tier === 'urgent' ? '#1A0A0E' : selected.tier === 'premium' ? '#1A1508' : '#0A1A12', height: 36, display: 'flex', alignItems: 'center', overflow: 'hidden', paddingLeft: 16 }}>
              <span style={{ whiteSpace: 'nowrap', fontSize: 'var(--fs-sm)', fontWeight: 600, color: selected.color }}>{selected.icon}&nbsp;{content}</span>
            </div>
          </div>

          <div style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: '14px 16px', marginBottom: 16, fontSize: 'var(--fs-sm)' }}>
            {[
              { l: '상품', v: `${selected.icon} ${selected.name}` },
              { l: '노출', v: selected.durationDays ? `${selected.durationDays}일 무제한` : `${selected.maxImpressions}회` },
              { l: '결제', v: selected.pointPrice ? `${selected.pointPrice.toLocaleString()}P (포인트)` : `₩${selected.cashPrice.toLocaleString()} (현금)` },
            ].map(row => (
              <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{row.l}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{row.v}</span>
              </div>
            ))}
            {linkedPostId && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>연결 게시글</span>
                <span style={{ color: 'var(--brand)', fontWeight: 600 }}>#{linkedPostId}</span>
              </div>
            )}
          </div>

          {!selected.pointPrice && (
            <div style={{ padding: '10px 14px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.18)', borderRadius: 8, marginBottom: 16, fontSize: 'var(--fs-xs)', color: '#FBBF24' }}>
              💳 현금 결제 상품은 토스페이먼츠 라이브 전환 후 이용 가능합니다. 현재는 포인트 결제 상품만 구매 가능합니다.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep('compose')} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 'var(--fs-base)', fontWeight: 600, cursor: 'pointer' }}>수정</button>
            <button onClick={handleSubmit} disabled={submitting || (!selected.pointPrice)}
              style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: (submitting || !selected.pointPrice) ? 'var(--bg-hover)' : 'var(--brand)', color: (submitting || !selected.pointPrice) ? 'var(--text-tertiary)' : 'var(--text-inverse)', fontSize: 'var(--fs-base)', fontWeight: 700, cursor: (submitting || !selected.pointPrice) ? 'not-allowed' : 'pointer' }}>
              {submitting ? '등록 중...' : selected.pointPrice ? `${selected.pointPrice.toLocaleString()}P 결제` : `₩${selected.cashPrice.toLocaleString()} 결제`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
