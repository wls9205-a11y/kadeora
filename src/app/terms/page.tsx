import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: SITE_URL + '/terms' },
  robots: { index: false, follow: true },
  title: '이용약관',
  description: '카더라 서비스 이용약관',
};

export default function TermsPage() {
  const sections = [
    ['제1조 (목적)', '이 약관은 카더라(이하 "서비스")가 제공하는 금융정보 커뮤니티 서비스의 이용과 관련하여 회원과 서비스 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.'],
    ['제2조 (서비스 내용)', '서비스는 주식, 부동산, 청약 등 금융·경제 관련 정보를 공유하는 커뮤니티 플랫폼입니다. 회원은 게시글 작성, 댓글, 좋아요, 실시간 토론방 참여, 종목토론 등의 기능을 이용할 수 있습니다.'],
    ['제3조 (회원가입 및 계정)', '회원가입은 소셜 로그인(Google, Kakao 등)을 통해 이루어지며, 1인 1계정을 원칙으로 합니다. 회원은 본인 정보를 정확하게 제공해야 하며, 허위 정보로 인한 불이익에 대해 서비스는 책임지지 않습니다.'],
    ['제4조 (금지 행위)', '다음 행위는 엄격히 금지되며 위반 시 사전 경고 없이 이용 정지 또는 계정 삭제 조치가 취해질 수 있습니다.\n• 허위 투자 정보 유포 또는 시세 조작성 게시물 작성\n• 특정 종목 매수·매도를 유도하는 리딩 행위\n• 타인 비방, 욕설, 혐오 표현, 개인정보 유출\n• 스팸, 광고, 도배성 게시물 작성\n• 서비스 운영을 방해하는 해킹, 크롤링 등의 기술적 행위'],
    ['제5조 (투자 책임 면책)', '서비스에 게시된 모든 정보(게시글, 댓글, 토론 내용, 시세 데이터 등)는 참고 자료일 뿐이며, 투자 권유, 재무 자문, 또는 매매 추천이 아닙니다. 투자에 따른 손실을 포함한 모든 결과는 전적으로 이용자 본인의 판단과 책임 하에 이루어집니다. 서비스는 이용자의 투자 결정으로 인한 어떠한 손실이나 손해에 대해서도 법적 책임을 지지 않습니다.'],
    ['제6조 (시세 데이터 면책)', '서비스에서 제공하는 주식 시세, 부동산 청약 정보 등은 외부 데이터 소스(금융위원회 공공데이터, 공공데이터포털 등)를 기반으로 하며, 실시간성과 정확성을 보장하지 않습니다. 데이터 지연, 오류, 누락으로 인한 손해에 대해 서비스는 책임지지 않습니다.'],
    ['제7조 (게시물 권리 및 관리)', '회원이 작성한 게시물의 저작권은 작성자에게 있으며, 서비스는 운영 목적상 게시물을 노출, 검색, 추천에 활용할 수 있습니다. 서비스는 약관 위반, 법령 위반, 신고 접수 등의 사유로 게시물을 비공개 처리하거나 삭제할 수 있습니다.'],
    ['제8조 (서비스 변경 및 중단)', '서비스는 운영상, 기술상의 필요에 따라 서비스 내용을 변경하거나 일시적으로 중단할 수 있으며, 이 경우 사전에 공지합니다. 다만, 천재지변 등 불가항력적 사유가 있는 경우 사전 공지 없이 중단될 수 있습니다.'],
    ['제9조 (개인정보 보호)', '서비스는 회원의 개인정보를 관련 법령에 따라 보호하며, 자세한 사항은 개인정보처리방침에서 확인할 수 있습니다.'],
    ['제10조 (유료 서비스 및 환불)', '서비스는 게시글 상단 노출권(확성기), 프리미엄 뱃지 등 유료 디지털 부가서비스를 제공합니다. 유료 서비스는 결제 즉시 적용되는 무형의 디지털 콘텐츠이며, 이용 개시 후에는 전자상거래 등에서의 소비자보호에 관한 법률 제17조 제2항에 따라 청약철회가 제한됩니다. 서비스 장애 등 서비스 제공자의 귀책사유가 있는 경우에는 환불이 가능합니다. 자세한 환불 정책은 별도의 환불정책 페이지를 참고해 주세요.'],
    ['제11조 (약관 변경)', '서비스는 필요한 경우 이 약관을 변경할 수 있으며, 변경된 약관은 적용 7일 전에 서비스 내 공지를 통해 안내합니다. 회원이 변경된 약관에 동의하지 않는 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.'],
  ];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 16px' }}>
      <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)' }}>이용약관</h1>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', marginBottom: 32 }}>최종 수정일: 2026년 3월 24일</p>
      {sections.map(([title, content]) => (
        <div key={title} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)' }}>{title}</h2>
          <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-line' }}>{content}</p>
        </div>
      ))}
      <div style={{ marginTop: 40, padding: '16px 20px', borderRadius: 'var(--radius-card)', backgroundColor: 'var(--bg-sunken)', border: '1px solid var(--border)' }}>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', lineHeight: 1.7, margin: 0 }}>
          본 약관에 대한 문의는 서비스 내 고객센터를 이용해 주시기 바랍니다.
        </p>
      </div>
      <div style={{ marginTop: 24, padding: '16px 20px', borderRadius: 'var(--radius-card)', backgroundColor: 'var(--bg-sunken)', border: '1px solid var(--border)' }}>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', lineHeight: 1.7, margin: 0 }}>
          본 약관과 관련된 분쟁은 서울중앙지방법원을 제1심 관할법원으로 합니다.
        </p>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', lineHeight: 1.7, margin: '8px 0 0' }}>
          본 약관은 대한민국 법령에 따라 해석되고 적용됩니다.
        </p>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', lineHeight: 1.7, margin: '8px 0 0' }}>
          주식: 금융위원회 공공데이터 API(data.go.kr) · 청약: 공공데이터포털(data.go.kr) · 실거래: 국토교통부
        </p>
      </div>
    </div>
  );
}
