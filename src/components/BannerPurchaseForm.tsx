'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import type { User } from '@supabase/supabase-js';

interface BannerProduct {
  id: string;
  name: string;
  description: string;
  price_krw: number;
  point_cost: number;
  product_type: string;
}

interface BannerPurchaseFormProps {
  onClose: () => void;
}

export default function BannerPurchaseForm({ onClose }: BannerPurchaseFormProps) {
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<BannerProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<BannerProduct | null>(null);
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
        // Fetch user's posts for linking
        sb.from('posts')
          .select('id, title')
          .eq('author_id', u.id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(20)
          .then(({ data: posts }) => setMyPosts(posts ?? []));
      }
    });

    // Fetch banner products
    sb.from('shop_products')
      .select('id, name, description, price_krw, point_cost, product_type')
      .in('product_type', ['banner_1d', 'banner_3d'])
      .eq('is_active', true)
      .order('price_krw')
      .then(({ data }) => setProducts((data ?? []) as BannerProduct[]));
  }, []);

  const handleSubmit = async () => {
    if (!user || !selectedProduct || !content.trim()) return;
    setSubmitting(true);

    try {
      const sb = createSupabaseBrowser();

      // Check user points
      const { data: profile } = await sb
        .from('profiles')
        .select('points')
        .eq('id', user.id)
        .single();

      if (!profile || profile.points < selectedProduct.point_cost) {
        error(`포인트가 부족합니다. 필요: ${selectedProduct.point_cost}P, 보유: ${profile?.points ?? 0}P`);
        setSubmitting(false);
        return;
      }

      // Calculate display window
      const days = selectedProduct.product_type === 'banner_3d' ? 3 : 1;
      const displayStart = new Date();
      const displayEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      // Create the notice
      const { error: insertErr } = await sb.from('site_notices').insert({
        content: content.trim(),
        is_active: true,
        is_paid: true,
        author_id: user.id,
        linked_post_id: linkedPostId || null,
        display_start: displayStart.toISOString(),
        display_end: displayEnd.toISOString(),
      });

      if (insertErr) throw insertErr;

      // Deduct points
      await sb.rpc('deduct_points', {
        p_user_id: user.id,
        p_amount: selectedProduct.point_cost,
      }).then(async ({ error: rpcErr }) => {
        // Fallback: direct update if RPC doesn't exist
        if (rpcErr) {
          await sb
            .from('profiles')
            .update({ points: (profile.points - selectedProduct.point_cost) })
            .eq('id', user.id);
        }
      });

      success(`전광판 등록 완료! ${days}일간 노출됩니다.`);
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
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
          전광판 등록은 로그인이 필요합니다
        </div>
        <a
          href="/login"
          style={{
            display: 'inline-block',
            padding: '10px 24px',
            background: 'var(--brand)',
            color: 'var(--text-inverse)',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          로그인
        </a>
      </div>
    );
  }

  return (
    <div>
      {/* Step 1: Select product */}
      {step === 'select' && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
            전광판 노출권 선택
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {products.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  setSelectedProduct(p);
                  setStep('compose');
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSelectedProduct(p);
                    setStep('compose');
                  }
                }}
                style={{
                  padding: '16px 20px',
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    📡 {p.name}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)' }}>
                    {p.point_cost.toLocaleString()}P
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.description}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  또는 {p.price_krw.toLocaleString()}원
                </div>
              </div>
            ))}
            {products.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)', fontSize: 13 }}>
                현재 등록 가능한 상품이 없습니다
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Compose message */}
      {step === 'compose' && selectedProduct && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            전광판 내용 작성
          </h3>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
            {selectedProduct.name} ({selectedProduct.point_cost}P)
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="전광판에 표시할 내용을 입력하세요 (최대 100자)"
            maxLength={100}
            rows={3}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: 14,
              fontFamily: 'inherit',
              resize: 'none',
              boxSizing: 'border-box',
              lineHeight: 1.5,
            }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right', marginTop: 4 }}>
            {content.length}/100
          </div>

          {/* Link a post */}
          {myPosts.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                연결할 게시글 (선택)
              </label>
              <select
                value={linkedPostId}
                onChange={(e) => setLinkedPostId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-base)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontFamily: 'inherit',
                }}
              >
                <option value="">연결 안함</option>
                {myPosts.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button
              onClick={() => setStep('select')}
              style={{
                flex: 1,
                padding: '12px 0',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--bg-hover)',
                color: 'var(--text-secondary)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              이전
            </button>
            <button
              onClick={() => setStep('confirm')}
              disabled={!content.trim()}
              style={{
                flex: 1,
                padding: '12px 0',
                borderRadius: 10,
                border: 'none',
                background: content.trim() ? 'var(--brand)' : 'var(--bg-hover)',
                color: content.trim() ? 'var(--text-inverse)' : 'var(--text-tertiary)',
                fontSize: 14,
                fontWeight: 600,
                cursor: content.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              다음
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 'confirm' && selectedProduct && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
            등록 확인
          </h3>

          {/* Preview */}
          <div style={{ marginBottom: 16, borderRadius: 8, overflow: 'hidden', border: '1px solid #1a3a1a' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '4px 10px', background: 'var(--bg-hover)' }}>미리보기</div>
            <div style={{ background: '#0a1a0a', height: 32, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
              <div style={{ whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, color: '#4ade80', paddingLeft: 16 }}>
                📡&nbsp;{content}
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: '14px 16px', marginBottom: 16, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: 'var(--text-secondary)' }}>상품</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedProduct.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>차감 포인트</span>
              <span style={{ color: 'var(--brand)', fontWeight: 700 }}>{selectedProduct.point_cost.toLocaleString()}P</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setStep('compose')}
              style={{
                flex: 1,
                padding: '12px 0',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--bg-hover)',
                color: 'var(--text-secondary)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              수정
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                flex: 1,
                padding: '12px 0',
                borderRadius: 10,
                border: 'none',
                background: submitting ? 'var(--bg-hover)' : 'var(--brand)',
                color: submitting ? 'var(--text-tertiary)' : 'var(--text-inverse)',
                fontSize: 14,
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? '등록 중...' : '등록하기'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
