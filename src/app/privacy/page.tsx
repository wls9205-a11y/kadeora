import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description: '카더라 개인정보처리방침',
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: { title: '개인정보처리방침', description: '카더라 개인정보처리방침', url: `${SITE_URL}/privacy`, siteName: '카더라', locale: 'ko_KR', type: 'website' },
};

export default function PrivacyPage() {
  return (
    <main
      style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 'var(--sp-sm)', color: 'var(--text-primary)' }}>개인정보처리방침</h1>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 40 }}>시행일: 2026년 3월 24일 (v2.0)</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, marginBottom: 'var(--sp-sm)', color: 'var(--text-primary)' }}>1. 수집 항목</h2>
        <ul style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20 }}>
          <li>필수 항목: 이메일, 닉네임</li>
          <li>카카오·구글 로그인 시: 이메일, 프로필명</li>
          <li>관심단지 등록 시 (비회원): 이름, 전화번호, 생년월일, 거주 지역(시군구)</li>
          <li>온보딩 시: 관심 분야, 연령대, 거주 지역</li>
          <li>자동 수집 항목: IP 주소, 쿠키, 서비스 이용 기록, 접속 기기 정보</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, marginBottom: 'var(--sp-sm)', color: 'var(--text-primary)' }}>2. 수집 목적</h2>
        <ul style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20 }}>
          <li>회원 관리 및 본인 확인</li>
          <li>서비스 제공 및 운영</li>
          <li>관심 현장 분양 정보 제공 및 일정 알림</li>
          <li>맞춤 콘텐츠 추천 (거주 지역 기반)</li>
          <li>부정 이용 방지 및 비인가 사용 탐지</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, marginBottom: 'var(--sp-sm)', color: 'var(--text-primary)' }}>3. 보유 기간</h2>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          회원 탈퇴 또는 동의 철회 시 즉시 파기합니다. 단, 관계 법령에 따라 아래와 같이 일정 기간 보존됩니다.
        </p>
        <ul style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20, marginTop: 8 }}>
          <li>전자상거래 등에서의 소비자 보호에 관한 법률: 계약·청약철회 기록 5년</li>
          <li>통신비밀보호법: 인터넷 로그기록자료 3개월</li>
          <li>관심단지 등록 정보: 동의 철회 시 또는 수집 목적 달성 후 5일 이내 파기</li>
          <li>개인정보 동의 이력: 동의 증빙을 위해 동의 철회 후 3년 보관</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, marginBottom: 'var(--sp-sm)', color: 'var(--text-primary)' }}>4. 제3자 제공</h2>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          카더라는 이용자의 별도 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만 아래의 경우에는 예외로 합니다.
        </p>
        <ul style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20, marginTop: 8 }}>
          <li>이용자가 관심단지 등록 시 &quot;제3자 제공 동의&quot;에 동의한 경우: 해당 현장 분양 상담사에게 이름·전화번호를 제공합니다.</li>
          <li>법령에 의한 요청이 있는 경우</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, marginBottom: 'var(--sp-sm)', color: 'var(--text-primary)' }}>5. 만 14세 미만 아동</h2>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          카더라는 만 14세 미만 아동의 개인정보를 수집하지 않습니다. 관심단지 등록 시 생년월일을 확인하여 만 14세 미만인 경우 등록이 거부됩니다. (개인정보 보호법 제22조의2)
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, marginBottom: 'var(--sp-sm)', color: 'var(--text-primary)' }}>6. 개인정보의 안전성 확보 조치</h2>
        <ul style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20 }}>
          <li>전화번호는 AES-256-GCM 암호화하여 저장합니다.</li>
          <li>HTTPS 암호화 통신을 사용합니다.</li>
          <li>데이터베이스 접근 권한을 최소화하여 관리합니다. (RLS 적용)</li>
          <li>관리자 페이지에서 전화번호 원본 열람은 불가합니다 (마스킹 처리).</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, marginBottom: 'var(--sp-sm)', color: 'var(--text-primary)' }}>7. 쿠키 사용</h2>
        <ul style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20 }}>
          <li>사용 목적: 로그인 유지 및 이용자 설정 저장</li>
          <li>쿠키 거부 방법: 브라우저 설정에서 쿠키를 거부할 수 있습니다. 다만, 거부 시 일부 서비스 이용이 제한될 수 있습니다.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, marginBottom: 'var(--sp-sm)', color: 'var(--text-primary)' }}>8. 이용자 권리</h2>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          이용자는 언제든지 자신의 개인정보에 대해 열람, 정정, 삭제, 처리 정지를 요구할 수 있습니다.
          요청은 아래 개인정보 삭제 요청 이메일을 통해 접수할 수 있으며, 지체 없이 조치하겠습니다.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, marginBottom: 'var(--sp-sm)', color: 'var(--text-primary)' }}>9. 개인정보 삭제 요청</h2>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          개인정보 삭제를 원하시는 경우 아래 이메일로 요청해 주세요.{' '}
          <a href="mailto:kadeora.app@gmail.com" style={{ color: 'var(--brand)' }}>kadeora.app@gmail.com</a>
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, marginBottom: 'var(--sp-sm)', color: 'var(--text-primary)' }}>10. 개인정보보호 책임자</h2>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          이메일:{' '}
          <a href="mailto:kadeora.app@gmail.com" style={{ color: 'var(--brand)' }}>kadeora.app@gmail.com</a>
        </p>
      </section>
    </main>
  );
}
