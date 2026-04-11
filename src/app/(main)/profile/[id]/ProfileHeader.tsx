'use client';
import ProfileCompletionBar from '@/components/ProfileCompletionBar';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import { REGIONS, GRADE_EMOJI, SITE_URL } from '@/lib/constants';
import { SIGUNGU_MAP } from '@/lib/regions';
import { validateNickname } from '@/lib/nickname-filter';

interface Profile {
  id: string; nickname: string | null; bio: string | null; avatar_url: string | null;
  grade: number | null; grade_title: string | null; points: number | null;
  posts_count: number | null; likes_count: number | null; is_premium: boolean | null;
  created_at: string; provider: string | null; interests: string[] | null; region_text: string | null;
  residence_city: string | null; residence_district: string | null; age_group: string | null;
}

const AGE_GROUPS = [
  { value: '10s', label: '10대' }, { value: '20s', label: '20대' },
  { value: '30s', label: '30대' }, { value: '40s', label: '40대' },
  { value: '50s', label: '50대' }, { value: '60+', label: '60대 이상' },
];

interface Props {
  profile: Profile;
  isOwner: boolean;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  gradeColor: string;
  gradeEmoji: string;
  gradeTitle: string;
  gradeNum: number;
}

export default function ProfileHeader({ profile, isOwner, followersCount, followingCount, isFollowing: initFollowing, gradeColor, gradeEmoji, gradeTitle, gradeNum }: Props) {
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(profile.nickname ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [following, setFollowing] = useState(initFollowing);
  const [followers, setFollowers] = useState(followersCount);
  const [followLoading, setFollowLoading] = useState(false);
  const [regionText, setRegionText] = useState(profile.region_text ?? '');
  const [residenceCity, setResidenceCity] = useState(profile.residence_city ?? '');
  const [residenceDistrict, setResidenceDistrict] = useState(profile.residence_district ?? '');
  const [ageGroup, setAgeGroup] = useState(profile.age_group ?? '');
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isOwner && searchParams.get('edit') === '1') setEditing(true);
  }, [isOwner, searchParams]);
  const { success, error } = useToast();
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const displayName = profile.nickname ?? '익명';
  const joinDate = new Date(profile.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { error('JPG, PNG, WebP 형식만 가능합니다'); return; }
    if (file.size > 2*1024*1024) { error('2MB 이하 이미지만 가능합니다'); return; }
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
      const { error: updateErr } = await sb.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', user.id);
      if (updateErr) throw updateErr;
      setAvatarUrl(urlData.publicUrl);
      success('프로필 사진이 변경되었습니다');
      fetch('/api/profile/avatar-point', { method: 'POST' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.granted) success('📸 프로필 사진 등록 보너스 +30P!'); })
        .catch(() => {});
      router.refresh();
    } catch { error('업로드 중 오류가 발생했습니다'); }
    finally { setAvatarUploading(false); if (avatarInputRef.current) avatarInputRef.current.value = ''; }
  };

  const handleSave = async () => {
    const nickValidation = validateNickname(nickname);
    if (!nickValidation.valid) { error(nickValidation.error!); return; }
    setSaving(true);
    try {
      const sb = createSupabaseBrowser();
      const hasBio = bio.trim().length > 0;
      const { error: err } = await sb.from('profiles').update({
        nickname: nickname.trim(), bio: bio.trim(),
        region_text: regionText || null,
        residence_city: residenceCity || null,
        residence_district: residenceDistrict || null,
        age_group: ageGroup || null,
        profile_completed: hasBio,
        updated_at: new Date().toISOString(),
      }).eq('id', profile.id);
      if (err) throw err;
      // 프로필 첫 완성 보너스
      if (hasBio && !(profile as any).profile_completed) {
        fetch('/api/profile/complete-bonus', { method: 'POST' }).then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.granted) success('🎉 프로필 완성 보너스 +50P!'); }).catch(() => {});
      }
      success('프로필이 수정되었습니다'); setEditing(false); router.refresh();
    } catch { error('프로필 수정 중 오류가 발생했습니다'); }
    finally { setSaving(false); }
  };

  const handleFollow = async () => {
    setFollowLoading(true);
    try {
      const res = await fetch('/api/follow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetId: profile.id }) });
      if (!res.ok) { error('로그인이 필요합니다'); return; }
      const data = await res.json();
      setFollowing(data.following);
      setFollowers(f => data.following ? f + 1 : f - 1);
      success(data.following ? `${displayName}님을 팔로우했습니다` : '팔로우를 취소했습니다');
    } catch { error('오류가 발생했습니다'); }
    finally { setFollowLoading(false); }
  };

  return (
    <div style={{ display: 'flex', gap: 'var(--sp-lg)', alignItems: 'flex-start' }}>
      {/* 아바타 */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {avatarUrl ? (
          <Image src={avatarUrl} alt={`${displayName} 프로필 사진`} width={80} height={80} style={{ borderRadius: '50%', objectFit: 'cover', width: 80, height: 80, border: '2px solid var(--border)' }} unoptimized={avatarUrl.startsWith('http://')} />
        ) : (
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-2xl)' }}>
            {GRADE_EMOJI[profile.grade ?? 1] ?? '🌱'}
          </div>
        )}
        {isOwner && (
          <>
            <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} style={{ display: 'none' }} id="avatar-upload" aria-label="프로필 사진 변경" />
            <label htmlFor="avatar-upload" title="프로필 사진 변경" style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: '50%', background: 'var(--brand)', color: 'var(--text-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-sm)', cursor: avatarUploading ? 'not-allowed' : 'pointer', border: '2px solid var(--bg-surface)', opacity: avatarUploading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
              {avatarUploading ? '⏳' : '📷'}
            </label>
          </>
        )}
      </div>

      {/* 닉네임/소개 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--sp-xs)', padding: '0 4px' }}>닉네임</label>
              <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="닉네임" maxLength={20} className="kd-input" style={{ width: '100%', boxSizing: 'border-box', fontSize: 'var(--fs-md)', padding: '10px 16px' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--sp-xs)', padding: '0 4px' }}>자기소개</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="자기소개를 입력해주세요" maxLength={200} rows={3}
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '10px 16px', fontSize: 'var(--fs-sm)', resize: 'vertical', lineHeight: 1.5 }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--brand)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')} />
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textAlign: 'right', marginTop: 'var(--sp-xs)', padding: '0 4px' }}>{bio.length}/200</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--sp-xs)', padding: '0 4px' }}>📍 지역</label>
              <select value={regionText} onChange={e => {
                const v = e.target.value;
                setRegionText(v);
                setResidenceCity(v);
                setResidenceDistrict('');
              }}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 16px', fontSize: 'var(--fs-sm)', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <option value="">미설정</option>
                {REGIONS.filter(r => r.value !== 'all').map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            {residenceCity && (SIGUNGU_MAP[residenceCity] || []).length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--sp-xs)', padding: '0 4px' }}>📍 시/군/구</label>
                <select value={residenceDistrict} onChange={e => setResidenceDistrict(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 16px', fontSize: 'var(--fs-sm)', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <option value="">시/군/구 선택</option>
                  {(SIGUNGU_MAP[residenceCity] || []).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--sp-xs)', padding: '0 4px' }}>🎂 연령대</label>
              <select value={ageGroup} onChange={e => setAgeGroup(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 16px', fontSize: 'var(--fs-sm)', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <option value="">미설정</option>
                {AGE_GROUPS.map(a => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-sm)', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditing(false)} className="kd-btn kd-btn-ghost" style={{ fontSize: 'var(--fs-sm)' }}>취소</button>
              <button onClick={handleSave} disabled={saving} className="kd-btn kd-btn-primary" style={{ fontSize: 'var(--fs-sm)' }}>{saving ? '저장 중...' : '저장'}</button>
            </div>
          </div>
        ) : (
          <>
            {/* 닉네임 */}
            <h1 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{displayName}</h1>
            {/* 등급 + 버튼 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 700, background: `${gradeColor}20`, color: gradeColor, whiteSpace: 'nowrap' }}>
                {gradeEmoji} {gradeTitle} Lv.{gradeNum}
              </span>
              {profile.is_premium && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, background: 'var(--warning-bg)', color: 'var(--warning)', fontWeight: 700, whiteSpace: 'nowrap' }}>👑 PREMIUM</span>}
              <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                {isOwner ? (
                  <button onClick={() => setEditing(true)} className="kd-btn kd-btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}>✏️ 수정</button>
                ) : (
                  <button onClick={handleFollow} disabled={followLoading} aria-pressed={following}
                    className={following ? 'kd-btn kd-btn-ghost' : 'kd-btn kd-btn-primary'}
                    style={{ fontSize: 12, padding: '4px 12px' }}>
                    {followLoading ? '...' : following ? '✓ 팔로잉' : '+ 팔로우'}
                  </button>
                )}
                <button onClick={async () => {
                  const url = `${SITE_URL}/profile/${profile.id}`;
                  if (navigator.share) {
                    try { await navigator.share({ title: `${profile.nickname} — 카더라`, url }); return; } catch {}
                  }
                  navigator.clipboard.writeText(url).then(() => success('프로필 링크가 복사됐어요!'));
                }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  공유
                </button>
              </div>
            </div>
            <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {profile.bio || (isOwner ? '자기소개를 작성해보세요' : '자기소개가 없습니다')}
            </p>
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-tertiary)', flexWrap: 'wrap', marginBottom: 10 }}>
              <span>{joinDate} 가입</span>
              {profile.region_text && <span>📍 {profile.region_text}{profile.residence_district ? ` ${profile.residence_district}` : ''}</span>}
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{followers}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>팔로워</span>
              </div>
              <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{followingCount}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>팔로잉</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
