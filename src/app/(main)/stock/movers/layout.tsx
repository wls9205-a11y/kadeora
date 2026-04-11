import type { Metadata } from 'next';

export const metadata: Metadata = {};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"오늘 급등주는 어떻게 확인하나요?","acceptedAnswer":{"@type":"Answer","text":"카더라 주식 > 급등락 페이지에서 코스피, 코스닥, NYSE, NASDAQ 시장별 상승률·하락률 상위 종목을 확인할 수 있습니다."}}]}) }} />
      {children}
    </>
  );
}
