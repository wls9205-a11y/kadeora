'use client';
import PullToRefresh from '@/components/PullToRefresh';
import { GRADE_EMOJI, GRADE_COLORS, GRADE_TITLES } from '@/lib/constants';
import ProfileHeader from './ProfileHeader';
import ProfileGradeCard from './ProfileGradeCard';
import ProfileTabs from './ProfileTabs';

interface Profile {
  id: string; nickname: string | null; bio: string | null; avatar_url: string | null;
  grade: number | null; grade_title: string | null; points: number | null;
  posts_count: number | null; likes_count: number | null; is_premium: boolean | null;
  created_at: string; provider: string | null; interests: string[] | null; region_text: string | null;
  residence_city: string | null; residence_district: string | null;
}
interface PostRow {
  id: number; title: string; category: string; created_at: string;
  view_count: number; likes_count: number; comments_count: number;
}
interface Props {
  profile: Profile; posts: PostRow[]; isOwner: boolean;
  commentCount: number; followersCount: number; followingCount: number; isFollowing: boolean;
}

export default function ProfileClient({ profile, posts, isOwner, commentCount, followersCount, followingCount, isFollowing }: Props) {
  const gradeNum = profile.grade ?? 1;
  const gradeColor = GRADE_COLORS[gradeNum] ?? 'var(--accent-green)';
  const gradeEmoji = GRADE_EMOJI[gradeNum] ?? '🌱';
  const gradeTitle = GRADE_TITLES[gradeNum] ?? '새싹';

  return (
    <PullToRefresh>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
        {/* 프로필 카드 */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 'clamp(16px, 4vw, 28px) clamp(16px, 4vw, 28px) clamp(14px, 3vw, 24px)', marginBottom: 'var(--sp-xl)' }}>
          <ProfileHeader
            profile={profile}
            isOwner={isOwner}
            followersCount={followersCount}
            followingCount={followingCount}
            isFollowing={isFollowing}
            gradeColor={gradeColor}
            gradeEmoji={gradeEmoji}
            gradeTitle={gradeTitle}
            gradeNum={gradeNum}
          />
          <ProfileGradeCard
            profileId={profile.id}
            isOwner={isOwner}
            gradeNum={gradeNum}
            gradeColor={gradeColor}
            gradeEmoji={gradeEmoji}
            gradeTitle={gradeTitle}
            currentPoints={profile.points ?? 0}
            postsCount={profile.posts_count ?? 0}
            commentCount={commentCount}
            likesCount={profile.likes_count ?? 0}
          />
        </div>

        {/* 탭 + 목록 */}
        <ProfileTabs
          profileId={profile.id}
          posts={posts}
          isOwner={isOwner}
        />
      </div>
    </PullToRefresh>
  );
}
