import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '자주 묻는 질문',
  description: '카더라 서비스 이용 관련 자주 묻는 질문과 답변',
};

const faqLd = {
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: '카더라는 어떤 서비스인가요?', acceptedAnswer: { '@type': 'Answer', text: '카더라는 주식 시세, 아파트 청약, 실거래가, 커뮤니티를 하나의 앱에서 제공하는 대한민국 소리소문 정보 커뮤니티입니다.' } },
    { '@type': 'Question', name: '카더라는 무료인가요?', acceptedAnswer: { '@type': 'Answer', text: '네, 카더라의 모든 기본 기능은 무료입니다. 주식 시세, 부동산 정보, 블로그, 계산기 등을 무료로 이용할 수 있습니다.' } },
    { '@type': 'Question', name: '카더라 앱은 어디서 설치하나요?', acceptedAnswer: { '@type': 'Answer', text: '카더라는 PWA(프로그레시브 웹 앱)로, kadeora.app에 접속한 뒤 브라우저의 홈 화면 추가 기능으로 설치할 수 있습니다.' } },
  ],
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      {children}
    </>
  );
}
