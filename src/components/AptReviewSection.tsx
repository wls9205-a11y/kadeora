'use client';
import { useState, useEffect, useCallback } from 'react';
import { Star, ThumbsUp, PenSquare } from 'lucide-react';
import { getAvatarColor } from '@/lib/avatar';

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
        <Star key={i} size={size} fill={i <= rating ? '#FBBF24' : 'none'}
          stroke={i <= rating ? '#FBBF24' : 'var(--text-tertiary)'}
          style={{ cursor: interactive ? 'pointer' : 'default' }}
          onClick={() => interactive && onChange?.(i)} />
      ))}
    </div>
  );
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export default function AptReviewSection({ aptName, region }: { aptName: string; region?: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ rating: 0, pros: '', cons: '', content: '', living_years: '', is_resident: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 14, marginBottom: 12,
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>주민 리뷰</span>
          {avgRating > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <StarRating rating={Math.round(avgRating)} size={12} />
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{avgRating}</span>
            </div>
          )}
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>({reviews.length})</span>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
          background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 6,
          fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer',
        }}>
          <PenSquare size={12} /> 리뷰 쓰기
        </button>
      </div>

      {/* 리뷰 작성 폼 */}
      {showForm && (
        <div style={{
          border: '1px solid var(--border)', borderRadius: 10, padding: 12,
          marginBottom: 12, background: 'var(--bg-hover)',
        }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginBottom: 4 }}>평점 *</div>
            <StarRating rating={form.rating} size={20} interactive onChange={r => setForm(p => ({ ...p, rating: r }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
            <input placeholder="👍 장점" value={form.pros}
              onChange={e => setForm(p => ({ ...p, pros: e.target.value }))}
              style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-xs)' }} />
            <input placeholder="👎 단점" value={form.cons}
              onChange={e => setForm(p => ({ ...p, cons: e.target.value }))}
              style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-xs)' }} />
          </div>
          <textarea placeholder="리뷰 내용 (20자 이상) *" value={form.content} rows={3}
            onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-xs)', resize: 'vertical', marginBottom: 6 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input placeholder="거주 년수" type="number" value={form.living_years}
              onChange={e => setForm(p => ({ ...p, living_years: e.target.value }))}
              style={{ width: 80, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 'var(--fs-xs)' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_resident} onChange={e => setForm(p => ({ ...p, is_resident: e.target.checked }))} />
              현재 거주중
            </label>
          </div>
          {error && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-red)', marginBottom: 6 }}>{error}</div>}
          <button onClick={handleSubmit} disabled={submitting} style={{
            width: '100%', padding: '8px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: 'var(--brand)', color: '#fff', fontWeight: 600, fontSize: 'var(--fs-xs)',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: getAvatarColor(r.profiles?.nickname || ''), display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 10, fontWeight: 700,
              }}>
                {(r.profiles?.nickname || '?')[0]}
              </div>
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>{r.profiles?.nickname || '익명'}</span>
              <StarRating rating={r.rating} size={10} />
              {r.is_resident && (
                <span style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, background: 'var(--accent-green-bg)', color: 'var(--accent-green)' }}>거주중</span>
              )}
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{timeAgo(r.created_at)}</span>
            </div>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{r.content}</p>
            {(r.pros || r.cons) && (
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                {r.pros && <span style={{ fontSize: 10, color: 'var(--accent-green)' }}>👍 {r.pros}</span>}
                {r.cons && <span style={{ fontSize: 10, color: 'var(--accent-red)' }}>👎 {r.cons}</span>}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
