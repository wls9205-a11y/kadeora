'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';

const CATEGORIES = [
  { value: 'apt', label: '🏠 청약', desc: '청약 정보, 아파트 분양' },
  { value: 'stock', label: '📈 주식', desc: '주식 시세, 투자 분석' },
  { value: 'free', label: '💬 자유', desc: '자유로운 주제의 글' },
];

export default function WriteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const { success, error } = useToast();

  const [category, setCategory] = useState('stock');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push('/login?redirect=/write');
        return;
      }
      setUserId(data.session.user.id);
    });
  }, [router]);

  // Load existing post if editing
  useEffect(() => {
    if (!editId) return;
    setLoadingEdit(true);
    const sb = createSupabaseBrowser();
    sb.from('posts').select('*').eq('id', Number(editId)).single()
      .then(({ data, error: err }) => {
        if (err || !data) { error('게시글을 불러올 수 없습니다'); return; }
        setCategory(data.category);
        setTitle(data.title);
        setContent(data.content);
        setLoadingEdit(false);
      });
  }, [editId, error]);

  const handleSubmit = async () => {
    if (!userId) { error('로그인이 필요합니다'); return; }
    if (!title.trim()) { error('제목을 입력해주세요'); return; }
    if (!content.trim()) { error('내용을 입력해주세요'); return; }
    if (title.length > 100) { error('제목은 100자 이내로 입력해주세요'); return; }
    if (content.length > 5000) { error('내용은 5000자 이내로 입력해주세요'); return; }

    setLoading(true);
    try {
      if (editId) {
        // Edit mode
        const res = await fetch(`/api/posts/${editId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, title: title.trim(), content: content.trim() }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? '수정 실패');
        }
        success('게시글이 수정되었습니다');
        router.push(`/feed/${editId}`);
      } else {
        // Write mode
        const res = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, title: title.trim(), content: content.trim() }),
        });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error ?? '작성 실패');
        }
        const { post } = await res.json();
        success('게시글이 작성되었습니다');
        router.push(`/feed/${post.id}`);
      }
      router.refresh();
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  if (loadingEdit) return (
    <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', padding: '80px 0', color: '#94A3B8' }}>
      게시글 불러오는 중...
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: '#64748B', marginBottom: 24 }}>
        <a href="/feed" style={{ color: '#3B82F6', textDecoration: 'none' }}>피드</a>
        <span style={{ margin: '0 6px' }}>›</span>
        <span>{editId ? '게시글 수정' : '글 작성'}</span>
      </div>

      <div style={{ background: '#111827', border: '1px solid #1E293B', borderRadius: 16, padding: '28px 28px 24px' }}>
        <h1 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 800, color: '#F1F5F9' }}>
          {editId ? '✏️ 게시글 수정' : '✏️ 새 글 작성'}
        </h1>

        {/* Category */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: 8 }}>카테고리</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                  border: `2px solid ${category === cat.value ? '#3B82F6' : '#1E293B'}`,
                  background: category === cat.value ? 'rgba(59,130,246,0.12)' : 'transparent',
                  color: category === cat.value ? '#3B82F6' : '#94A3B8',
                  fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: 8 }}>
            제목 <span style={{ color: '#64748B', fontWeight: 400 }}>({title.length}/100)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="제목을 입력해주세요"
            maxLength={100}
            className="kd-input"
            style={{ fontSize: 15, padding: '12px 14px' }}
          />
        </div>

        {/* Content */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: 8 }}>
            내용 <span style={{ color: content.length > 4500 ? '#F59E0B' : '#64748B', fontWeight: 400 }}>({content.length}/5000)</span>
          </label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="내용을 입력해주세요&#10;&#10;투자 정보, 분석, 경험담 등 커뮤니티와 공유하고 싶은 내용을 작성해보세요."
            maxLength={5000}
            rows={14}
            style={{
              width: '100%', background: '#0A0E17', border: '1px solid #1E293B',
              borderRadius: 10, color: '#F1F5F9', padding: '14px',
              fontSize: 14, resize: 'vertical', fontFamily: 'inherit',
              lineHeight: 1.7, transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = '#3B82F6')}
            onBlur={e => (e.currentTarget.style.borderColor = '#1E293B')}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={() => router.back()}
            className="kd-btn kd-btn-ghost"
            style={{ minWidth: 80 }}
          >취소</button>
          <button
            onClick={handleSubmit}
            disabled={loading || !title.trim() || !content.trim()}
            className="kd-btn kd-btn-primary"
            style={{ minWidth: 100, fontWeight: 700 }}
          >
            {loading ? '처리 중...' : (editId ? '수정 완료' : '게시하기')}
          </button>
        </div>
      </div>
    </div>
  );
}
