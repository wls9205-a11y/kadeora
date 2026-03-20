'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import ImageUpload from '@/components/ImageUpload';
import { filterContent } from '@/lib/filter';
import { REGIONS } from '@/lib/constants';

const CATEGORIES = [
  { value: 'apt', label: '부동산', color: '#3b82f6' },
  { value: 'stock', label: '주식', color: '#ef4444' },
  { value: 'local', label: '우리동네', color: '#10b981' },
  { value: 'free', label: '자유', color: '#8b5cf6' },
];

export default function WriteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const { success, error } = useToast();

  const [category, setCategory] = useState('free');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [regionId, setRegionId] = useState('서울');
  const [loading, setLoading] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push('/login?redirect=/write'); return; }
      setUserId(data.session.user.id);
      const { data: profile } = await sb.from('profiles')
        .select('region_id, region_text').eq('id', data.session.user.id).single();
      if (profile?.region_id) {
        const matched = REGIONS.find(r => r.value !== 'all' && r.value === profile.region_id);
        if (matched) { setRegionId(matched.value); if (!editId) setCategory('local'); }
      } else if (profile?.region_text) {
        const matched = REGIONS.find(r => r.value !== 'all' && profile.region_text.startsWith(r.value));
        if (matched) { setRegionId(matched.value); if (!editId) setCategory('local'); }
      }
    });
  }, [router, editId]);

  useEffect(() => {
    if (!editId) return;
    setLoadingEdit(true);
    const sb = createSupabaseBrowser();
    sb.from('posts').select('*').eq('id', Number(editId)).single()
      .then(({ data, error: err }) => {
        if (err || !data) { error('게시글을 불러올 수 없습니다'); return; }
        setCategory(data.category); setTitle(data.title); setContent(data.content);
        setImages(data.images ?? []); setLoadingEdit(false);
      });
  }, [editId, error]);

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = tagInput.trim().replace(/^#/, '');
      if (tag && !hashtags.includes(tag) && hashtags.length < 5) setHashtags(prev => [...prev, tag]);
      setTagInput('');
    }
  };

  const handleSubmit = async () => {
    if (!userId) { error('로그인이 필요합니다'); return; }
    if (!title.trim()) { error('제목을 입력해주세요'); return; }
    if (!content.trim()) { error('내용을 입력해주세요'); return; }
    if (title.length > 100) { error('제목은 100자 이하로 입력해주세요'); return; }
    if (content.length > 5000) { error('내용은 5000자 이하로 입력해주세요'); return; }
    const titleCheck = filterContent(title);
    if (titleCheck.isBlocked) { error(titleCheck.reason ?? '제목을 확인해주세요'); return; }
    const contentCheck = filterContent(content);
    if (contentCheck.isBlocked) { error(contentCheck.reason ?? '내용을 확인해주세요'); return; }

    setLoading(true);
    try {
      const body = { category, title: title.trim(), content: content.trim(), images, is_anonymous: isAnonymous, tag: hashtags, ...(category === 'local' ? { region_id: regionId } : {}) };
      if (editId) {
        const res = await fetch(`/api/posts/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error((await res.json()).error ?? '수정 실패');
        success('게시글이 수정되었습니다'); router.push(`/feed/${editId}`);
      } else {
        const res = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error((await res.json()).error ?? '작성 실패');
        const { post } = await res.json();
        success('게시글이 작성되었습니다'); router.push(`/feed/${post.id}`);
      }
      router.refresh();
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : '오류가 발생했습니다');
    } finally { setLoading(false); }
  };

  if (loadingEdit) return (
    <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', padding: '80px 0', color: 'var(--text-secondary)' }}>
      게시글 불러오는 중...
    </div>
  );

  const isDisabled = loading || !title.trim() || !content.trim();

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 16px', paddingBottom: 80 }}>
      {/* 상단 바 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Link href="/feed" style={{ color: 'var(--text-tertiary)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>← 취소</Link>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
          {editId ? '글 수정' : '새 글 쓰기'}
        </span>
        <button
          onClick={handleSubmit}
          disabled={isDisabled}
          style={{
            padding: '7px 20px', borderRadius: 20, border: 'none', fontSize: 13, fontWeight: 700,
            background: isDisabled ? 'var(--bg-hover)' : 'var(--brand)',
            color: isDisabled ? 'var(--text-tertiary)' : 'var(--text-inverse)',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '...' : '게시'}
        </button>
      </div>

      {/* 카테고리 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {CATEGORIES.map(cat => {
          const active = category === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              style={{
                padding: '6px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                border: `1.5px solid ${active ? cat.color : 'var(--border)'}`,
                background: active ? cat.color + '15' : 'transparent',
                color: active ? cat.color : 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* 지역 선택 */}
      {category === 'local' && (
        <select
          value={regionId}
          onChange={e => setRegionId(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px', fontSize: 14, marginBottom: 20,
            background: 'var(--bg-base)', border: '1px solid var(--border)',
            borderRadius: 10, color: 'var(--text-primary)', boxSizing: 'border-box',
          }}
        >
          {REGIONS.filter(r => r.value !== 'all').map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      )}

      {/* 제목 */}
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="제목을 입력하세요"
        maxLength={100}
        style={{
          width: '100%', fontSize: 22, fontWeight: 800, padding: '16px 0',
          border: 'none', borderBottom: '1px solid var(--border)', borderRadius: 0,
          background: 'transparent', color: 'var(--text-primary)', outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right', marginTop: 4, marginBottom: 16 }}>
        {title.length}/100
      </div>

      {/* 내용 */}
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="내용을 자유롭게 작성해보세요..."
        maxLength={5000}
        style={{
          width: '100%', background: 'transparent', border: 'none',
          color: 'var(--text-primary)', padding: '0',
          fontSize: 16, resize: 'vertical', fontFamily: 'inherit',
          lineHeight: 1.9, boxSizing: 'border-box', minHeight: 320, outline: 'none',
        }}
      />

      {/* 이미지 */}
      <div style={{ marginBottom: 12 }}>
        <ImageUpload images={images} onImagesChange={setImages} />
      </div>

      {/* 해시태그 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          {hashtags.map(h => (
            <span key={h} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'var(--brand-light)', color: 'var(--brand)',
              borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600,
            }}>
              #{h}
              <button onClick={() => setHashtags(prev => prev.filter(t => t !== h))}
                type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 13, padding: 0 }}>✕</button>
            </span>
          ))}
        </div>
        {hashtags.length < 5 && (
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="#태그 입력 후 엔터"
            style={{
              width: '100%', padding: '8px 0', fontSize: 13,
              background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)',
              borderRadius: 0, color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none',
            }}
          />
        )}
      </div>

      {/* 하단 고정 바 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--bg-base)', borderTop: '1px solid var(--border)',
        padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        zIndex: 50,
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)}
            style={{ width: 14, height: 14, accentColor: 'var(--brand)', cursor: 'pointer' }} />
          익명
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: content.length > 4500 ? 'var(--warning)' : 'var(--text-tertiary)' }}>
            {content.length}/5000
          </span>
          <button
            onClick={handleSubmit}
            disabled={isDisabled}
            style={{
              padding: '7px 20px', borderRadius: 20, border: 'none', fontSize: 13, fontWeight: 700,
              background: isDisabled ? 'var(--bg-hover)' : 'var(--brand)',
              color: isDisabled ? 'var(--text-tertiary)' : 'var(--text-inverse)',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '...' : '게시'}
          </button>
        </div>
      </div>
    </div>
  );
}
