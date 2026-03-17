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
      <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginBottom: 40 }}>시행일: 2026년 3월 18일</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>1. 수집 항목</h2>
        <ul style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20 }}>
          <li>필수 항목: 이메일, 닉네임</li>
          <li>카카오·구글 로그인 시: 이메일, 프로필명</li>
          <li>자동 수집 항목: IP 주소, 쿠키, 서비스 이용 기록</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>2. 수집 목적</h2>
        <ul style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20 }}>
          <li>회원 관리 및 본인 확인</li>
          <li>서비스 제공 및 운영</li>
          <li>부정 이용 방지 및 비인가 사용 탐지</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>3. 보유 기간</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          회원 탈퇴 즉시 파기합니다. 단, 관계 법령에 따라 아래와 같이 일정 기간 보존됩니다.
        </p>
        <ul style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20, marginTop: 8 }}>
          <li>전자상거래 등에서의 소비자 보호에 관한 법률: 계약·청약철회 기록 5년</li>
          <li>통신비밀보호법: 통신사실확인자료 3개월</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>4. 제3자 제공</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          카더라는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 법령에 의한 요청이 있는 경우에는 예외로 합니다.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>5. 쿠키 사용</h2>
        <ul style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20 }}>
          <li>사용 목적: 로그인 유지 및 이용자 설정 저장</li>
          <li>쿠키 거부 방법: 브라우저 설정에서 쿠키를 거부할 수 있습니다. 다만, 거부 시 일부 서비스 이용이 제한될 수 있습니다.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>6. 이용자 권리</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          이용자는 언제든지 자신의 개인정보에 대해 열람, 정정, 삭제, 처리 정지를 요구할 수 있습니다.
          요청은 아래 개인정보 삭제 요청 이메일을 통해 접수할 수 있으며, 지체 없이 조치하겠습니다.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>7. 개인정보 삭제 요청</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          개인정보 삭제를 원하시는 경우 아래 이메일로 요청해 주세요.{' '}
          <a href="mailto:kadeora.app@gmail.com" style={{ color: 'var(--brand)' }}>kadeora.app@gmail.com</a>
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>8. 개인정보보호 책임자</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          이메일:{' '}
          <a href="mailto:kadeora.app@gmail.com" style={{ color: 'var(--brand)' }}>kadeora.app@gmail.com</a>
        </p>
      </section>
    </main>
  );
}
