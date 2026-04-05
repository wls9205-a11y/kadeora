'use client';
/**
 * BlogReadGate v3 — 100% 콘텐츠 공개
 *
 * 변경 이력:
 * v1: 하루 3편 무료, 4편째부터 잘림
 * v2: 비로그인 항상 60% 잘림 → 역효과 (97.9% 바운스)
 * v3: 100% 공개 → SmartSectionGate로 핵심 섹션만 블러
 *
 * 근거: 브랜드 인지도 0인 상태에서 콘텐츠 게이팅은 이탈만 증가
 * 데이터: 60% 잘림 적용 후에도 전환율 0.13% → 게이팅이 전환을 유발하지 않음
 */
import SmartSectionGate from '@/components/SmartSectionGate';

interface BlogReadGateProps {
  htmlFull: string;
  htmlTruncated: string;
  slug: string;
  category: string;
}

export default function BlogReadGate({ htmlFull, slug, category }: BlogReadGateProps) {
  // v3: 항상 전체 콘텐츠 표시 + SmartSectionGate로 핵심 섹션만 블러
  return <SmartSectionGate htmlContent={htmlFull} slug={slug} category={category} />;
}
