export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 0' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--kd-text)', marginBottom: 8 }}>개인정보처리방침</h1>
      <p style={{ color: 'var(--kd-text-dim)', fontSize: 13, marginBottom: 32 }}>최종 수정일: 2026년 3월 15일</p>
      {[
        ['수집하는 개인정보', 'OAuth 로그인 시 이메일 주소, 프로필 이름, 프로필 사진 URL을 수집합니다. 서비스 이용 기록(게시글, 댓글, 좋아요)은 Supabase에 안전하게 저장됩니다.'],
        ['개인정보 이용 목적', '수집된 정보는 서비스 제공, 회원 관리, 서비스 개선에만 사용됩니다. 제3자에게 판매하거나 공유하지 않습니다.'],
        ['개인정보 보관 기간', '회원 탈퇴 시 즉시 삭제됩니다. 법적 의무가 있는 경우 관련 법률에 따라 일정 기간 보관될 수 있습니다.'],
        ['제3자 서비스', '카카오, Google OAuth 인증을 사용하며 각 회사의 개인정보처리방침이 적용됩니다. Supabase를 통해 데이터를 안전하게 저장합니다.'],
        ['문의처', '개인정보 관련 문의: privacy@kadeora.com'],
      ].map(([title, content]) => (
        <div key={title} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--kd-text)', marginBottom: 8 }}>{title}</h2>
          <p style={{ fontSize: 14, color: 'var(--kd-text-muted)', lineHeight: 1.7 }}>{content}</p>
        </div>
      ))}
    </div>
  );
}