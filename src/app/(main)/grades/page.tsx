import type { Metadata } from 'next';
import { createClient } from '@/utils/supabase/server';

export const metadata: Metadata = {
  title: '회원 등급 안내',
  description: '카더라 회원 등급 시스템 안내 — 새싹부터 카더라신까지',
};

const GRADE_COLORS: Record<number, string> = {
  1: '#4CAF50', 2: '#2196F3', 3: '#9C27B0', 4: '#FF9800',
  5: '#F44336', 6: '#E91E63', 7: '#00BCD4', 8: '#FFD700',
  9: '#FF6B35', 10: '#7B2FBE',
};

export default async function GradesPage() {
  const supabase = await createClient();
  const { data: grades } = await supabase
    .from('grade_definitions')
    .select('*')
    .order('grade');

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          🏆 회원 등급 안내
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          카더라에서 활동할수록 영향력 점수가 쌓여 등급이 올라갑니다.
          게시글 작성, 댓글, 좋아요를 받을수록 더 빠르게 성장해요!
        </p>
      </div>

      {/* 점수 획득 방법 */}
      <div
        className="rounded-xl p-4 mb-6"
        style={{ backgroundColor: 'var(--brand-light)', border: '1px solid var(--brand)' }}
      >
        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--brand)' }}>📈 점수 획득 방법</p>
        <ul className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
          <li>• 게시글 작성 +10점</li>
          <li>• 게시글에 좋아요 받기 +2점</li>
          <li>• 댓글 작성 +3점</li>
          <li>• 팔로워 획득 +5점</li>
          <li>• 매가폰 사용 +20점</li>
          <li>• 출석 체크 +1점/일</li>
        </ul>
      </div>

      {/* 등급 목록 */}
      <div className="space-y-3">
        {(grades ?? []).map((g: any) => (
          <div
            key={g.grade}
            className="rounded-xl p-4 flex items-center gap-4"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            {/* 등급 번호 */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-black shrink-0"
              style={{ backgroundColor: GRADE_COLORS[g.grade] + '22', color: GRADE_COLORS[g.grade] }}
            >
              {g.emoji}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                  Lv.{g.grade} {g.title}
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: GRADE_COLORS[g.grade] + '22', color: GRADE_COLORS[g.grade] }}
                >
                  {g.min_score.toLocaleString()}점~
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {g.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-center mt-8" style={{ color: 'var(--text-tertiary)' }}>
        등급 시스템은 추후 업데이트될 수 있습니다.
      </p>
    </div>
  );
}
