import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description: '카더라 개인정보처리방침',
  robots: { index: false },
};

export default function PrivacyPage() {
  return (
    <main
      style={{ maxWidth: 680, margin: '0 auto', padding: '40px 20px', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>개인정보처리방침</h1>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginBottom: 40 }}>시행일: 2026년 3월 15일</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>1. 수집 항목</h2>
        <ul style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20 }}>
          <li>카카오 / Google 로그인 시: 이메일, 프로필 이름, 프로필 사진 URL</li>
          <li>서비스 이용 중 자동 생성: 접속 IP, 기기 정보, 이용 기록</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>2. 이용 목적</h2>
        <ul style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20 }}>
          <li>회원 인증 및 서비스 제공</li>
          <li>서비스 개선 및 통계 분석</li>
          <li>알림 및 공지사항 전달</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>3. 보유 기간</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>회원 탈퇴 즉시 파기. 단, 관계 법령에 따라 일정 기간 보관될 수 있습니다.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>4. 제3자 제공</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>카더라는 개인정보를 외부에 제공하지 않습니다. 법령에 의한 요청은 예외입니다.</p>
      </section>

      <section>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>5. 개인정보 보호 책임자</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          이메일:{' '}
          <a href="mailto:wls9205@gmail.com" style={{ color: 'var(--brand)' }}>wls9205@gmail.com</a>
        </p>
        {/* 주소, 전화번호, 대표자 실명은 개인정보 보호를 위해 게재하지 않습니다 */}
      </section>
    </main>
  );
}
