import type { Metadata } from 'next';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '가이드북',
  description: '카더라 앱 사용 가이드',
};

const FEATURES = [
  { icon: '📋', title: '피드', desc: '전체/우리동네/주식/부동산/자유 탭으로 원하는 주제 글 보기. ▲ 추천 버튼으로 좋은 글 추천 가능' },
  { icon: '📍', title: '우리동네', desc: '내 지역 설정 후 동네별 소식 확인. 시 단위 지역 필터 제공 (서울/부산/경기 등)' },
  { icon: '📊', title: '주식', desc: '국내외 150개 종목 실시간 시세. 코스피/코스닥/뉴욕/나스닥 탭 필터' },
  { icon: '🏢', title: '부동산', desc: '아파트 청약 정보 및 일정 확인. 미분양 현황 제공' },
  { icon: '💭', title: '토론', desc: '주식 토론방, 현장 토론방에서 실시간 소통' },
  { icon: '🔗', title: '공유', desc: '카카오톡/X/밴드/스레드/라인/링크복사로 글 공유 가능' },
  { icon: '🚨', title: '신고', desc: '부적절한 글/댓글 신고 기능' },
  { icon: '⭐', title: '등급 시스템', desc: '활동 포인트로 🌱새싹 → 🚀카더라신 10단계 등급' },
  { icon: '🔤', title: '글씨 크기', desc: '오른쪽 상단 드롭다운에서 작게/보통/크게 조절' },
  { icon: '👤', title: '프로필', desc: '지역 설정, 자기소개, 내 게시글/댓글 히스토리' },
  { icon: '📅', title: '출석 체크', desc: '매일 출석 체크로 포인트 획득. 7일 연속 +30P, 30일 연속 +100P 보너스!' },
  { icon: '👥', title: '친구 초대', desc: '내 초대코드로 친구 초대 시 둘 다 +50 포인트. 프로필에서 코드 확인 가능.' },
  { icon: '🔥', title: '이번 주 HOT', desc: '이번 주 가장 핫한 글 TOP 5와 지역별 인기 글을 한눈에 확인.' },
  { icon: '🔔', title: '알림', desc: '댓글, 좋아요, 팔로우 알림을 실시간으로 받아보세요.' },
];

const INSTALL_STEPS = {
  ios: [
    { n: '1', title: 'Safari로 접속', desc: 'Safari 브라우저에서 kadeora.app 접속' },
    { n: '2', title: '공유 버튼 탭', desc: '하단 가운데 □↑ 모양 공유 버튼을 탭하세요' },
    { n: '3', title: '홈 화면에 추가', desc: '스크롤해서 "홈 화면에 추가"를 탭하세요' },
    { n: '4', title: '추가 완료!', desc: '오른쪽 위 "추가"를 탭하면 설치 완료!' },
  ],
  android: [
    { n: '1', title: 'Chrome으로 접속', desc: 'Chrome 브라우저에서 kadeora.app 접속' },
    { n: '2', title: '설치 배너 탭', desc: '화면 하단의 "📲 설치하기" 배너를 탭하세요' },
    { n: '3', title: '설치 확인', desc: '팝업에서 "설치" 버튼을 탭하세요' },
    { n: '4', title: '설치 완료!', desc: '홈 화면에 카더라 아이콘이 생겨요!' },
  ],
  desktop: [
    { n: '1', title: 'Chrome/Edge 접속', desc: 'Chrome 또는 Edge에서 kadeora.app 접속' },
    { n: '2', title: '설치 아이콘 클릭', desc: '주소창 오른쪽 ⊕ 또는 ↓ 모양 아이콘 클릭' },
    { n: '3', title: '앱 설치 클릭', desc: '"앱 설치" 또는 "설치" 버튼 클릭' },
    { n: '4', title: '설치 완료!', desc: '바탕화면에 카더라가 생겨요!' },
  ],
};

export default function GuidePage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>📖 카더라 가이드</h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>카더라를 100% 활용하는 방법</p>
      </div>

      {/* 앱 설치 방법 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>📲 앱 설치 방법</h2>
        {Object.entries(INSTALL_STEPS).map(([platform, steps]) => (
          <div key={platform} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              {platform === 'ios' ? '🍎 iPhone / iPad' : platform === 'android' ? '🤖 Android' : '💻 PC / Mac'}
            </div>
            {steps.map(s => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{s.n}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
        <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          설치 후 혜택: 🔔 실시간 푸시 알림 · ⚡ 앱처럼 빠른 실행 · 🚫 앱스토어 다운로드 불필요
        </div>
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

      {/* 등급 안내 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>🏅 회원 등급 안내</h2>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>활동 포인트에 따라 등급이 올라갑니다</p>
        {[
          { lv: 1, name: '새싹', pts: '0P', emoji: '🌱' },
          { lv: 2, name: '소문쟁이', pts: '100P', emoji: '🌿' },
          { lv: 3, name: '동네방네', pts: '300P', emoji: '🍀' },
          { lv: 4, name: '소문난집', pts: '600P', emoji: '🌸' },
          { lv: 5, name: '핫이슈', pts: '1,000P', emoji: '🌻' },
          { lv: 6, name: '빅마우스', pts: '2,000P', emoji: '⭐' },
          { lv: 7, name: '인플루언서', pts: '5,000P', emoji: '🔥' },
          { lv: 8, name: '전설', pts: '10,000P', emoji: '💎' },
          { lv: 9, name: '레전드', pts: '30,000P', emoji: '👑' },
          { lv: 10, name: '카더라신', pts: '100,000P', emoji: '🚀' },
        ].map((g, i, arr) => (
          <div key={g.lv} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <span style={{ fontSize: 18, width: 28, textAlign: 'center' as const }}>{g.emoji}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>Lv.{g.lv} {g.name}</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{g.pts}~</span>
          </div>
        ))}
      </div>

      {/* 포인트 획득 방법 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>💰 포인트 획득 방법</h2>
        {[
          { action: '출석체크', pts: '+10P', note: '7일 연속 +30P, 30일 연속 +100P' },
          { action: '게시글 작성', pts: '+5P', note: '' },
          { action: '댓글 작성', pts: '+2P', note: '' },
          { action: '좋아요 받기', pts: '+1P', note: '' },
          { action: '친구 초대', pts: '+50P', note: '초대한 친구도 +50P' },
        ].map((p, i, arr) => (
          <div key={p.action} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{p.action}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>{p.pts}</span>
            {p.note && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{p.note}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
