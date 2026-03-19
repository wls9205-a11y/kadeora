'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import PullToRefresh from '@/components/PullToRefresh';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import { CATEGORY_MAP, REGIONS } from '@/lib/constants';
import { validateNickname } from '@/lib/nickname-filter';


const GRADE_COLORS: Record<number, string> = {
  1:'#4CAF50',2:'#2196F3',3:'#9C27B0',4:'#FF9800',5:'#F44336',
  6:'#E91E63',7:'#00BCD4',8:'#FFD700',9:'#FF6B35',10:'#7B2FBE',
};
const GRADE_EMOJIS: Record<number, string> = {
  1:'🌱',2:'🌿',3:'🍀',4:'🌸',5:'🌻',6:'⭐',7:'🔥',8:'💎',9:'👑',10:'🚀',
};
const GRADE_TITLES: Record<number, string> = {
  1:'새싹',2:'정보통',3:'동네어른',4:'소문난집',5:'인플루언서',
  6:'빅마우스',7:'찐고수',8:'전설',9:'신의경지',10:'카더라신',
};
const NEXT_GRADE_POINTS: Record<number, number> = {
  1:100,2:300,3:700,4:1500,5:3000,6:6000,7:12000,8:25000,9:50000,10:99999,
};
const GRADE_BENEFITS: Record<number, string> = {
  1: '기본 기능 이용',
  2: '댓글 무제한',
  3: '토론방 자유 입장',
  4: '게시글 이미지 첨부',
  5: '검색 고급 필터',
  6: '주간 인기 노출',
  7: 'HOT 배지 우선 노출',
  8: '프로필 특별 테두리',
  9: '모든 기능 무제한',
  10: '명예의 전당 등록',
};

interface Profile {
  id: string; nickname: string | null; bio: string | null; avatar_url: string | null;
  grade: number | null; grade_title: string | null; points: number | null;
  posts_count: number | null; likes_count: number | null; is_premium: boolean | null;
  created_at: string; provider: string | null; interests: string[] | null; region_text: string | null;
}
interface PostRow {
  id: number; title: string; category: string; created_at: string;
  view_count: number; likes_count: number; comments_count: number;
}
interface Props {
  profile: Profile; posts: PostRow[]; isOwner: boolean;
  commentCount: number; followersCount: number; followingCount: number; isFollowing: boolean;
}

export default function ProfileClient({ profile, posts, isOwner, commentCount, followersCount, followingCount, isFollowing: initFollowing }: Props) {
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(profile.nickname ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [following, setFollowing] = useState(initFollowing);
  const [followers, setFollowers] = useState(followersCount);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts'|'bookmarks'>('posts');
  const [bookmarkedPosts, setBookmarkedPosts] = useState<PostRow[]>([]);
  const [bookmarksLoaded, setBookmarksLoaded] = useState(false);
  const [activityTab, setActivityTab] = useState<'posts'|'comments'|null>(null);
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [myComments, setMyComments] = useState<any[]>([]);
  const [postsPage, setPostsPage] = useState(1);
  const [commentsPage, setCommentsPage] = useState(1);
  const [regionText, setRegionText] = useState(profile.region_text ?? '');
  const [inviteCode, setInviteCode] = useState('');
  const [attendance, setAttendance] = useState<{ streak: number; total_days: number; already_today: boolean } | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const { success, error } = useToast();
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const gradeNum = profile.grade ?? 1;
  const gradeColor = GRADE_COLORS[gradeNum] ?? '#4CAF50';
  const gradeEmoji = GRADE_EMOJIS[gradeNum] ?? '🌱';
  const gradeTitle = GRADE_TITLES[gradeNum] ?? '새싹';
  const currentPoints = profile.points ?? 0;
  const nextPoints = NEXT_GRADE_POINTS[gradeNum] ?? 99999;
  const prevPoints = gradeNum > 1 ? NEXT_GRADE_POINTS[gradeNum - 1] ?? 0 : 0;
  const progress = gradeNum >= 10 ? 100 : Math.min(100, Math.round(((currentPoints - prevPoints) / (nextPoints - prevPoints)) * 100));
  const totalActivity = (profile.posts_count ?? 0) + commentCount + (profile.likes_count ?? 0);
  const joinDate = new Date(profile.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
  const displayName = profile.nickname ?? '익명';

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
      // Award avatar upload bonus points
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
      const { error: err } = await sb.from('profiles').update({ nickname: nickname.trim(), bio: bio.trim(), region_text: regionText || null, updated_at: new Date().toISOString() }).eq('id', profile.id);
      if (err) throw err;
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

  const loadBookmarks = async () => {
    if (bookmarksLoaded) return;
    try {
      const sb = createSupabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user || user.id !== profile.id) return;
      const { data: bm } = await sb.from('bookmarks').select('post_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
      if (!bm || bm.length === 0) { setBookmarksLoaded(true); return; }
      const ids = bm.map(b => b.post_id);
      const { data: bmPosts } = await sb.from('posts').select('id,title,category,created_at,view_count,likes_count,comments_count').in('id', ids).eq('is_deleted', false);
      setBookmarkedPosts(bmPosts ?? []);
    } catch {} finally { setBookmarksLoaded(true); }
  };

  const handleTabChange = (tab: 'posts'|'bookmarks') => {
    setActiveTab(tab);
    if (tab === 'bookmarks') loadBookmarks();
  };

  const [postsLoaded, setPostsLoaded] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);

  const loadMyPosts = async () => {
    if (postsLoaded) return;
    const sb = createSupabaseBrowser();
    const { data } = await sb.from('posts').select('id,title,created_at,likes_count,comments_count')
      .eq('author_id', profile.id).eq('is_deleted', false)
      .order('created_at', { ascending: false }).limit(20);
    setMyPosts(data ?? []);
    setPostsLoaded(true);
  };

  useEffect(() => {
    if (!isOwner) return;
    fetch('/api/invite').then(r => r.ok ? r.json() : null).then(d => { if (d?.code) setInviteCode(d.code); }).catch(() => {});
    fetch('/api/attendance').then(r => r.ok ? r.json() : null).then(d => { if (d) setAttendance(d); }).catch(() => {});
  }, [isOwner]);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const res = await fetch('/api/attendance', { method: 'POST' });
      if (res.ok) {
        const d = await res.json();
        if (d.already) { success('이미 오늘 출석했어요!'); }
        else {
          setAttendance({ streak: d.streak, total_days: d.total_days, already_today: true });
          success(d.bonus ? `출석 완료! +${d.points_earned}P (${d.bonus})` : '출석 체크 완료! +10P');
        }
      }
    } catch { error('출석 체크 실패'); }
    finally { setCheckingIn(false); }
  };

  const loadMyComments = async () => {
    if (commentsLoaded) return;
    const sb = createSupabaseBrowser();
    const { data } = await sb.from('comments').select('id,content,created_at,post_id')
      .eq('author_id', profile.id).eq('is_deleted', false)
      .order('created_at', { ascending: false }).limit(20);
    setMyComments(data ?? []);
    setCommentsLoaded(true);
  };

  return (
    <PullToRefresh>
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* 프로필 카드 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 28px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* 아바타 */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {avatarUrl ? (
              <Image src={`${avatarUrl}?width=80&height=80`} alt={`${displayName} 프로필 사진`} width={72} height={72} style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
                {GRADE_EMOJIS[profile.grade ?? 1] ?? '🌱'}
              </div>
            )}
            {isOwner && (
              <>
                <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} style={{ display: 'none' }} id="avatar-upload" aria-label="프로필 사진 변경" />
                <label htmlFor="avatar-upload" title="프로필 사진 변경" style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: '50%', background: 'var(--brand)', color: 'var(--text-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, cursor: avatarUploading ? 'not-allowed' : 'pointer', border: '2px solid var(--bg-surface)', opacity: avatarUploading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                  {avatarUploading ? '⏳' : '📷'}
                </label>
              </>
            )}
          </div>

          {/* 닉네임/소개 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, padding: '0 4px' }}>닉네임</label>
                  <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="닉네임" maxLength={20} className="kd-input" style={{ width: '100%', boxSizing: 'border-box', fontSize: 15, padding: '10px 16px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, padding: '0 4px' }}>자기소개</label>
                  <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="자기소개를 입력해주세요" maxLength={200} rows={3}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '10px 16px', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--brand)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')} />
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right', marginTop: 4, padding: '0 4px' }}>{bio.length}/200</div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, padding: '0 4px' }}>📍 지역</label>
                  <select value={regionText} onChange={e => setRegionText(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 16px', fontSize: 13, background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <option value="">미설정</option>
                    {REGIONS.filter(r => r.value !== 'all').map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{displayName}</h1>
                  <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, fontWeight: 700, background: `${gradeColor}20`, color: gradeColor }}>
                    {gradeEmoji} {gradeTitle} Lv.{gradeNum}
                  </span>
                  {profile.is_premium && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--warning-bg)', color: 'var(--warning)', fontWeight: 700 }}>👑 PREMIUM</span>}
                </div>
                <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {profile.bio || (isOwner ? '자기소개를 작성해보세요' : '자기소개가 없습니다')}
                </p>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
                  <span>{joinDate} 가입</span>
                  {profile.region_text && <span>📍 {profile.region_text}</span>}
                  <span>팔로워 <strong style={{ color: 'var(--text-primary)' }}>{followers}</strong></span>
                  <span>팔로잉 <strong style={{ color: 'var(--text-primary)' }}>{followingCount}</strong></span>
                </div>
              </>
            )}
          </div>

          {/* 버튼 영역 */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {isOwner ? (
              editing ? (
                <>
                  <button onClick={() => setEditing(false)} className="kd-btn kd-btn-ghost" style={{ fontSize: 13 }}>취소</button>
                  <button onClick={handleSave} disabled={saving} className="kd-btn kd-btn-primary" style={{ fontSize: 13 }}>{saving ? '저장 중...' : '저장'}</button>
                </>
              ) : (
                <button onClick={() => setEditing(true)} className="kd-btn kd-btn-ghost" style={{ fontSize: 13 }}>✏️ 프로필 수정</button>
              )
            ) : (
              <button onClick={handleFollow} disabled={followLoading} aria-pressed={following}
                className={following ? 'kd-btn kd-btn-ghost' : 'kd-btn kd-btn-primary'}
                style={{ fontSize: 13, minWidth: 90 }}>
                {followLoading ? '...' : following ? '✓ 팔로잉' : '+ 팔로우'}
              </button>
            )}
          </div>
        </div>

        {/* 등급 진행 바 */}
        <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--bg-base)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: gradeColor }}>{gradeEmoji} {gradeTitle}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {(currentPoints ?? 0).toLocaleString()} / {gradeNum < 10 ? (nextPoints ?? 0).toLocaleString() : '∞'} pts
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
            <div style={{ height: '100%', borderRadius: 3, background: gradeColor, width: `${progress}%`, transition: 'width 0.6s ease' }} />
          </div>
          {gradeNum < 10 && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, textAlign: 'right' }}>
              다음 등급까지 {((nextPoints ?? 0) - (currentPoints ?? 0)).toLocaleString()}pts
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
            현재 혜택: {GRADE_BENEFITS[gradeNum] || '기본 기능 이용'}
            {gradeNum < 10 && (
              <span style={{ marginLeft: 8, color: 'var(--text-secondary)' }}>
                · 다음: {GRADE_BENEFITS[(gradeNum + 1) as number] || ''}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: 0, marginTop: 16, background: 'var(--bg-base)', borderRadius: 12, border: '1px solid var(--border)', padding: '12px 0' }}>
          {(() => {
            const stats = [
              { label: '게시글', value: profile.posts_count ?? 0, icon: '📝' },
              { label: '댓글', value: commentCount, icon: '💬' },
              { label: '받은 좋아요', value: profile.likes_count ?? 0, icon: '❤️' },
              { label: '총 활동', value: totalActivity, icon: '⚡' },
              { label: '포인트', value: profile.points ?? 0, icon: '💰' },
            ];
            return stats.map((stat, i) => (
              <div key={stat.label} style={{ display: 'contents' }}>
                {i > 0 && <div style={{ height: 24, width: 1, background: 'var(--border)' }} />}
                <div style={{ minWidth: 60, textAlign: 'center', padding: '0 16px' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{(stat.value ?? 0).toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{stat.label}</div>
                </div>
              </div>
            ));
          })()}
        </div>

        {/* 출석 체크 (본인만) */}
        {isOwner && attendance && (
          <div style={{ marginTop:16, background:'var(--bg-base)', border:'1px solid var(--border)', borderRadius:12, padding:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>📅 출석 체크</div>
                <div style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:2 }}>
                  🔥 {attendance.streak}일 연속 · 총 {attendance.total_days}일 출석
                </div>
              </div>
              {attendance.already_today ? (
                <span style={{ padding:'8px 16px', borderRadius:20, background:'var(--bg-hover)', color:'var(--text-tertiary)', fontSize:13, fontWeight:600 }}>
                  ✅ 출석 완료
                </span>
              ) : (
                <button onClick={handleCheckIn} disabled={checkingIn}
                  style={{ padding:'8px 16px', borderRadius:20, border:'none', background:'var(--brand)', color:'var(--text-inverse)', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  {checkingIn ? '...' : '📅 출석 +10P'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* 친구 초대 (본인만) */}
        {isOwner && inviteCode && (
          <div style={{ marginTop:16, background:'var(--bg-base)', border:'1px solid var(--border)', borderRadius:12, padding:16 }}>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>👥 친구 초대</div>
            <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:12 }}>친구가 이 코드로 가입하면 둘 다 +50 포인트!</div>
            <div style={{ background:'var(--bg-hover)', borderRadius:8, padding:12, fontSize:22, fontWeight:800, letterSpacing:4, color:'var(--brand)', textAlign:'center', marginBottom:12 }}>
              {inviteCode}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => { navigator.clipboard.writeText(`https://kadeora.app/login?invite=${inviteCode}`); success('초대 링크가 복사됐어요!'); }}
                style={{ flex:1, padding:'10px 0', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-hover)', color:'var(--text-primary)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                🔗 링크복사
              </button>
              <button onClick={() => {
                if (typeof window !== 'undefined' && window.Kakao?.isInitialized?.()) {
                  window.Kakao.Share.sendDefault({
                    objectType: 'feed',
                    content: { title: '카더라에서 동네/주식/부동산 소식 같이 봐요! 🏘', description: `초대코드: ${inviteCode}`, imageUrl: 'https://kadeora.app/og-image.png', link: { mobileWebUrl: `https://kadeora.app/login?invite=${inviteCode}`, webUrl: `https://kadeora.app/login?invite=${inviteCode}` } },
                    buttons: [{ title: '카더라 가입하기', link: { mobileWebUrl: `https://kadeora.app/login?invite=${inviteCode}`, webUrl: `https://kadeora.app/login?invite=${inviteCode}` } }],
                  });
                } else { navigator.clipboard.writeText(`https://kadeora.app/login?invite=${inviteCode}`); success('초대 링크가 복사됐어요!'); }
              }}
                style={{ flex:1, padding:'10px 0', borderRadius:8, border:'none', background:'#FEE500', color:'#000', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                💬 카카오톡 공유
              </button>
            </div>
          </div>
        )}

        {/* 활동 내역 탭 (본인만) */}
        {isOwner && (
          <>
            <div style={{ display:'flex', gap:4, marginTop:16, borderBottom:'1px solid var(--border)', paddingBottom:0 }}>
              {(['posts', 'comments'] as const).map(tab => (
                <button key={tab} onClick={() => { const next = activityTab === tab ? null : tab; setActivityTab(next); if (tab === 'posts') { setPostsPage(1); loadMyPosts(); } else { setCommentsPage(1); loadMyComments(); } }}
                  style={{
                    padding:'10px 16px', border:'none', cursor:'pointer', fontSize:14, fontWeight:600,
                    background:'transparent', borderBottom: activityTab === tab ? '2px solid var(--brand)' : '2px solid transparent',
                    color: activityTab === tab ? 'var(--brand)' : 'var(--text-secondary)',
                  }}>
                  {tab === 'posts' ? '내 게시글' : '내 댓글'}
                  <span style={{ background:'var(--bg-hover)', color:'var(--text-tertiary)', fontSize:11, borderRadius:10, padding:'1px 6px', marginLeft:4 }}>
                    {tab === 'posts' ? (profile.posts_count ?? 0) : commentCount}
                  </span>
                </button>
              ))}
            </div>
            {activityTab === 'posts' && (() => {
              const perPage = 5;
              const totalPages = Math.max(1, Math.ceil(myPosts.length / perPage));
              const paged = myPosts.slice((postsPage - 1) * perPage, postsPage * perPage);
              return (
                <div style={{ marginTop:12 }}>
                  {paged.map(p => (
                    <a key={p.id} href={`/feed/${p.id}`} style={{ display:'block', padding:'12px 0', borderBottom:'1px solid var(--border)', textDecoration:'none' }}>
                      <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>{p.title}</div>
                      <div style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:4 }}>❤️ {p.likes_count ?? 0} · 💬 {p.comments_count ?? 0}</div>
                    </a>
                  ))}
                  {myPosts.length === 0 && <p style={{ color:'var(--text-tertiary)', padding:20, textAlign:'center' }}>✏️ 첫 글을 작성해보세요</p>}
                  {myPosts.length > perPage && (
                    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:8, marginTop:12 }}>
                      <button onClick={() => setPostsPage(p => Math.max(1, p - 1))} disabled={postsPage <= 1}
                        style={{ padding:'6px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-hover)', color:'var(--text-secondary)', fontSize:12, cursor: postsPage <= 1 ? 'default' : 'pointer', opacity: postsPage <= 1 ? 0.4 : 1 }}>이전</button>
                      <span style={{ fontSize:12, color:'var(--text-tertiary)' }}>{postsPage} / {totalPages}</span>
                      <button onClick={() => setPostsPage(p => Math.min(totalPages, p + 1))} disabled={postsPage >= totalPages}
                        style={{ padding:'6px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-hover)', color:'var(--text-secondary)', fontSize:12, cursor: postsPage >= totalPages ? 'default' : 'pointer', opacity: postsPage >= totalPages ? 0.4 : 1 }}>다음</button>
                    </div>
                  )}
                </div>
              );
            })()}
            {activityTab === 'comments' && (() => {
              const perPage = 5;
              const totalPages = Math.max(1, Math.ceil(myComments.length / perPage));
              const paged = myComments.slice((commentsPage - 1) * perPage, commentsPage * perPage);
              return (
                <div style={{ marginTop:12 }}>
                  {paged.map(c => (
                    <a key={c.id} href={`/feed/${c.post_id}`} style={{ display:'block', padding:'12px 0', borderBottom:'1px solid var(--border)', textDecoration:'none' }}>
                      <div style={{ fontSize:14, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.content}</div>
                      <div style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:4 }}>{new Date(c.created_at).toLocaleDateString('ko-KR')}</div>
                    </a>
                  ))}
                  {myComments.length === 0 && <p style={{ color:'var(--text-tertiary)', padding:20, textAlign:'center' }}>💬 첫 댓글을 남겨보세요</p>}
                  {myComments.length > perPage && (
                    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:8, marginTop:12 }}>
                      <button onClick={() => setCommentsPage(p => Math.max(1, p - 1))} disabled={commentsPage <= 1}
                        style={{ padding:'6px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-hover)', color:'var(--text-secondary)', fontSize:12, cursor: commentsPage <= 1 ? 'default' : 'pointer', opacity: commentsPage <= 1 ? 0.4 : 1 }}>이전</button>
                      <span style={{ fontSize:12, color:'var(--text-tertiary)' }}>{commentsPage} / {totalPages}</span>
                      <button onClick={() => setCommentsPage(p => Math.min(totalPages, p + 1))} disabled={commentsPage >= totalPages}
                        style={{ padding:'6px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-hover)', color:'var(--text-secondary)', fontSize:12, cursor: commentsPage >= totalPages ? 'default' : 'pointer', opacity: commentsPage >= totalPages ? 0.4 : 1 }}>다음</button>
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* 탭 — 게시글 / 북마크(본인만) */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 12, background: 'var(--bg-surface)', borderRadius: 12, padding: 4, border: '1px solid var(--border)' }}>
        {(['posts', ...(isOwner ? ['bookmarks'] : [])] as const).map(tab => (
          <button key={tab} onClick={() => handleTabChange(tab)} style={{
            flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: activeTab === tab ? 'var(--brand)' : 'transparent',
            color: activeTab === tab ? 'var(--text-inverse)' : 'var(--text-secondary)',
            fontWeight: 600, fontSize: 13, transition: 'all 0.15s',
          }}>
            {tab === 'posts' ? `📝 작성한 글 (${posts.length})` : `🔖 북마크`}
          </button>
        ))}
      </div>

      {/* 게시글 목록 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px' }}>
        {activeTab === 'posts' && (
          posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)' }}>✏️ 첫 글을 작성해보세요</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {posts.map((post, i) => {
                const cat = CATEGORY_MAP[post.category] ?? CATEGORY_MAP.free;
                return (
                  <Link key={post.id} href={`/feed/${post.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ padding: '12px 0', borderBottom: i < posts.length-1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 10, alignItems: 'center', transition: 'opacity 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                      <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 999, fontWeight: 700, flexShrink: 0, background: cat.bg, color: cat.color }}>{cat.label}</span>
                      <span style={{ flex: 1, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</span>
                      <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                        <span>❤️{post.likes_count}</span><span>💬{post.comments_count}</span>
                        <span>{new Date(post.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )
        )}

        {activeTab === 'bookmarks' && (
          !bookmarksLoaded ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>
              <div style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--brand)', borderRadius: '50%', margin: '0 auto 8px' }} className="animate-spin" />
            </div>
          ) : bookmarkedPosts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)' }}>🔖 저장한 글이 없어요</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {bookmarkedPosts.map((post, i) => {
                const cat = CATEGORY_MAP[post.category] ?? CATEGORY_MAP.free;
                return (
                  <Link key={post.id} href={`/feed/${post.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ padding: '12px 0', borderBottom: i < bookmarkedPosts.length-1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 10, alignItems: 'center', transition: 'opacity 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                      <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 999, fontWeight: 700, flexShrink: 0, background: cat.bg, color: cat.color }}>{cat.label}</span>
                      <span style={{ flex: 1, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</span>
                      <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                        <span>❤️{post.likes_count}</span><span>💬{post.comments_count}</span>
                        <span>{new Date(post.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )
        )}
      </div>

    </div>
    </PullToRefresh>
  );
}