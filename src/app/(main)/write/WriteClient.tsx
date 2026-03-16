// draft support added
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import ImageUpload from '@/components/ImageUpload';

const CATEGORIES = [
  { value: 'apt', label: '🏠 부동산', desc: '부동산 정보, 청약, 투자 이야기' },
  { value: 'stock', label: '📈 주식', desc: '주식 시세, 투자 종목 이야기' },
  { value: 'free', label: '💬 자유', desc: '자유롭게 이야기해요' },
];

export default function WriteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const { success, error } = useToast();

  const [category, setCategory] = useState('stock');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

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
        setImages(data.images ?? []);
        setLoadingEdit(false);
      });
  }, [editId, error]);

  const handleSubmit = async () => {
    if (!userId) { error('로그인이 필요합니다'); return; }
    if (!title.trim()) { error('제목을 입력해주세요'); return; }
    if (!content.trim()) { error('내용을 입력해주세요'); return; }
    if (title.length > 100) { error('제목은 100자 이하로 입력해주세요'); return; }
    if (content.length > 5000) { error('내용은 5000자 이하로 입력해주세요'); return; }

    setLoading(true);
    try {
      if (editId) {
        const res = await fetch(`/api/posts/${editId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, title: title.trim(), content: content.trim(), images }),
        });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error ?? '수정 실패');
        }
        success('게시글이 수정되었습니다');
        router.push(`/feed/${editId}`);
      } else {
        const res = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, title: title.trim(), content: content.trim(), images }),
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
    <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', padding: '80px 0', color: 'var(--text-secondary)' }}>
      게시글 불러오는 중...
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>
        <Link href="/feed" style={{ color: 'var(--brand)', textDecoration: 'none' }}>피드</Link>
        <span style={{ margin: '0 6px' }}>›</span>
        <span>{editId ? '게시글 수정' : '새 글 작성'}</span>
      </div>

      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '28px 28px 24px',
      }}>
        <h1 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
          {editId ? '✏️ 게시글 수정' : '✏️ 새 글 작성'}
        </h1>

        {/* 카테고리 */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>카테고리</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                  border: `2px solid ${category === cat.value ? 'var(--brand)' : 'var(--border)'}`,
                  background: category === cat.value ? 'rgba(59,130,246,0.12)' : 'transparent',
                  color: category === cat.value ? 'var(--brand)' : 'var(--text-secondary)',
                  fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* 제목 */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
            제목 <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>({title.length}/100)</span>
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

        {/* 내용 */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
            내용{' '}
            <span style={{ color: content.length > 4500 ? 'var(--warning)' : 'var(--text-tertiary)', fontWeight: 400 }}>
              ({content.length}/5000)
            </span>
          </label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="내용을 입력해주세요"
            maxLength={5000}
            rows={14}
            style={{
              width: '100%', background: 'var(--bg-base)', border: '1px solid var(--border)',
              borderRadius: 10, color: 'var(--text-primary)', padding: '14px',
              fontSize: 14, resize: 'vertical', fontFamily: 'inherit',
              lineHeight: 1.7, transition: 'border-color 0.15s', boxSizing: 'border-box',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--brand)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
        </div>

        {/* 이미지 업로드 */}
        <div style={{ marginBottom: 24 }}>
          <ImageUpload images={images} onImagesChange={setImages} />
        </div>

        {/* 버튼 */}
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