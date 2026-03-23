import type { Metadata } from 'next';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '가이드북 — 카더라 100% 활용법',
  description: '카더라 앱 사용 가이드. 주식 시세, 부동산 청약, 블로그, 커뮤니티, 등급 시스템, 포인트 획득 방법을 알아보세요.',
};

const FEATURES = [
  { icon: '📋', title: '피드', desc: '전체/우리동네/주식/부동산/자유 탭으로 원하는 주제 글 보기. ▲ 추천 버튼으로 좋은 글 추천. 임시저장 지원.' },
  { icon: '📊', title: '주식', desc: '국내외 150개 종목 실시간 시세 (5분 갱신). 코스피/코스닥/뉴욕/나스닥 탭. 캔들차트, 수급, 뉴스, AI 한줄평, 종목 토론까지.' },
  { icon: '🏢', title: '부동산', desc: '5개 탭 — 📅 청약 일정 · 🏢 분양중 · 🏚️ 미분양 · 🏗️ 재개발 · 💰 실거래. 지역 필터, 마감 임박 알림, 관심단지 등록.' },
  { icon: '📝', title: '블로그', desc: '주식·청약·미분양·재테크 정보 14,000편 이상. 카테고리 필터, 인기글 TOP5, 검색 기능.' },
  { icon: '💬', title: '라운지 토론', desc: '자유방/주식방/부동산방에서 실시간 채팅. 투표형 토론도 가능.' },
  { icon: '🔥', title: '이번 주 HOT', desc: '이번 주 가장 핫한 글 TOP 5와 지역별 인기 글을 한눈에 확인.' },
  { icon: '🔍', title: '통합 검색', desc: '게시글·블로그·주식·청약·재개발·미분양·토론 전체를 한번에 검색.' },
  { icon: '📍', title: '우리동네', desc: '내 지역 설정 후 동네별 소식 확인. 시 단위 지역 필터 (서울/부산/경기 등)' },
  { icon: '🔗', title: '공유', desc: '카카오톡/X/밴드/스레드/라인/네이버/링크복사로 글 공유. 부동산 상세에서도 공유 가능.' },
  { icon: '🔔', title: '알림', desc: '댓글, 좋아요, 팔로우 알림을 실시간으로. 클릭하면 해당 게시글로 바로 이동.' },
  { icon: '⭐', title: '관심 종목·단지', desc: '주식 종목 관심등록, 부동산 관심단지 등록. 새 소식이 있으면 알림.' },
  { icon: '📈', title: '캔들차트', desc: '주식 상세에서 캔들/라인 전환, 1주~전체 기간 선택. 터치하면 시가·고가·저가·종가 확인.' },
  { icon: '🏗️', title: '재개발 현황', desc: '전국 217건 재개발·재건축 진행 현황. 단계별(정비구역지정~준공) 필터, 세대수 표시.' },
  { icon: '💰', title: '실거래가', desc: '전국 아파트 실거래가 검색. 월별 추이, 최고가 대비 % 표시, 지역별 현황.' },
  { icon: '🎯', title: '청약 가점 진단', desc: '부동산 페이지에서 내 청약 가점을 자가 진단해보세요.' },
  { icon: '📅', title: '출석 체크', desc: '매일 출석 체크로 포인트 획득. 7일 연속 +30P, 30일 연속 +100P 보너스!' },
  { icon: '👥', title: '친구 초대', desc: '내 초대코드로 친구 초대 시 둘 다 +50 포인트. 프로필에서 코드 확인.' },
  { icon: '🚨', title: '신고', desc: '부적절한 글/댓글 신고 기능. 어드민이 확인 후 조치합니다.' },
  { icon: '⭐', title: '등급 시스템', desc: '활동 포인트로 🌱새싹 → 🚀카더라신 10단계 등급. 매일 자동 갱신.' },
  { icon: '🔤', title: '글씨 크기', desc: '오른쪽 상단 드롭다운에서 작게/보통/크게 조절.' },
  { icon: '👤', title: '프로필', desc: '지역 설정, 자기소개, 내 게시글/댓글/북마크 히스토리.' },
  { icon: '📱', title: '푸시 알림', desc: '홈 화면에 추가 후 알림을 허용하면 댓글/좋아요/팔로우 시 실시간 푸시 알림.' },
  { icon: '🔄', title: '당겨서 새로고침', desc: '피드/검색/알림 등에서 화면을 아래로 당기면 최신 정보로 새로고침.' },
  { icon: '✍️', title: '현장 한줄평', desc: '청약 아파트, 미분양, 재개발 상세 페이지에서 현장 한줄평을 남겨보세요.' },
  { icon: '📡', title: '전광판 유료 노출', desc: '전광판 노출권을 구매하면 내 글을 전체 사용자에게 스크롤 배너로 홍보.' },
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
        <h1 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>📖 카더라 가이드</h1>
        <p style={{ margin: '6px 0 0', fontSize: 'var(--fs-base)', color: 'var(--text-secondary)' }}>카더라를 100% 활용하는 방법</p>
      </div>

      {/* 앱 설치 방법 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>📲 앱 설치 방법</h2>
        {Object.entries(INSTALL_STEPS).map(([platform, steps]) => (
          <div key={platform} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              {platform === 'ios' ? '🍎 iPhone / iPad' : platform === 'android' ? '🤖 Android' : '💻 PC / Mac'}
            </div>
            {steps.map(s => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--brand)', color: 'var(--text-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-sm)', fontWeight: 800, flexShrink: 0 }}>{s.n}</div>
                <div>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{s.title}</div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
        <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: 12, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          설치 후 혜택: 🔔 실시간 푸시 알림 · ⚡ 앱처럼 빠른 실행 · 🚫 앱스토어 다운로드 불필요
        </div>
      </div>

      {/* 주요 기능 소개 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>주요 기능</h2>
        {FEATURES.map((f, i) => (
          <div key={f.title} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < FEATURES.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--fs-xl)', flexShrink: 0, lineHeight: 1 }}>{f.icon}</span>
            <div>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)' }}>{f.title}</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 등급 안내 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>🏅 회원 등급 안내</h2>
        <p style={{ margin: '0 0 12px', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>활동 포인트에 따라 등급이 올라갑니다</p>
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
            <span style={{ fontSize: 'var(--fs-lg)', width: 28, textAlign: 'center' as const }}>{g.emoji}</span>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>Lv.{g.lv} {g.name}</span>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{g.pts}~</span>
          </div>
        ))}
      </div>

      {/* 포인트 획득 방법 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>💰 포인트 획득 방법</h2>
        {[
          { action: '출석체크', pts: '+10P', note: '7일 연속 +30P, 30일 연속 +100P' },
          { action: '게시글 작성', pts: '+5P', note: '' },
          { action: '댓글 작성', pts: '+2P', note: '블로그 댓글도 포함' },
          { action: '좋아요 받기', pts: '+1P', note: '' },
          { action: '친구 초대', pts: '+50P', note: '초대한 친구도 +50P' },
          { action: '프로필 사진 등록', pts: '+30P', note: '최초 1회' },
        ].map((p, i, arr) => (
          <div key={p.action} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{p.action}</span>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--brand)' }}>{p.pts}</span>
            {p.note && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{p.note}</span>}
          </div>
        ))}
      </div>

      {/* 자주 묻는 질문 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>❓ 자주 묻는 질문</h2>
        {[
          { q: '카더라는 무료인가요?', a: '네, 모든 기능을 무료로 이용할 수 있습니다. 전광판 노출권 등 일부 유료 상품이 있지만, 핵심 기능은 전부 무료입니다.' },
          { q: '회원 탈퇴는 어떻게 하나요?', a: '프로필 → 계정 설정에서 탈퇴할 수 있습니다. 탈퇴 시 작성한 글과 댓글은 익명 처리됩니다.' },
          { q: '주식 시세는 실시간인가요?', a: '장중에는 5분 간격으로 갱신됩니다. KIS → 네이버 → Yahoo 3중 폴백으로 안정적으로 제공합니다.' },
          { q: '청약 정보는 어디서 가져오나요?', a: '국토교통부 공공데이터 API (청약홈)에서 매일 자동 수집합니다.' },
          { q: '블로그 글은 누가 쓰나요?', a: '카더라 데이터팀이 공공 데이터를 기반으로 작성합니다. 투자 권유가 아닌 참고 자료입니다.' },
          { q: '오프라인에서도 사용할 수 있나요?', a: 'PWA 설치 후에는 이전에 본 페이지를 오프라인에서도 볼 수 있습니다. 새 데이터는 온라인 연결이 필요합니다.' },
        ].map((faq, i, arr) => (
          <div key={i} style={{ padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Q. {faq.q}</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>A. {faq.a}</div>
          </div>
        ))}
      </div>

      {/* 문의 */}
      <div style={{ background: 'var(--bg-hover)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>💌 문의·건의</div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
          버그 신고, 기능 제안, 문의사항이 있으시면 언제든 연락해주세요.
        </div>
        <a href="mailto:kadeora.app@gmail.com" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 10, background: 'var(--brand)', color: 'var(--text-inverse)', fontSize: 'var(--fs-sm)', fontWeight: 700, textDecoration: 'none' }}>
          📧 kadeora.app@gmail.com
        </a>
      </div>
    </div>
  );
}
