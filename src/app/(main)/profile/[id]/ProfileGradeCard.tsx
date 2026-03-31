'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import InviteSection from './InviteSection';

const NEXT_GRADE_POINTS: Record<number, number> = {
  1:100,2:300,3:700,4:1500,5:3000,6:6000,7:12000,8:25000,9:50000,10:99999,
};
const GRADE_BENEFITS: Record<number, string> = {
  1: '기본 기능 이용', 2: '댓글 무제한', 3: '토론방 자유 입장',
  4: '게시글 이미지 첨부', 5: '검색 고급 필터', 6: '주간 인기 노출',
  7: 'HOT 배지 우선 노출', 8: '프로필 특별 테두리', 9: '모든 기능 무제한',
  10: '명예의 전당 등록',
};

interface Props {
  profileId: string;
  isOwner: boolean;
  gradeNum: number;
  gradeColor: string;
  gradeEmoji: string;
  gradeTitle: string;
  currentPoints: number;
  postsCount: number;
  commentCount: number;
  likesCount: number;
}

export default function ProfileGradeCard({ profileId, isOwner, gradeNum, gradeColor, gradeEmoji, gradeTitle, currentPoints, postsCount, commentCount, likesCount }: Props) {
  const [attendance, setAttendance] = useState<{ streak: number; total_days: number; already_today: boolean } | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteCount, setInviteCount] = useState(0);
  const { success, error } = useToast();

  const nextPoints = NEXT_GRADE_POINTS[gradeNum] ?? 99999;
  const prevPoints = gradeNum > 1 ? NEXT_GRADE_POINTS[gradeNum - 1] ?? 0 : 0;
  const progress = gradeNum >= 10 ? 100 : Math.min(100, Math.round(((currentPoints - prevPoints) / (nextPoints - prevPoints)) * 100));
  const totalActivity = postsCount + commentCount + likesCount;

  useEffect(() => {
    if (!isOwner) return;
    fetch('/api/invite').then(r => r.ok ? r.json() : null).then(d => { if (d?.code) setInviteCode(d.code); }).catch(() => {});
    const sb = createSupabaseBrowser();
    sb.from('invite_codes').select('id', { count: 'exact', head: true }).eq('creator_id', profileId).eq('is_used', true).then(({ count }) => setInviteCount(count ?? 0));
    fetch('/api/attendance').then(r => r.ok ? r.json() : null).then(d => { if (d) setAttendance(d); }).catch(() => {});
  }, [isOwner, profileId]);

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

  const stats = [
    { label: '게시글', value: postsCount, icon: '📝' },
    { label: '댓글', value: commentCount, icon: '💬' },
    { label: '받은 좋아요', value: likesCount, icon: '❤️' },
    { label: '총 활동', value: totalActivity, icon: '⚡' },
    { label: '포인트', value: currentPoints, icon: '💰' },
  ];

  return (
    <>
      {/* 등급 진행 바 */}
      <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--bg-base)', borderRadius: 10, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: 0, marginTop: 16, background: 'var(--bg-base)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '12px 0' }}>
        {stats.map((stat, i) => (
          <div key={stat.label} style={{ display: 'contents' }}>
            {i > 0 && <div style={{ height: 24, width: 1, background: 'var(--border)' }} />}
            <div style={{ minWidth: 60, textAlign: 'center', padding: '0 16px' }}>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)' }}>{(stat.value ?? 0).toLocaleString()}</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{stat.label}</div>
            </div>
          </div>
        ))}
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
    </>
  );
}
