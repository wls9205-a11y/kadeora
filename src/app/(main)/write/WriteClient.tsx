'use client';
import { errMsg } from '@/lib/error-utils';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Camera } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import ImageUpload from '@/components/ImageUpload';
import { filterContent } from '@/lib/filter';
import { REGIONS } from '@/lib/constants';

const CATEGORIES = [
  { value: 'free', label: '💬 자유' },
  { value: 'stock', label: '📊 주식' },
  { value: 'apt', label: '🏢 부동산' },
  { value: 'local', label: '📍 우리동네' },
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
  const [regionId, setRegionId] = useState('서울');
  const [loading, setLoading] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);
  // 투표
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollEndsAt, setPollEndsAt] = useState('');

  // 임시저장 키
  const DRAFT_KEY = 'kd_write_draft';

  // 임시저장 복원
  useEffect(() => {
    if (editId) return; // 수정 모드면 복원 안 함
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        const age = Date.now() - (draft.savedAt || 0);
        if (age < 24 * 60 * 60 * 1000) { // 24시간 이내
          if (draft.title) setTitle(draft.title);
          if (draft.content) setContent(draft.content);
          if (draft.category) setCategory(draft.category);
          if (draft.tags?.length) setTags(draft.tags);
          if (draft.isAnonymous) setIsAnonymous(draft.isAnonymous);
          setDraftRestored(true);
        } else {
          localStorage.removeItem(DRAFT_KEY);
        }
      }
    } catch {}
  }, [editId]);

  // 내용 변경 시 자동 저장 (debounce 1초)
  useEffect(() => {
    if (editId) return;
    if (!title && !content) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          title, content, category, tags, isAnonymous, savedAt: Date.now(),
        }));
      } catch {}
    }, 1000);
    return () => clearTimeout(timer);
  }, [title, content, category, tags, isAnonymous, editId]);

  // 임시저장 삭제 (등록 성공 시)
  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
  };

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push('/login?redirect=/write'); return; }
      setUserId(data.session.user.id);
      const { data: profile } = await sb.from('profiles')
        .select('residence_city, region_text').eq('id', data.session.user.id).single();
      if (profile?.residence_city) {
        const matched = REGIONS.find(r => r.value !== 'all' && r.value === profile.residence_city);
        if (matched) { setRegionId(matched.value); if (!editId) setCategory('local'); }
      } else if (profile?.region_text) {
        const matched = REGIONS.find(r => r.value !== 'all' && ((profile.region_text ?? '') as string).startsWith(r.value));
        if (matched) { setRegionId(matched.value); if (!editId) setCategory('local'); }
      }
    });
  }, [router, editId]);

  useEffect(() => {
    if (!editId) return;
    setLoadingEdit(true);
    const sb = createSupabaseBrowser();
    sb.from('posts').select('id, title, content, category, images, tag, is_anonymous').eq('id', Number(editId)).single()
      .then(({ data, error: err }) => {
        if (err || !data) { error('게시글을 불러올 수 없습니다'); return; }
        setCategory(data.category); setTitle(data.title); setContent(data.content);
        setImages(data.images ?? []); setLoadingEdit(false);
      });
  }, [editId, error]);

  const handleSubmit = async () => {
    if (!userId) { error('로그인이 필요합니다'); return; }
    if (!content.trim()) { error('내용을 입력해주세요'); return; }
    if (content.length > 5000) { error('내용은 5000자 이하로 입력해주세요'); return; }
    if (title && title.length > 100) { error('제목은 100자 이하로 입력해주세요'); return; }
    const contentCheck = filterContent(content);
    if (contentCheck.isBlocked) { error(contentCheck.reason ?? '내용을 확인해주세요'); return; }
    if (title) {
      const titleCheck = filterContent(title);
      if (titleCheck.isBlocked) { error(titleCheck.reason ?? '제목을 확인해주세요'); return; }
    }

    setLoading(true);
    try {
      const body = {
        category,
        title: title.trim() || content.trim().slice(0, 50),
        content: content.trim(),
        images,
        is_anonymous: isAnonymous,
        tags,
        ...(category === 'local' ? { region_id: regionId } : {}),
      };
      if (editId) {
        const res = await fetch(`/api/posts/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error((await res.json()).error ?? '수정 실패');
        const { post: updated } = await res.json();
        success('수정되었습니다'); clearDraft(); router.push(`/feed/${updated?.slug || editId}`);
      } else {
        const res = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error((await res.json()).error ?? '작성 실패');
        const { post } = await res.json();
        // 투표 생성
        if (showPollForm && pollQuestion.trim() && pollOptions.filter((o: string) => o.trim()).length >= 2) {
          await fetch('/api/polls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              post_id: post.id,
              question: pollQuestion.trim(),
              options: pollOptions.filter((o: string) => o.trim()),
              ends_at: pollEndsAt || null,
            }),
          }).catch(() => { /* 투표 실패는 무시 */ });
        }
        success('작성되었습니다'); clearDraft(); router.push(`/feed/${post.slug || post.id}`);
      }
      router.refresh();
    } catch (e: unknown) {
      error(e instanceof Error ? errMsg(e) : '오류가 발생했습니다');
    } finally { setLoading(false); }
  };

  if (loadingEdit) return (
    <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', padding: '80px 0', color: 'var(--text-secondary)' }}>
      불러오는 중...
    </div>
  );

  const canSubmit = !loading && content.trim().length > 0;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px', paddingBottom: 80 }}>
      {/* 상단 바 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-lg)' }}>
        <Link href="/feed" style={{ color: 'var(--text-tertiary)', textDecoration: 'none', fontSize: 'var(--fs-base)', fontWeight: 600 }}>← 돌아가기</Link>
        <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-primary)' }}>글쓰기</span>
        <button onClick={handleSubmit} disabled={!canSubmit} style={{
          padding: '7px 16px', borderRadius: 12, border: 'none', fontSize: 'var(--fs-sm)', fontWeight: 700,
          background: canSubmit ? 'var(--brand)' : 'var(--bg-hover)',
          color: canSubmit ? 'var(--text-inverse)' : 'var(--text-tertiary)',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
        }}>{loading ? '...' : '등록'}</button>
      </div>

      {/* 임시저장 복원 알림 */}
      {draftRestored && !editId && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', marginBottom: 'var(--sp-md)', borderRadius: 10,
          background: 'var(--brand-bg)', border: '1px solid rgba(37,99,235,0.2)',
          fontSize: 'var(--fs-sm)', color: 'var(--accent-blue)',
        }}>
          <span>📝 임시저장된 글을 불러왔어요</span>
          <button onClick={() => { setTitle(''); setContent(''); setTags([]); setDraftRestored(false); clearDraft(); }} style={{
            background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 600,
          }}>삭제</button>
        </div>
      )}

      {/* 카테고리 칩 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--sp-lg)', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
        {CATEGORIES.map(c => (
          <button key={c.value} onClick={() => setCategory(c.value)} style={{
            padding: '6px 14px', borderRadius: 999, fontSize: 'var(--fs-sm)', fontWeight: 600,
            cursor: 'pointer', flexShrink: 0, border: 'none',
            background: category === c.value ? 'var(--brand)' : 'var(--bg-hover)',
            color: category === c.value ? 'var(--text-inverse)' : 'var(--text-tertiary)',
            transition: 'all 0.15s',
          }}>
            {c.label}
          </button>
        ))}
        {category === 'local' && (
          <select value={regionId} onChange={e => setRegionId(e.target.value)}
            style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 10px', fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', flexShrink: 0 }}>
            {REGIONS.filter(r => r.value !== 'all').map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* 제목 */}
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="제목을 입력하세요"
        aria-label="게시글 제목"
        maxLength={100}
        style={{
          width: '100%', fontSize: 'var(--fs-lg)', fontWeight: 700, padding: '12px 16px',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', background: 'var(--bg-surface)',
          color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.2s',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'var(--brand)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
      />

      {/* 본문 */}
      <textarea
        value={content}
        onChange={e => {
          setContent(e.target.value);
          e.target.style.height = 'auto';
          e.target.style.height = e.target.scrollHeight + 'px';
        }}
        placeholder="무슨 소문이 있나요? 자유롭게 이야기해주세요."
        aria-label="게시글 내용"
        maxLength={5000}
        autoFocus
        style={{
          width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 12, color: 'var(--text-primary)', padding: '12px 16px', marginTop: 8,
          fontSize: 'var(--fs-md)', resize: 'none', fontFamily: 'inherit',
          lineHeight: 1.8, boxSizing: 'border-box', minHeight: 200, outline: 'none',
          transition: 'border-color 0.2s',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'var(--brand)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
      />

      {/* 이미지 */}
      <ImageUpload images={images} onImagesChange={setImages} />

      {/* 투표 추가 */}
      {!editId && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setShowPollForm(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              borderRadius: 999, border: `1px solid ${showPollForm ? 'var(--brand)' : 'var(--border)'}`,
              background: showPollForm ? 'var(--brand-bg, rgba(37,99,235,0.08))' : 'transparent',
              color: showPollForm ? 'var(--brand)' : 'var(--text-tertiary)',
              cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 600, fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}>
            🗳️ 투표 {showPollForm ? '제거' : '추가'}
          </button>
          {showPollForm && (
            <div style={{ marginTop: 10, padding: '14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
              <input
                value={pollQuestion}
                onChange={e => setPollQuestion(e.target.value)}
                placeholder="투표 질문을 입력하세요"
                maxLength={100}
                style={{ width: '100%', padding: '8px 12px', fontSize: 'var(--fs-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', boxSizing: 'border-box', marginBottom: 'var(--sp-sm)' }}
              />
              {pollOptions.map((opt: string, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input
                    value={opt}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPollOptions((prev: string[]) => { const n = [...prev]; n[i] = e.target.value; return n; })}
                    placeholder={`선택지 ${i + 1}`}
                    maxLength={50}
                    style={{ flex: 1, padding: '7px 10px', fontSize: 'var(--fs-sm)', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }}
                  />
                  {pollOptions.length > 2 && (
                    <button onClick={() => setPollOptions((prev: string[]) => prev.filter((_: string, j: number) => j !== i))}
                      style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                {pollOptions.length < 6 && (
                  <button onClick={() => setPollOptions((prev: string[]) => [...prev, ''])}
                    style={{ fontSize: 'var(--fs-xs)', color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                    + 선택지 추가
                  </button>
                )}
                <input
                  type="date"
                  value={pollEndsAt}
                  onChange={e => setPollEndsAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)' }}
                />
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>마감일(선택)</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 태그 */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 'var(--sp-sm)' }}>
          {tags.map(t => (
            <span key={t} style={{
              fontSize: 'var(--fs-sm)', padding: '3px 10px', borderRadius: 999,
              background: 'var(--bg-hover)', color: 'var(--text-secondary)',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              #{t}
              <button onClick={() => setTags(prev => prev.filter(x => x !== t))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', padding: 0 }} aria-label="닫기">×</button>
            </span>
          ))}
        </div>
        {tags.length < 5 && (
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value.replace(/[#\s]/g, ''))}
            onKeyDown={e => {
              if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                e.preventDefault();
                const t = tagInput.trim();
                if (t && !tags.includes(t) && tags.length < 5) setTags(prev => [...prev, t]);
                setTagInput('');
              }
            }}
            placeholder="태그 입력 (최대 5개, Enter로 추가)"
            style={{
              width: '100%', padding: '8px 12px', fontSize: 'var(--fs-sm)',
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text-primary)', boxSizing: 'border-box',
            }}
          />
        )}
      </div>

      {/* 등록 버튼 */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{
          width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
          fontSize: 'var(--fs-md)', fontWeight: 700, marginTop: 20,
          background: canSubmit ? 'var(--brand)' : 'var(--bg-hover)',
          color: canSubmit ? 'var(--text-inverse)' : 'var(--text-tertiary)',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          transition: 'all 0.15s',
        }}
      >
        {loading ? '등록 중...' : editId ? '수정하기' : '등록하기'}
      </button>

      {/* 경고 */}
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginTop: 12, lineHeight: 1.5, textAlign: 'center' }}>
        광고, 비난, 도배성 글을 남기면 활동이 제한될 수 있어요.
      </div>

      {/* 하단 도구바 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--bg-base)', borderTop: '1px solid var(--border)',
        padding: '8px 16px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        display: 'flex', alignItems: 'center', gap: 12, zIndex: 50,
      }}>
        <button onClick={() => document.querySelector<HTMLInputElement>('[data-image-input]')?.click()}
          type="button" style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', padding: '4px 0' }}>
          <Camera size={18} /> 사진
        </button>

        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
          <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)}
            style={{ width: 13, height: 13, accentColor: 'var(--brand)' }} />
          익명
        </label>

        <span style={{ fontSize: 'var(--fs-xs)', color: content.length > 4500 ? 'var(--warning)' : 'var(--text-tertiary)' }}>
          {content.length}/5000
        </span>
      </div>
    </div>
  );
}
