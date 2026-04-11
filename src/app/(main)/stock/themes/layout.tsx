import type { Metadata } from 'next';

export const metadata: Metadata = {};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"테마주란 무엇인가요?","acceptedAnswer":{"@type":"Answer","text":"테마주는 특정 이슈나 산업 트렌드에 따라 묶이는 종목군입니다. 반도체, 2차전지, AI, 방산 등 시장 관심사에 따라 테마가 형성됩니다."}},{"@type":"Question","name":"카더라에서 테마별 종목은 어떻게 확인하나요?","acceptedAnswer":{"@type":"Answer","text":"카더라 주식 > 테마별 동향 페이지에서 국내외 주요 테마별 종목 목록, 등락률을 확인할 수 있습니다."}}]}) }} />
      {children}
    </>
  );
}
