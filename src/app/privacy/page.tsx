import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "카더라(KADEORA) 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px 100px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: "#F1F5F9", marginBottom: 8 }}>개인정보처리방침</h1>
      <p style={{ fontSize: 12, color: "#64748B", marginBottom: 32 }}>시행일: 2026년 3월 15일 | 최종 수정: 2026년 3월 15일</p>

      <div style={{ fontSize: 14, color: "#CBD5E1", lineHeight: 1.9 }}>
        <S title="제1조 (목적)">
          카더라(이하 &ldquo;회사&rdquo;)는 이용자의 개인정보를 중요시하며, 「개인정보보호법」,
          「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 등 관련 법령을 준수합니다.
        </S>

        <S title="제2조 (수집하는 개인정보 항목 및 보유기간)">
          <TW>
            <thead><tr><Th>수집 항목</Th><Th>수집 방법</Th><Th>이용 목적</Th><Th>보유 기간</Th></tr></thead>
            <tbody>
              <Tr cells={["카카오/구글 계정 정보 (이메일, 닉네임, 프로필 이미지)", "소셜 OAuth", "회원 식별", "탈퇴 후 30일간 복구 가능 상태 유지, 이후 지체 없이 파기"]} />
              <Tr cells={["전화번호", "SMS 인증", "본인 인증", "인증 완료 즉시 파기 (인증 결과만 보관, 탈퇴 시 삭제)"]} />
              <Tr cells={["지역 정보", "온보딩 직접 입력", "맞춤 콘텐츠 제공", "탈퇴 후 30일 유지 후 파기"]} />
              <Tr cells={["관심사 (주식/부동산/청약)", "온보딩 선택", "개인화 피드", "탈퇴 후 30일 유지 후 파기"]} />
              <Tr cells={["생년월일", "가입 시 입력", "만 14세 미만 가입 제한 확인", "탈퇴 후 30일 유지 후 파기"]} />
              <Tr cells={["실시간 채팅 내용", "서비스 이용 중 자동 저장", "서비스 운영 및 분쟁 대응", "작성일로부터 1년 후 파기"]} />
              <Tr cells={["결제 정보", "토스페이먼츠 연동", "상품 구매 처리", "전자상거래법에 따라 5년 보관 후 파기"]} />
              <Tr cells={["행태 정보 (검색어, 클릭, 체류시간)", "자동 수집 (별도 동의 시에만)", "서비스 개선·트렌드 분석", "수집일로부터 6개월 후 자동 파기"]} />
            </tbody>
          </TW>
        </S>

        <S title="제3조 (만 14세 미만 이용자)">
          본 서비스는 만 14세 이상만 이용 가능합니다. 만 14세 미만 아동의 개인정보는 수집하지 않으며,
          만 14세 미만임이 확인될 경우 해당 계정과 수집된 정보를 지체 없이 파기합니다.
          법정대리인은 아동의 개인정보에 대해 열람, 정정, 삭제를 요청할 수 있습니다.
        </S>

        <S title="제4조 (개인정보의 처리 위탁)">
          <TW>
            <thead><tr><Th>수탁자</Th><Th>위탁 업무</Th><Th>데이터 소재지</Th></tr></thead>
            <tbody>
              <Tr cells={["Supabase Inc.", "데이터베이스 호스팅·인증 서비스", "서울 리전 (ap-northeast-2)"]} />
              <Tr cells={["비바리퍼블리카 (토스페이먼츠)", "결제 처리", "대한민국"]} />
              <Tr cells={["Vercel Inc.", "웹 호스팅·CDN", "글로벌 Edge (한국 포함)"]} />
              <Tr cells={["Upstash Inc.", "서비스 보안 (Rate Limiting)", "글로벌 Edge"]} />
            </tbody>
          </TW>
        </S>

        <S title="제5조 (행태정보 처리)">
          회사는 이용자의 <strong style={{ color: "#F1F5F9" }}>별도 동의를 받은 경우에만</strong> 행태정보를 수집합니다.
          동의하지 않은 경우 행태정보는 일체 수집되지 않으며, 서비스 이용에 어떠한 제한도 없습니다.
          동의는 언제든지 프로필 설정에서 철회할 수 있으며, 철회 즉시 수집이 중단됩니다.
          이미 수집된 행태정보는 철회 시점부터 30일 이내에 파기됩니다.
        </S>

        <S title="제6조 (회원 탈퇴 및 개인정보 파기)">
          회원은 언제든지 탈퇴를 요청할 수 있습니다. 탈퇴 후 개인정보는 다음과 같이 처리됩니다:
          <br /><br />
          • <strong style={{ color: "#F1F5F9" }}>탈퇴 후 30일간:</strong> 오인 탈퇴 복구를 위해 계정 정보를 암호화하여 보관합니다. 이 기간에는 재가입 시 기존 데이터를 복구할 수 있습니다.
          <br />
          • <strong style={{ color: "#F1F5F9" }}>30일 경과 후:</strong> 모든 개인정보를 지체 없이 파기합니다.
          <br />
          • <strong style={{ color: "#F1F5F9" }}>법령에 의한 예외:</strong> 전자상거래법에 따른 거래 기록(5년), 전자금융거래법에 따른 결제 기록(5년)은 해당 기간 보관 후 파기합니다.
          <br />
          • 게시글·댓글은 탈퇴 후에도 커뮤니티에 남을 수 있으나, 작성자 정보는 &ldquo;탈퇴한 사용자&rdquo;로 익명화됩니다.
        </S>

        <S title="제7조 (이용자의 권리)">
          이용자는 언제든지 자신의 개인정보에 대해 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다.
          요청은 서비스 내 설정 메뉴 또는 privacy@kadeora.com으로 접수 가능하며, 영업일 기준 10일 이내에 처리됩니다.
        </S>

        <S title="제8조 (개인정보 보호책임자)">
          개인정보 보호책임자: 카더라 법무팀<br />
          문의: privacy@kadeora.com
        </S>

        <S title="제9조 (개인정보 침해 신고)">
          • 개인정보침해신고센터 (privacy.kisa.or.kr / 118)<br />
          • 개인정보분쟁조정위원회 (kopico.go.kr / 1833-6972)<br />
          • 대검찰청 사이버수사과 (spo.go.kr / 1301)
        </S>
      </div>
    </div>
  );
}

function S({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 32 }}><h2 style={{ fontSize: 16, fontWeight: 700, color: "#E2E8F0", margin: "0 0 12px" }}>{title}</h2><div>{children}</div></div>;
}
function TW({ children }: { children: React.ReactNode }) {
  return <div style={{ overflowX: "auto", marginTop: 12 }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>{children}</table></div>;
}
function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#94A3B8", borderBottom: "1px solid #1E293B", background: "rgba(255,255,255,0.02)", whiteSpace: "nowrap" }}>{children}</th>;
}
function Tr({ cells }: { cells: string[] }) {
  return <tr>{cells.map((c, i) => <td key={i} style={{ padding: "10px 12px", color: "#CBD5E1", borderBottom: "1px solid #111827", verticalAlign: "top" }}>{c}</td>)}</tr>;
}
