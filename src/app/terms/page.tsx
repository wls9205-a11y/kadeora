export default function TermsPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 0' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--kd-text)', marginBottom: 8 }}>이용약관</h1>
      <p style={{ color: 'var(--kd-text-dim)', fontSize: 13, marginBottom: 32 }}>최종 수정일: 2026년 3월 15일</p>
      {[
        ['제1조 (목적)', 'KADEORA(이하 "서비스")의 이용약관은 회원과 서비스 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.'],
        ['제2조 (서비스 이용)', '회원은 서비스를 통해 금융 정보를 공유하고, 다른 회원의 게시물에 댓글을 작성하거나 좋아요를 표시할 수 있습니다.'],
        ['제3조 (금지 행위)', '허위 정보 유포, 타인 비방, 투자사기 등의 행위는 엄격히 금지되며 즉시 이용정지 조치가 취해질 수 있습니다.'],
        ['제4조 (면책 조항)', '서비스에 게시된 정보는 투자 권유나 재무 자문이 아닙니다. 투자 판단은 본인 책임 하에 이루어져야 합니다.'],
        ['제5조 (약관 변경)', '서비스는 필요한 경우 이 약관을 변경할 수 있으며, 변경 시 7일 전에 공지합니다.'],
      ].map(([title, content]) => (
        <div key={title} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--kd-text)', marginBottom: 8 }}>{title}</h2>
          <p style={{ fontSize: 14, color: 'var(--kd-text-muted)', lineHeight: 1.7 }}>{content}</p>
        </div>
      ))}
    </div>
  );
}