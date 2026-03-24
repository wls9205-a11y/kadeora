'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef } from 'react';
import PullToRefresh from '@/components/PullToRefresh';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import { CATEGORY_MAP, REGIONS, GRADE_EMOJI, SITE_URL } from '@/lib/constants';
import { validateNickname } from '@/lib/nickname-filter';
import InviteSection from './InviteSection';


const GRADE_COLORS: Record<number, string> = {
  1:'var(--accent-green)',2:'var(--accent-blue)',3:'var(--accent-purple)',4:'var(--accent-yellow)',5:'var(--accent-red)',
  6:'#FB7185',7:'#22D3EE',8:'var(--accent-yellow)',9:'var(--accent-purple)',10:'#C084FC',
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
  const searchParams = useSearchParams();
  const paramTab = searchParams.get('tab');
  const initialTab = paramTab === 'bookmarks' ? 'bookmarks' : paramTab === 'comments' ? 'comments' : paramTab === 'stocks' ? 'stocks' : paramTab === 'apts' ? 'apts' : 'posts';
  const [activeTab, setActiveTab] = useState<'posts'|'bookmarks'|'comments'|'stocks'|'apts'>(initialTab);
  const [bookmarkedPosts, setBookmarkedPosts] = useState<PostRow[]>([]);
  const [bookmarksLoaded, setBookmarksLoaded] = useState(false);
  const [watchStocks, setWatchStocks] = useState<any[]>([]);
  const [watchStocksLoaded, setWatchStocksLoaded] = useState(false);
  const [watchApts, setWatchApts] = useState<any[]>([]);
  const [watchAptsLoaded, setWatchAptsLoaded] = useState(false);
  const [displayedPosts, setDisplayedPosts] = useState<PostRow[]>(posts);
  const [postsOffset, setPostsOffset] = useState(posts.length);
  const [hasMorePosts, setHasMorePosts] = useState(posts.length >= 20);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [_activityTab, _setActivityTab] = useState<'posts'|'comments'|null>(null);
  const [_myPosts, setMyPosts] = useState<any[]>([]);
  const [myComments, setMyComments] = useState<any[]>([]);
  const [_postsPage, _setPostsPage] = useState(1);
  const [_commentsPage, _setCommentsPage] = useState(1);
  const [regionText, setRegionText] = useState(profile.region_text ?? '');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteCount, setInviteCount] = useState(0);
  const [attendance, setAttendance] = useState<{ streak: number; total_days: number; already_today: boolean } | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const { success, error } = useToast();
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const gradeNum = profile.grade ?? 1;
  const gradeColor = GRADE_COLORS[gradeNum] ?? 'var(--accent-green)';
  const gradeEmoji = GRADE_EMOJI[gradeNum] ?? '🌱';
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

  const loadMorePosts = async () => {
    setLoadingMorePosts(true);
    try {
      const sb = createSupabaseBrowser();
      const { data } = await sb.from('posts')
        .select('id,title,category,created_at,view_count,likes_count,comments_count')
        .eq('author_id', profile.id).eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .range(postsOffset, postsOffset + 19);
      if (data && data.length > 0) {
        setDisplayedPosts(prev => [...prev, ...data]);
        setPostsOffset(prev => prev + data.length);
        if (data.length < 20) setHasMorePosts(false);
      } else {
        setHasMorePosts(false);
      }
    } catch {} finally { setLoadingMorePosts(false); }
  };

  const handleTabChange = (tab: 'posts'|'bookmarks'|'comments'|'stocks'|'apts') => {
    setActiveTab(tab);
    if (tab === 'bookmarks') loadBookmarks();
    if (tab === 'comments') loadMyComments();
    if (tab === 'stocks') loadWatchStocks();
    if (tab === 'apts') loadWatchApts();
  };

  const loadWatchStocks = async () => {
    if (watchStocksLoaded) return;
    const sb = createSupabaseBrowser();
    const { data: wl } = await sb.from('stock_watchlist').select('symbol').eq('user_id', profile.id);
    if (wl && wl.length > 0) {
      const symbols = wl.map((w: any) => w.symbol);
      const { data: stocks } = await sb.from('stock_quotes').select('symbol, name, market, price, change_pct, currency').in('symbol', symbols);
      setWatchStocks(stocks ?? []);
    }
    setWatchStocksLoaded(true);
  };

  const loadWatchApts = async () => {
    if (watchAptsLoaded) return;
    const sb = createSupabaseBrowser();
    const { data: bm } = await sb.from('apt_bookmarks').select('apt_id').eq('user_id', profile.id);
    if (bm && bm.length > 0) {
      const ids = bm.map((b: any) => b.apt_id);
      const { data: apts } = await sb.from('apt_subscriptions').select('id, house_nm, region_nm, rcept_bgnde, rcept_endde, tot_supply_hshld_co').in('id', ids);
      setWatchApts(apts ?? []);
    }
    setWatchAptsLoaded(true);
  };

  // Auto-load bookmarks/comments if initial tab matches
  useEffect(() => {
    if (initialTab === 'bookmarks') loadBookmarks();
    if (initialTab === 'comments') loadMyComments();
    if (initialTab === 'stocks') loadWatchStocks();
    if (initialTab === 'apts') loadWatchApts();
  }, []);

  const [postsLoaded, setPostsLoaded] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);

  const _loadMyPosts = async () => {
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
    // Load invite count
    const sb = createSupabaseBrowser();
    sb.from('invite_codes').select('id', { count: 'exact', head: true }).eq('creator_id', profile.id).eq('is_used', true).then(({ count }) => setInviteCount(count ?? 0));
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
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      {/* 프로필 카드 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 'clamp(16px, 4vw, 28px) clamp(16px, 4vw, 28px) clamp(14px, 3vw, 24px)', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

          {/* 아바타 */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {avatarUrl ? (
              <Image src={`${avatarUrl}?width=80&height=80`} alt={`${displayName} 프로필 사진`} width={72} height={72} style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, padding: '0 4px' }}>닉네임</label>
                  <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="닉네임" maxLength={20} className="kd-input" style={{ width: '100%', boxSizing: 'border-box', fontSize: 'var(--fs-md)', padding: '10px 16px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, padding: '0 4px' }}>자기소개</label>
                  <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="자기소개를 입력해주세요" maxLength={200} rows={3}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '10px 16px', fontSize: 'var(--fs-sm)', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--brand)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')} />
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textAlign: 'right', marginTop: 4, padding: '0 4px' }}>{bio.length}/200</div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, padding: '0 4px' }}>📍 지역</label>
                  <select value={regionText} onChange={e => setRegionText(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 16px', fontSize: 'var(--fs-sm)', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <option value="">미설정</option>
                    {REGIONS.filter(r => r.value !== 'all').map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditing(false)} className="kd-btn kd-btn-ghost" style={{ fontSize: 'var(--fs-sm)' }}>취소</button>
                  <button onClick={handleSave} disabled={saving} className="kd-btn kd-btn-primary" style={{ fontSize: 'var(--fs-sm)' }}>{saving ? '저장 중...' : '저장'}</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h1 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>{displayName}</h1>
                      <span style={{ fontSize: 'var(--fs-sm)', padding: '2px 8px', borderRadius: 999, fontWeight: 700, background: `${gradeColor}20`, color: gradeColor }}>
                        {gradeEmoji} {gradeTitle} Lv.{gradeNum}
                      </span>
                      {profile.is_premium && <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 999, background: 'var(--warning-bg)', color: 'var(--warning)', fontWeight: 700 }}>👑 PREMIUM</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {isOwner ? (
                      <button onClick={() => setEditing(true)} className="kd-btn kd-btn-ghost" style={{ fontSize: 'var(--fs-sm)', padding: '4px 10px' }}>✏️ 수정</button>
                    ) : (
                      <button onClick={handleFollow} disabled={followLoading} aria-pressed={following}
                        className={following ? 'kd-btn kd-btn-ghost' : 'kd-btn kd-btn-primary'}
                        style={{ fontSize: 'var(--fs-sm)', padding: '4px 12px' }}>
                        {followLoading ? '...' : following ? '✓ 팔로잉' : '+ 팔로우'}
                      </button>
                    )}
                    <button onClick={() => {
                      const url = `${SITE_URL}/profile/${profile.id}`;
                      navigator.clipboard.writeText(url).then(() => success('프로필 링크가 복사됐어요!'));
                    }} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', cursor: 'pointer', fontWeight: 600 }}>
                      공유
                    </button>
                  </div>
                </div>
                <p style={{ margin: '0 0 6px', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {profile.bio || (isOwner ? '자기소개를 작성해보세요' : '자기소개가 없습니다')}
                </p>
                <div style={{ display: 'flex', gap: 12, fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', flexWrap: 'wrap', marginBottom: 10 }}>
                  <span>{joinDate} 가입</span>
                  {profile.region_text && <span>📍 {profile.region_text}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)' }}>{followers}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>팔로워</span>
                  </div>
                  <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)' }}>{followingCount}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>팔로잉</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 등급 진행 바 */}
        <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--bg-base)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: gradeColor }}>{gradeEmoji} {gradeTitle}</span>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
              {(currentPoints ?? 0).toLocaleString()} / {gradeNum < 10 ? (nextPoints ?? 0).toLocaleString() : '∞'} pts
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
            <div style={{ height: '100%', borderRadius: 3, background: gradeColor, width: `${progress}%`, transition: 'width 0.6s ease' }} />
          </div>
          {gradeNum < 10 && (
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 6, textAlign: 'right' }}>
              다음 등급까지 {((nextPoints ?? 0) - (currentPoints ?? 0)).toLocaleString()}pts
            </div>
          )}
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginTop: 8 }}>
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
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)' }}>{(stat.value ?? 0).toLocaleString()}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{stat.label}</div>
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
          <InviteSection inviteCode={inviteCode} inviteCount={inviteCount} onCopy={success} />
        )}

        {/* 활동 내역은 아래 탭 섹션에 통합됨 */}
      </div>

      {/* 탭 — 게시글 / 북마크(본인만) */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 12, background: 'var(--bg-surface)', borderRadius: 12, padding: 4, border: '1px solid var(--border)', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {(['posts', 'comments', ...(isOwner ? ['stocks', 'apts', 'bookmarks'] : [])] as ('posts'|'comments'|'bookmarks'|'stocks'|'apts')[]).map(tab => (
          <button key={tab} onClick={() => handleTabChange(tab)} aria-pressed={activeTab === tab} style={{
            flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: activeTab === tab ? 'var(--brand)' : 'transparent',
            color: activeTab === tab ? 'var(--text-inverse)' : 'var(--text-secondary)',
            fontWeight: 600, fontSize: 'var(--fs-sm)', transition: 'all 0.15s', whiteSpace: 'nowrap', minWidth: 'fit-content',
          }}>
            {tab === 'posts' ? `📝 글` : tab === 'comments' ? `💬 댓글` : tab === 'stocks' ? `⭐ 관심종목` : tab === 'apts' ? `🏠 관심단지` : `🔖 북마크`}
          </button>
        ))}
      </div>

      {/* 게시글 목록 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 'clamp(14px, 3vw, 20px) clamp(14px, 3vw, 24px)' }}>
        {activeTab === 'posts' && (
          displayedPosts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)' }}>✏️ 첫 글을 작성해보세요</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {displayedPosts.map((post, i) => {
                const cat = CATEGORY_MAP[post.category] ?? CATEGORY_MAP.free;
                return (
                  <Link key={post.id} href={`/feed/${post.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ padding: '12px 0', borderBottom: i < displayedPosts.length-1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 10, alignItems: 'center', transition: 'opacity 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                      <span style={{ fontSize: 'var(--fs-xs)', padding: '1px 7px', borderRadius: 999, fontWeight: 700, flexShrink: 0, background: cat.bg, color: cat.color }}>{cat.label}</span>
                      <span style={{ flex: 1, fontSize: 'var(--fs-base)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</span>
                      <div style={{ display: 'flex', gap: 8, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                        <span>❤️{post.likes_count}</span><span>💬{post.comments_count}</span>
                        <span>{new Date(post.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
              {hasMorePosts && (
                <button onClick={loadMorePosts} disabled={loadingMorePosts}
                  style={{ marginTop: 12, padding: '10px 0', width: '100%', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer' }}>
                  {loadingMorePosts ? '불러오는 중...' : '더보기'}
                </button>
              )}
            </div>
          )
        )}

        {activeTab === 'comments' && (
          !commentsLoaded ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>
              <div style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--brand)', borderRadius: '50%', margin: '0 auto 8px' }} className="animate-spin" />
            </div>
          ) : myComments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)' }}>💬 작성한 댓글이 없어요</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {myComments.map((comment, i) => (
                <Link key={comment.id} href={`/feed/${comment.post_id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ padding: '12px 0', borderBottom: i < myComments.length - 1 ? '1px solid var(--border)' : 'none', transition: 'opacity 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                    <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {comment.content}
                    </div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                      게시글 #{comment.post_id} · {new Date(comment.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {/* 관심종목 */}
        {activeTab === 'stocks' && (
          !watchStocksLoaded ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>
              <div style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--brand)', borderRadius: '50%', margin: '0 auto 8px' }} className="animate-spin" />
            </div>
          ) : watchStocks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⭐</div>
              관심종목이 없어요<br/>
              <Link href="/stock" style={{ color: 'var(--brand)', fontSize: 'var(--fs-sm)' }}>주식 페이지에서 ☆를 눌러 추가하세요</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {watchStocks.map((s: any, i: number) => {
                const isUp = (s.change_pct || 0) >= 0;
                const color = s.market === 'KR' ? (isUp ? 'var(--accent-red)' : 'var(--accent-blue)') : (isUp ? 'var(--accent-green)' : 'var(--accent-red)');
                return (
                  <Link key={s.symbol} href={`/stock/${s.symbol}`} style={{ textDecoration: 'none' }}>
                    <div style={{ padding: '12px 0', borderBottom: i < watchStocks.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--fs-base)' }}>{s.name}</div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{s.symbol} · {s.market}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--fs-base)' }}>
                          {s.currency === 'KRW' ? `₩${Number(s.price).toLocaleString()}` : `$${Number(s.price).toLocaleString()}`}
                        </div>
                        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color }}>
                          {isUp ? '+' : ''}{Number(s.change_pct).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )
        )}

        {/* 관심단지 */}
        {activeTab === 'apts' && (
          !watchAptsLoaded ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>
              <div style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--brand)', borderRadius: '50%', margin: '0 auto 8px' }} className="animate-spin" />
            </div>
          ) : watchApts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🏠</div>
              관심단지가 없어요<br/>
              <Link href="/apt" style={{ color: 'var(--brand)', fontSize: 'var(--fs-sm)' }}>부동산 페이지에서 북마크를 눌러 추가하세요</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {watchApts.map((a: any, i: number) => {
                const today = new Date().toISOString().slice(0, 10);
                const isOpen = a.rcept_bgnde && a.rcept_endde && today >= a.rcept_bgnde && today <= a.rcept_endde;
                const isClosed = a.rcept_endde && today > a.rcept_endde;
                return (
                  <Link key={a.id} href={`/apt/${a.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ padding: '12px 0', borderBottom: i < watchApts.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--fs-base)' }}>{a.house_nm}</div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                          {a.region_nm} · {a.tot_supply_hshld_co ? `${Number(a.tot_supply_hshld_co).toLocaleString()}세대` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: isOpen ? 'rgba(52,211,153,0.2)' : isClosed ? 'var(--bg-hover)' : 'rgba(251,191,36,0.15)', color: isOpen ? 'var(--accent-green)' : isClosed ? 'var(--text-tertiary)' : 'var(--accent-yellow)' }}>
                          {isOpen ? '접수중' : isClosed ? '마감' : '접수예정'}
                        </span>
                        {a.rcept_bgnde && (
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>
                            {a.rcept_bgnde} ~ {a.rcept_endde}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )
        )}

        {/* 북마크 */}
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
                      <span style={{ fontSize: 'var(--fs-xs)', padding: '1px 7px', borderRadius: 999, fontWeight: 700, flexShrink: 0, background: cat.bg, color: cat.color }}>{cat.label}</span>
                      <span style={{ flex: 1, fontSize: 'var(--fs-base)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</span>
                      <div style={{ display: 'flex', gap: 8, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>
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