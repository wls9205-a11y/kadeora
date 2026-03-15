'use client';
import { useState, useRef } from 'react';
import Image from 'next/image';
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
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { success, error } = useToast();
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const grade = GRADE_INFO[profile.grade ?? '씨앗'] ?? { icon: '🌱', color: 'var(--kd-text-muted)' };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      error('JPG, PNG, WebP 형식만 가능합니다'); return;
    }
    if (file.size > 2 * 1024 * 1024) {
      error('2MB 이하 이미지만 가능합니다'); return;
    }
    setAvatarUploading(true);
    try {
      const sb = createSupabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { error('로그인이 필요합니다'); return; }

      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}/avatar_${Date.now()}.${ext}`;

      const { error: uploadErr } = await sb.storage.from('avatars').upload(fileName, file, { cacheControl: '3600', upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = sb.storage.from('avatars').getPublicUrl(fileName);
      const newUrl = urlData.publicUrl;

      const { error: updateErr } = await sb.from('profiles').update({ avatar_url: newUrl }).eq('id', user.id);
      if (updateErr) throw updateErr;

      setAvatarUrl(newUrl);
      success('프로필 사진이 변경되었습니다');
      router.refresh();
    } catch {
      error('업로드 중 오류가 발생했습니다');
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

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

  const totalActivity = (profile.posts_count ?? 0) + (profile.likes_count ?? 0);
  const joinDate = new Date(profile.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
  const displayName = profile.nickname ?? '익명';

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Profile card */}
      <div style={{ background: 'var(--kd-surface)', border: '1px solid var(--kd-border)', borderRadius: 16, padding: '28px 28px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {avatarUrl ? (
              <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', position: 'relative', border: '2px solid var(--kd-border)' }}>
                <Image
                  src={avatarUrl}
                  alt={`${displayName} 프로필 사진`}
                  fill
                  sizes="72px"
                  style={{ objectFit: 'cover' }}
                />
              </div>
            ) : (
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, fontWeight: 800, color: 'white',
                border: '2px solid var(--kd-border)',
              }}>
                {displayName[0].toUpperCase()}
              </div>
            )}
            {/* 아바타 업로드 버튼 — 본인만 */}
            {isOwner && (
              <>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarUpload}
                  style={{ display: 'none' }}
                  id="avatar-upload"
                  aria-label="프로필 사진 변경"
                />
                <label
                  htmlFor="avatar-upload"
                  title="프로필 사진 변경"
                  style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'var(--kd-primary)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, cursor: avatarUploading ? 'not-allowed' : 'pointer',
                    border: '2px solid var(--kd-surface)',
                    opacity: avatarUploading ? 0.6 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {avatarUploading ? '⏳' : '📷'}
                </label>
              </>
            )}
          </div>

          {/* 닉네임 / 소개 */}
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
                    width: '100%', background: 'var(--kd-bg)', border: '1px solid var(--kd-border)',
                    borderRadius: 8, color: 'var(--kd-text)', padding: '10px 12px',
                    fontSize: 13, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5,
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--kd-primary)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--kd-border)')}
                />
                <div style={{ fontSize: 11, color: 'var(--kd-text-dim)', textAlign: 'right', marginTop: 4 }}>{bio.length}/200</div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--kd-text)' }}>
                    {displayName}
                  </h1>
                  <span style={{
                    fontSize: 12, padding: '2px 8px', borderRadius: 999, fontWeight: 700,
                    background: `${grade.color}20`, color: grade.color,
                  }}>
                    {grade.icon} {profile.grade ?? '씨앗'}
                  </span>
                </div>
                <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--kd-text-muted)', lineHeight: 1.5 }}>
                  {profile.bio || (isOwner ? '자기소개를 작성해보세요' : '자기소개가 없습니다')}
                </p>
                <div style={{ fontSize: 12, color: 'var(--kd-text-dim)' }}>{joinDate} 가입</div>
              </>
            )}
          </div>

          {/* 수정 버튼 */}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, marginTop: 24, background: 'var(--kd-border)', borderRadius: 12, overflow: 'hidden' }}>
          {[
            { label: '게시글', value: profile.posts_count ?? 0, icon: '📝' },
            { label: '댓글', value: 0, icon: '💬' },
            { label: '받은 좋아요', value: profile.likes_count ?? 0, icon: '❤️' },
            { label: '총 활동', value: totalActivity, icon: '⚡' },
          ].map((stat, i) => (
            <div key={stat.label} style={{
              background: 'var(--kd-surface)', padding: '16px 12px', textAlign: 'center',
              borderRight: i < 3 ? '1px solid var(--kd-border)' : 'none',
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{stat.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--kd-text)' }}>{stat.value.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--kd-text-dim)', marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Posts */}
      <div style={{ background: 'var(--kd-surface)', border: '1px solid var(--kd-border)', borderRadius: 16, padding: '20px 24px' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--kd-text)' }}>📝 작성한 글 ({posts.length})</h2>
        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--kd-text-dim)' }}>아직 작성한 글이 없습니다</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {posts.map((post, i) => {
              const cat = CATEGORY_MAP[post.category] ?? CATEGORY_MAP.free;
              return (
                <Link key={post.id} href={`/feed/${post.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    padding: '12px 0', borderBottom: i < posts.length - 1 ? '1px solid var(--kd-border)' : 'none',
                    display: 'flex', gap: 10, alignItems: 'center', transition: 'opacity 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 999, fontWeight: 700, flexShrink: 0, background: cat.bg, color: cat.color }}>{cat.label}</span>
                    <span style={{ flex: 1, fontSize: 14, color: 'var(--kd-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</span>
                    <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--kd-text-dim)', flexShrink: 0 }}>
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