import type { Metadata } from 'next';
import JsonLd from '@/components/seo/JsonLd';

export const metadata: Metadata = {};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
        <JsonLd data={{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"시가총액 상위 종목은 어디서 보나요?","acceptedAnswer":{"@type":"Answer","text":"카더라 주식 > 시장별 페이지에서 코스피, 코스닥, NYSE, NASDAQ별 시가총액 상위 종목을 확인할 수 있습니다."}}]}} />
      {children}
    </>
  );
}
