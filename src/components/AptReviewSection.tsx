'use client';
import { useState, useEffect, useCallback } from 'react';
import { Star, ThumbsUp, PenSquare, Flag } from 'lucide-react';
import { getAvatarColor } from '@/lib/avatar';
import { timeAgo } from '@/lib/format';
import { haptic } from '@/lib/haptic';

interface Review {
  id: string; apt_name: string; rating: number; pros: string | null;
  cons: string | null; content: string; living_years: number | null;
  is_resident: boolean; likes_count: number; created_at: string;
  profiles: { nickname: string; grade: number } | null;
}

function StarRating({ rating, size = 14, interactive, onChange }: {
  rating: number; size?: number; interactive?: boolean; onChange?: (r: number) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={size} fill={i <= rating ? 'var(--accent-yellow)' : 'none'}
          stroke={i <= rating ? 'var(--accent-yellow)' : 'var(--text-tertiary)'}
          style={{ cursor: interactive ? 'pointer' : 'default' }}
          onClick={() => interactive && onChange?.(i)} />
      ))}
    </div>
  );
}

export default function AptReviewSection({ aptName, region }: { aptName: string; region?: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ rating: 0, pros: '', cons: '', content: '', living_years: '', is_resident: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [reportedSet, setReportedSet] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ apt_name: aptName });
      if (region) params.set('region', region);
      const res = await fetch(`/api/apt/reviews?${params}`);
      const data = await res.json();
      setReviews(data.reviews || []);
      setAvgRating(data.avgRating || 0);
    } catch { }
    setLoading(false);
  }, [aptName, region]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!form.rating || !form.content) { setError('평점과 내용은 필수입니다'); return; }
    setSubmitting(true); setError('');
    try {
      const res = await fetch('/api/apt/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, apt_name: aptName, region_nm: region }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '오류가 발생했습니다'); return; }
      setShowForm(false);
      setForm({ rating: 0, pros: '', cons: '', content: '', living_years: '', is_resident: false });
      load();
    } catch { setError('네트워크 오류'); }
    setSubmitting(false);
  };

  const handleLike = async (reviewId: string) => {
    try {
      const res = await fetch(`/api/apt/reviews/${reviewId}/like`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || '오류가 발생했습니다'); return; }
      haptic('light');
      setLikedSet(prev => {
        const next = new Set(prev);
        if (data.liked) next.add(reviewId); else next.delete(reviewId);
        return next;
      });
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, likes_count: data.likes_count } : r));
    } catch { showToast('네트워크 오류'); }
  };

  const handleReport = async (reviewId: string) => {
    if (reportedSet.has(reviewId)) { showToast('이미 신고한 리뷰입니다'); return; }
    if (!confirm('이 리뷰를 신고하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/apt/reviews/${reviewId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: '부적절한 리뷰' }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || '오류가 발생했습니다'); return; }
      setReportedSet(prev => new Set(prev).add(reviewId));
      showToast('신고가 접수되었습니다');
      haptic('medium');
    } catch { showToast('네트워크 오류'); }
  };

  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)', padding: 14, marginBottom: 'var(--sp-md)',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>주민 리뷰</span>
          {avgRating > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)' }}>
              <StarRating rating={Math.round(avgRating)} size={12} />
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{avgRating}</span>
            </div>
          )}
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>({reviews.length})</span>
        </div>
        <button aria-label="리뷰 작성" onClick={() => setShowForm(!showForm)} style={{
          display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', padding: '4px 10px',
          background: 'var(--brand)', color: 'var(--text-inverse)', border: 'none', borderRadius: 'var(--radius-xs)',
          fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer',
        }}>
          <PenSquare size={12} /> 리뷰 쓰기
        </button>
      </div>

      {/* 리뷰 작성 폼 */}
      {showForm && (
        <div style={{
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12,
          marginBottom: 'var(--sp-md)', background: 'var(--bg-hover)',
        }}>
          <div style={{ marginBottom: 'var(--sp-sm)' }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-xs)' }}>평점 *</div>
            <StarRating rating={form.rating} size={20} interactive onChange={r => setForm(p => ({ ...p, rating: r }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
            <input placeholder="👍 장점" value={form.pros}
              onChange={e => setForm(p => ({ ...p, pros: e.target.value }))}
              style={{ padding: '6px 8px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-xs)' }} />
            <input placeholder="👎 단점" value={form.cons}
              onChange={e => setForm(p => ({ ...p, cons: e.target.value }))}
              style={{ padding: '6px 8px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-xs)' }} />
          </div>
          <textarea placeholder="리뷰 내용 (20자 이상) *" value={form.content} rows={3}
            onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-xs)', resize: 'vertical', marginBottom: 6 }} />
          <div style={{ display: 'flex', gap: 'var(--sp-sm)', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
            <input placeholder="거주 년수" type="number" value={form.living_years}
              onChange={e => setForm(p => ({ ...p, living_years: e.target.value }))}
              style={{ width: 80, padding: '6px 8px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-xs)' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_resident} onChange={e => setForm(p => ({ ...p, is_resident: e.target.checked }))} />
              현재 거주중
            </label>
          </div>
          {error && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-red)', marginBottom: 6 }}>{error}</div>}
          <button aria-label="리뷰 제출" onClick={handleSubmit} disabled={submitting} style={{
            width: '100%', padding: '8px', borderRadius: 'var(--radius-xs)', border: 'none', cursor: 'pointer',
            background: 'var(--brand)', color: 'var(--text-inverse)', fontWeight: 600, fontSize: 'var(--fs-xs)',
            opacity: submitting ? 0.5 : 1,
          }}>
            {submitting ? '등록 중...' : '리뷰 등록 (+10P)'}
          </button>
        </div>
      )}

      {/* 리뷰 목록 */}
      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>로딩 중...</div>
      ) : reviews.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>
          아직 리뷰가 없습니다. 첫 번째 리뷰를 남겨주세요!
        </div>
      ) : (
        reviews.slice(0, 5).map(r => (
          <div key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', marginBottom: 6 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: getAvatarColor(r.profiles?.nickname || ''), display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-inverse)', fontSize: 'var(--fs-xs)', fontWeight: 600,
              }}>
                {(r.profiles?.nickname || '?')[0]}
              </div>
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>{r.profiles?.nickname || '익명'}</span>
              <StarRating rating={r.rating} size={10} />
              {r.is_resident && (
                <span style={{ fontSize: 'var(--fs-xs)', padding: '1px 4px', borderRadius: 3, background: 'var(--accent-green-bg)', color: 'var(--accent-green)' }}>거주중</span>
              )}
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{timeAgo(r.created_at)}</span>
            </div>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{r.content}</p>
            {(r.pros || r.cons) && (
              <div style={{ display: 'flex', gap: 'var(--sp-sm)', marginTop: 6 }}>
                {r.pros && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-green)' }}>👍 {r.pros}</span>}
                {r.cons && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-red)' }}>👎 {r.cons}</span>}
              </div>
            )}
            {/* 좋아요 / 신고 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)', marginTop: 'var(--sp-sm)' }}>
              <button aria-label="도움이 됐어요" onClick={() => handleLike(r.id)} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', padding: '3px 8px',
                background: likedSet.has(r.id) ? 'var(--brand-bg)' : 'transparent',
                border: `1px solid ${likedSet.has(r.id) ? 'var(--brand)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-xs)', cursor: 'pointer', fontSize: 'var(--fs-xs)', fontWeight: 600,
                color: likedSet.has(r.id) ? 'var(--brand)' : 'var(--text-tertiary)',
                transition: 'all 0.15s ease',
              }}>
                <ThumbsUp size={12} fill={likedSet.has(r.id) ? 'var(--brand)' : 'none'} />
                {r.likes_count > 0 ? r.likes_count : '좋아요'}
              </button>
              <button aria-label="신고" onClick={() => handleReport(r.id)} style={{
                display: 'flex', alignItems: 'center', gap: 3, padding: '3px 6px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: 'var(--fs-xs)', color: reportedSet.has(r.id) ? 'var(--accent-red)' : 'var(--text-tertiary)',
                opacity: reportedSet.has(r.id) ? 0.5 : 1,
              }} disabled={reportedSet.has(r.id)}>
                <Flag size={11} /> {reportedSet.has(r.id) ? '신고됨' : '신고'}
              </button>
            </div>
          </div>
        ))
      )}
      {/* 토스트 */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-elevated, #1e293b)', color: 'var(--text-inverse)', padding: '10px 18px',
          borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-xs)', fontWeight: 600, zIndex: 100,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', whiteSpace: 'nowrap',
          animation: 'fadeIn 0.2s ease-out',
        }}>{toast}</div>
      )}
    </div>
  );
}
