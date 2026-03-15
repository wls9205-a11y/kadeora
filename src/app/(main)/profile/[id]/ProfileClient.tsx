'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import type { Profile } from '@/types/database';
import { CATEGORY_MAP, GRADE_INFO } from '@/lib/constants';

type PostRow = { id: number; title: string; category: string; created_at: string; view_count: number; likes_count: number; comments_count: number };

interface Props {
  profile: Profile;
  posts: PostRow[];
  isOwner: boolean;
}

export default function ProfileClient({ profile, posts, isOwner }: Props) {
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(profile.nickname ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [saving, setSaving] = useState(false);
  const { success, error } = useToast();
  const router = useRouter();

  const grade = GRADE_INFO[profile.grade ?? '씨앗'] ?? { icon: '🌱', color: '#94A3B8' };

  const handleSave = async () => {
    if (!nickname.trim()) { error('닉네임을 입력해주세요'); return; }
    if (nickname.length > 20) { error('닉네임은 20자 이내로 입력해주세요'); return; }
    setSaving(true);
    try {
      const sb = createSupabaseBrowser();
      const { error: err } = await sb.from('profiles')
        .update({ nickname: nickname.trim(), bio: bio.trim(), updated_at: new Date().toISOString() })
        .eq('id', profile.id);
      if (err) throw err;
      success('프로필이 수정되었습니다');
      setEditing(false);
      router.refresh();
    } catch {
      error('프로필 수정 중 오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  const totalActivity = (profile.posts_count ?? 0) + (0 ?? 0) + (profile.likes_count ?? 0);
  const joinDate = new Date(profile.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Profile card */}
      <div style={{ background: '#111827', border: '1px solid #1E293B', borderRadius: 16, padding: '28px 28px 24px', marginBottom: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 800, color: 'white',
          }}>
            {(profile.nickname ?? profile.username ?? 'U')[0].toUpperCase()}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {editing ? (
              <>
                <input
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  placeholder="닉네임"
                  maxLength={20}
                  className="kd-input"
                  style={{ marginBottom: 8, fontSize: 15 }}
                />
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="자기소개를 입력해주세요"
                  maxLength={200}
                  rows={3}
                  style={{
                    width: '100%', background: '#0A0E17', border: '1px solid #1E293B',
                    borderRadius: 8, color: '#F1F5F9', padding: '10px 12px',
                    fontSize: 13, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5,
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#3B82F6')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#1E293B')}
                />
                <div style={{ fontSize: 11, color: '#64748B', textAlign: 'right', marginTop: 4 }}>{bio.length}/200</div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#F1F5F9' }}>
                    {profile.nickname ?? '익명'}
                  </h1>
                  <span style={{
                    fontSize: 12, padding: '2px 8px', borderRadius: 999, fontWeight: 700,
                    background: `${grade.color}20`, color: grade.color,
                  }}>
                    {grade.icon} {profile.grade ?? '씨앗'}
                  </span>
                </div>
                <p style={{ margin: '0 0 6px', fontSize: 13, color: '#94A3B8', lineHeight: 1.5 }}>
                  {profile.bio || (isOwner ? '자기소개를 작성해보세요' : '자기소개가 없습니다')}
                </p>
                <div style={{ fontSize: 12, color: '#64748B' }}>{joinDate} 가입</div>
              </>
            )}
          </div>

          {/* Edit button */}
          {isOwner && (
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {editing ? (
                <>
                  <button onClick={() => setEditing(false)} className="kd-btn kd-btn-ghost" style={{ fontSize: 13 }}>취소</button>
                  <button onClick={handleSave} disabled={saving} className="kd-btn kd-btn-primary" style={{ fontSize: 13 }}>
                    {saving ? '저장 중...' : '저장'}
                  </button>
                </>
              ) : (
                <button onClick={() => setEditing(true)} className="kd-btn kd-btn-ghost" style={{ fontSize: 13 }}>
                  ✏️ 프로필 수정
                </button>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, marginTop: 24, background: '#1E293B', borderRadius: 12, overflow: 'hidden' }}>
          {[
            { label: '게시글', value: profile.posts_count ?? 0, icon: '📝' },
            { label: '댓글', value: 0 ?? 0, icon: '💬' },
            { label: '받은 좋아요', value: profile.likes_count ?? 0, icon: '❤️' },
            { label: '총 활동', value: totalActivity, icon: '⚡' },
          ].map((stat, i) => (
            <div key={stat.label} style={{
              background: '#111827', padding: '16px 12px', textAlign: 'center',
              borderRight: i < 3 ? '1px solid #1E293B' : 'none',
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{stat.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#F1F5F9' }}>{stat.value.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Posts */}
      <div style={{ background: '#111827', border: '1px solid #1E293B', borderRadius: 16, padding: '20px 24px' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>📝 작성한 글 ({posts.length})</h2>
        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748B' }}>아직 작성한 글이 없습니다</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {posts.map((post, i) => {
              const cat = CATEGORY_MAP[post.category] ?? CATEGORY_MAP.free;
              return (
                <Link key={post.id} href={`/feed/${post.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    padding: '12px 0', borderBottom: i < posts.length - 1 ? '1px solid #1E293B' : 'none',
                    display: 'flex', gap: 10, alignItems: 'center',
                    transition: 'opacity 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 999, fontWeight: 700, flexShrink: 0, background: cat.bg, color: cat.color }}>{cat.label}</span>
                    <span style={{ flex: 1, fontSize: 14, color: '#CBD5E1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</span>
                    <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#64748B', flexShrink: 0 }}>
                      <span>❤️{post.likes_count}</span>
                      <span>💬{post.comments_count}</span>
                      <span>{new Date(post.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
