import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '가이드북',
  description: '카더라 앱 사용 가이드와 업데이트 노트',
};

const FEATURES = [
  { icon: '🏠', title: '피드', desc: '전체/우리동네/주식/부동산/자유 탭으로 원하는 주제 글 보기. ▲ 추천 버튼으로 좋은 글 추천 가능' },
  { icon: '🏘', title: '우리동네', desc: '내 지역 설정 후 동네별 소식 확인. 시 단위 지역 필터 제공 (서울/부산/경기 등)' },
  { icon: '📈', title: '주식', desc: '국내외 150개 종목 실시간 시세. 코스피/코스닥/뉴욕/나스닥 탭 필터' },
  { icon: '🏠', title: '부동산', desc: '아파트 청약 정보 및 일정 확인' },
  { icon: '💬', title: '토론', desc: '주제별 실시간 채팅 토론방' },
  { icon: '🔗', title: '공유', desc: '카카오톡/X/링크복사로 글 공유 가능' },
  { icon: '🚨', title: '신고', desc: '부적절한 글/댓글 신고 기능' },
  { icon: '⭐', title: '등급 시스템', desc: '활동 포인트로 🌱새싹 → 🚀카더라신 10단계 등급' },
  { icon: '🔤', title: '글씨 크기', desc: '오른쪽 상단 드롭다운에서 작게/보통/크게 조절' },
  { icon: '👤', title: '프로필', desc: '지역 설정, 자기소개, 내 게시글/댓글 히스토리' },
];

const UPDATES = [
  {
    version: 'v1.3',
    date: '2026.03.18',
    items: ['우리동네 시 단위 지역 필터', '글씨 크기 헤더 드롭다운 이동', '페이지 레이아웃 통일', '가이드북 페이지 추가'],
  },
  {
    version: 'v1.2',
    date: '2026.03.18',
    items: ['카카오톡 공유 버튼', '프로필 아바타 수정', '주식 탭 한글화', '헤더 카더라 텍스트'],
  },
  {
    version: 'v1.1',
    date: '2026.03.18',
    items: ['어드민 페이지', '신고 시스템', '쿠키 동의 배너', '투자 면책 워터마크'],
  },
  {
    version: 'v1.0',
    date: '2026.03.18',
    items: ['카더라 서비스 오픈 — 피드/주식/부동산/토론/프로필'],
  },
];

export default function GuidePage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>📖 카더라 가이드</h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>카더라를 100% 활용하는 방법</p>
      </div>

      {/* 주요 기능 소개 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>주요 기능</h2>
        {FEATURES.map((f, i) => (
          <div key={f.title} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < FEATURES.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{f.icon}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{f.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 업데이트 노트 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>업데이트 노트</h2>
        {UPDATES.map((u, i) => (
          <div key={u.version} style={{ padding: '12px 0', borderBottom: i < UPDATES.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: 'var(--brand)', color: 'var(--text-inverse)', fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '2px 8px' }}>{u.version}</span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{u.date}</span>
            </div>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {u.items.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
