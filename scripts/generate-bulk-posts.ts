/**
 * s170 — 162편 블로그 일괄 생성 (Node 로컬 실행).
 *
 * 사전 요구:
 *   - .env.local 에 ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   - blog_publish_config.daily_create_limit 확인 (기본 80, 162 생성 시 DB UPDATE 필요)
 *
 * 실행:
 *   npx tsx scripts/generate-bulk-posts.ts
 *   npx tsx scripts/generate-bulk-posts.ts --dry-run
 *   npx tsx scripts/generate-bulk-posts.ts --from 50 --to 100   # 인덱스 범위
 *
 * 주의:
 *   - safeBlogInsert 경유 (pg_trgm 유사도 + 일일 한도 + 콘텐츠 길이 게이트 전부 통과)
 *   - category 는 'stock'|'apt'|'unsold'|'finance'|'general' 중 자동 매핑
 *   - Anthropic Batch API 아닌 단건 messages.create 직렬 5 병렬
 *   - 에러시 해당 topic 스킵 + 다음 진행 (멈추지 않음)
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { safeBlogInsert } from '../src/lib/blog-safe-insert';

type Topic = {
  idx: number;
  group: string;
  title: string;
  tags: string[];
  category: 'stock' | 'apt' | 'unsold' | 'finance' | 'general';
};

const TOPICS: Topic[] = [
  // A. 부동산정책 (13)
  { idx: 1, group: 'A', title: '2026 다주택자 양도세 중과 유예 종료 총정리', tags: ['양도세','다주택자','중과유예','5월9일','부동산세금'], category: 'apt' },
  { idx: 2, group: 'A', title: '양도세 중과 부활 전 매도 vs 보유 시뮬레이션', tags: ['양도세','매도전략','보유전략','세금시뮬레이션'], category: 'apt' },
  { idx: 3, group: 'A', title: '5월 9일 전 급매 전략 — 강남3구·용산 규제지역', tags: ['급매','강남','용산','규제지역','매도타이밍'], category: 'apt' },
  { idx: 4, group: 'A', title: '임대사업자 8년 자동말소, 2026 종부세 대비법', tags: ['임대사업자','말소','종부세','2026세금'], category: 'apt' },
  { idx: 5, group: 'A', title: '양도세 vs 증여세 비교 시뮬레이션', tags: ['양도세','증여세','세금비교','절세전략'], category: 'finance' },
  { idx: 6, group: 'A', title: '가계약 5월 9일 전이면 혜택 받나 — 잔금 기준 실무 Q&A', tags: ['양도세','가계약','잔금기준','실무'], category: 'apt' },
  { idx: 7, group: 'A', title: '규제지역 3종 세트 동시 지정 리스크 분석', tags: ['규제지역','투기과열지구','토지거래허가'], category: 'apt' },
  { idx: 8, group: 'A', title: '2026 지방선거 부동산 공약 비교 분석', tags: ['지방선거','부동산공약','정책비교'], category: 'apt' },
  { idx: 9, group: 'A', title: '지방선거 후 세제개편 시나리오 3가지', tags: ['세제개편','보유세','거래세','지방선거'], category: 'apt' },
  { idx: 10, group: 'A', title: '보유세 인상 vs 거래세 인하 — 현실 가능성 분석', tags: ['보유세','거래세','세제개편','부동산정책'], category: 'apt' },
  { idx: 11, group: 'A', title: '비거주 1주택자 보유세 강화 대응 전략', tags: ['1주택자','보유세','실거주','비거주'], category: 'apt' },
  { idx: 12, group: 'A', title: '총자산 합산과세 체계 전환 시 영향 분석', tags: ['합산과세','다주택자','세제개편'], category: 'apt' },
  { idx: 13, group: 'A', title: '토지거래허가구역 2026년말 종료 연장 전망', tags: ['토지거래허가','규제지역','실거주의무'], category: 'apt' },

  // B. 분양/청약 — 서울 12 + 수도권 6 + 부산경남 10 + 지방광역시 6 + 청약가이드 6 = 40건
  { idx: 14, group: 'B', title: '오티에르반포 청약 분석 — 반포 재건축 랜드마크', tags: ['오티에르반포','반포','재건축','서울청약'], category: 'apt' },
  { idx: 15, group: 'B', title: '라클라체자이드파인 분양 총정리', tags: ['라클라체','자이','서울청약','분양가'], category: 'apt' },
  { idx: 16, group: 'B', title: '아크로리버스카이 청약 전략', tags: ['아크로리버스카이','서울청약','한강뷰'], category: 'apt' },
  { idx: 17, group: 'B', title: '동작센트럴 분양 입지 분석', tags: ['동작센트럴','동작구','서울청약'], category: 'apt' },
  { idx: 18, group: 'B', title: '장위푸르지오 청약 경쟁률 예측', tags: ['장위푸르지오','푸르지오','서울청약'], category: 'apt' },
  { idx: 19, group: 'B', title: '써밋더힐 분양 총정리', tags: ['써밋더힐','서울청약'], category: 'apt' },
  { idx: 20, group: 'B', title: '더리치먼드미아 청약 분석', tags: ['리치먼드미아','미아','서울청약'], category: 'apt' },
  { idx: 21, group: 'B', title: '월계중흥S 분양 조건 정리', tags: ['월계중흥S','노원','서울청약'], category: 'apt' },
  { idx: 22, group: 'B', title: '덕수궁롯데캐슬 입주 전 체크리스트', tags: ['덕수궁롯데캐슬','중구','입주'], category: 'apt' },
  { idx: 23, group: 'B', title: '더샵신길 청약 가점 전략', tags: ['더샵신길','영등포','서울청약'], category: 'apt' },
  { idx: 24, group: 'B', title: '이촌르엘 분양가 경쟁력 분석', tags: ['이촌르엘','용산','서울청약'], category: 'apt' },
  { idx: 25, group: 'B', title: '아크로드서초 청약 가이드', tags: ['아크로드서초','서초','서울청약'], category: 'apt' },
  { idx: 26, group: 'B', title: 'e편한세상 부천 청약 정보', tags: ['e편한세상','부천','수도권청약'], category: 'apt' },
  { idx: 27, group: 'B', title: '드파인 연희 분양 총정리', tags: ['드파인','연희','서울청약'], category: 'apt' },
  { idx: 28, group: 'B', title: '3기 신도시 청약 일정 총정리', tags: ['3기신도시','공공분양','사전청약'], category: 'apt' },
  { idx: 29, group: 'B', title: '평택 고덕 청약 분석', tags: ['평택','고덕','수도권청약'], category: 'apt' },
  { idx: 30, group: 'B', title: '고덕강일 청약 정보', tags: ['고덕강일','강동','서울청약'], category: 'apt' },
  { idx: 31, group: 'B', title: '검암 역세권 청약 분석', tags: ['검암','역세권','인천'], category: 'apt' },
  { idx: 32, group: 'B', title: '해운대 센텀 분양 정보', tags: ['해운대센텀','부산','해운대'], category: 'apt' },
  { idx: 33, group: 'B', title: '창원 자이 49층 청약 분석', tags: ['창원자이','자이','창원'], category: 'apt' },
  { idx: 34, group: 'B', title: '엘리프 창원 분양 총정리', tags: ['엘리프','창원','분양'], category: 'apt' },
  { idx: 35, group: 'B', title: '포레힐스데시앙 분양 정보', tags: ['포레힐스데시앙','분양'], category: 'apt' },
  { idx: 36, group: 'B', title: '명지 3단계 청약 전략', tags: ['명지','부산','청약'], category: 'apt' },
  { idx: 37, group: 'B', title: '가덕도 신공항 수혜 단지 분석', tags: ['가덕도','신공항','부산수혜'], category: 'apt' },
  { idx: 38, group: 'B', title: '부산 미분양 TOP 10 분석', tags: ['부산','미분양','매수기회'], category: 'unsold' },
  { idx: 39, group: 'B', title: '부산 전세 시세 흐름', tags: ['부산','전세','임대시장'], category: 'apt' },
  { idx: 40, group: 'B', title: '부산 재개발 사업 현황', tags: ['부산','재개발','정비사업'], category: 'apt' },
  { idx: 41, group: 'B', title: '거제·통영 분양 정보', tags: ['거제','통영','경남'], category: 'apt' },
  { idx: 42, group: 'B', title: '대구 청약 시장 총정리', tags: ['대구','청약','지방청약'], category: 'apt' },
  { idx: 43, group: 'B', title: '광주 분양 정보', tags: ['광주','분양','호남'], category: 'apt' },
  { idx: 44, group: 'B', title: '세종 청약 전략', tags: ['세종','공공분양','청약'], category: 'apt' },
  { idx: 45, group: 'B', title: '대전 분양 시장 분석', tags: ['대전','분양','충청'], category: 'apt' },
  { idx: 46, group: 'B', title: '울산 분양 정보', tags: ['울산','분양','동남권'], category: 'apt' },
  { idx: 47, group: 'B', title: '인구감소지역 특례 분양 가이드', tags: ['인구감소','특례분양','세제혜택'], category: 'apt' },
  { idx: 48, group: 'B', title: '무순위 줍줍 청약 완전정복', tags: ['무순위','줍줍','청약실무'], category: 'apt' },
  { idx: 49, group: 'B', title: '상한제 로또 청약 기회 총정리', tags: ['분양가상한제','로또청약'], category: 'apt' },
  { idx: 50, group: 'B', title: '청약 가점 계산기 — 실전 사용법', tags: ['청약가점','계산기','무주택기간'], category: 'apt' },
  { idx: 51, group: 'B', title: '청약 자금 조달 계획 — 대출·자기자본 비율', tags: ['자금조달','청약','대출'], category: 'apt' },
  { idx: 52, group: 'B', title: '청약 포기의 불이익 — 당첨 후 계약 안하면?', tags: ['청약포기','부적격','재당첨제한'], category: 'apt' },
  { idx: 53, group: 'B', title: '특별공급 7종 완전정리', tags: ['특별공급','신혼부부','생애최초'], category: 'apt' },

  // C. 재건축/재개발 (23)
  { idx: 54, group: 'C', title: '압구정3구역 재건축 진행 현황', tags: ['압구정','재건축','강남'], category: 'apt' },
  { idx: 55, group: 'C', title: '압구정4구역 분석', tags: ['압구정','재건축','강남'], category: 'apt' },
  { idx: 56, group: 'C', title: '압구정5구역 사업성 평가', tags: ['압구정','재건축','강남'], category: 'apt' },
  { idx: 57, group: 'C', title: '송파 재건축 단지 TOP 5', tags: ['송파','재건축','강남권'], category: 'apt' },
  { idx: 58, group: 'C', title: '여의도 시범아파트 재건축 총정리', tags: ['여의도','시범아파트','재건축'], category: 'apt' },
  { idx: 59, group: 'C', title: '여의도 삼부아파트 재건축 현황', tags: ['여의도','삼부','재건축'], category: 'apt' },
  { idx: 60, group: 'C', title: '진주대교 아파트 재건축 분석', tags: ['진주','재건축','경남'], category: 'apt' },
  { idx: 61, group: 'C', title: '목동 14개 단지 재건축 총정리', tags: ['목동','재건축','양천'], category: 'apt' },
  { idx: 62, group: 'C', title: '노량진 재개발 사업 현황', tags: ['노량진','재개발','동작'], category: 'apt' },
  { idx: 63, group: 'C', title: '방배 재건축 단지 분석', tags: ['방배','재건축','서초'], category: 'apt' },
  { idx: 64, group: 'C', title: '성수 재개발 사업 총정리', tags: ['성수','재개발','성동'], category: 'apt' },
  { idx: 65, group: 'C', title: '강북 재건축·재개발 총정리', tags: ['강북','재건축','재개발'], category: 'apt' },
  { idx: 66, group: 'C', title: '흑석 재개발 사업 현황', tags: ['흑석','재개발','동작'], category: 'apt' },
  { idx: 67, group: 'C', title: '한남4 재개발 최신 동향', tags: ['한남4','재개발','용산'], category: 'apt' },
  { idx: 68, group: 'C', title: '분당 1기신도시 리모델링·재건축', tags: ['분당','1기신도시','리모델링'], category: 'apt' },
  { idx: 69, group: 'C', title: '일산·평촌·산본·중동 1기신도시 현황', tags: ['일산','평촌','산본','중동','1기신도시'], category: 'apt' },
  { idx: 70, group: 'C', title: '수지 재건축 단지 분석', tags: ['수지','재건축','용인'], category: 'apt' },
  { idx: 71, group: 'C', title: '광명 재건축 사업 현황', tags: ['광명','재건축','경기'], category: 'apt' },
  { idx: 72, group: 'C', title: '1기신도시 특별법 20조 시장 영향', tags: ['1기신도시','특별법','리모델링'], category: 'apt' },
  { idx: 73, group: 'C', title: '재건축 사업성 평가 방법', tags: ['재건축','사업성','비례율'], category: 'apt' },
  { idx: 74, group: 'C', title: '재건축 급매 진입 타이밍', tags: ['재건축','급매','진입타이밍'], category: 'apt' },
  { idx: 75, group: 'C', title: '입주권 vs 분양권 차이점 총정리', tags: ['입주권','분양권','재건축실무'], category: 'apt' },
  { idx: 76, group: 'C', title: '재건축 현금청산 대응 전략', tags: ['현금청산','재건축','보상'], category: 'apt' },

  // D. 실거래/시세/전세 (12)
  { idx: 77, group: 'D', title: '서울 61주 연속 상승 — 시세 흐름 분석', tags: ['서울','실거래가','상승'], category: 'apt' },
  { idx: 78, group: 'D', title: '강남3구 26억 돌파 — 신고가 트렌드', tags: ['강남3구','신고가','26억'], category: 'apt' },
  { idx: 79, group: 'D', title: '마용성 17억 — 상승 동력 분석', tags: ['마포','용산','성동','17억'], category: 'apt' },
  { idx: 80, group: 'D', title: '신축 프리미엄 — 입주 1년 단지 실거래', tags: ['신축','프리미엄','입주1년'], category: 'apt' },
  { idx: 81, group: 'D', title: '수도권 부동산 양극화 심화', tags: ['수도권','양극화','지역편차'], category: 'apt' },
  { idx: 82, group: 'D', title: '2027 공급절벽 — 착공 감소 데이터', tags: ['공급절벽','착공','2027'], category: 'apt' },
  { idx: 83, group: 'D', title: '전세 품귀 지역 TOP 10', tags: ['전세','품귀','임대시장'], category: 'apt' },
  { idx: 84, group: 'D', title: '월세 비중 60% 돌파 — 월세화 가속', tags: ['월세','월세화','임대구조'], category: 'apt' },
  { idx: 85, group: 'D', title: '토지거래허가 전세 시장 영향', tags: ['토지거래허가','전세','규제영향'], category: 'apt' },
  { idx: 86, group: 'D', title: '전월세 상한제 5% 룰 실무 가이드', tags: ['전월세상한제','5%','임대차3법'], category: 'apt' },
  { idx: 87, group: 'D', title: '전국 미분양 현황 총정리', tags: ['미분양','전국','현황'], category: 'unsold' },
  { idx: 88, group: 'D', title: '준공 후 미분양 — 할인분양 기회', tags: ['준공후미분양','할인분양','매수'], category: 'unsold' },

  // E. 대출/자금조달 (8)
  { idx: 89, group: 'E', title: 'DSR 3단계 규제 완전정리', tags: ['DSR','3단계','대출규제'], category: 'finance' },
  { idx: 90, group: 'E', title: '주담대 금리 시뮬레이션 — 구간별 이자 비교', tags: ['주담대','금리','시뮬레이션'], category: 'finance' },
  { idx: 91, group: 'E', title: '전세대출 DSR 포함 변화', tags: ['전세대출','DSR','포함여부'], category: 'finance' },
  { idx: 92, group: 'E', title: '만기연장 금지 — 대출 상환 전략', tags: ['만기연장','대출상환','DSR'], category: 'finance' },
  { idx: 93, group: 'E', title: '위험가중치 상향 — 은행 대출 여력', tags: ['위험가중치','BIS비율','대출여력'], category: 'finance' },
  { idx: 94, group: 'E', title: '중도금 대출 축소 — 청약 자금 전략', tags: ['중도금','대출축소','자금조달'], category: 'finance' },
  { idx: 95, group: 'E', title: '디딤돌·보금자리 대출 완전정리', tags: ['디딤돌','보금자리','정책대출'], category: 'finance' },
  { idx: 96, group: 'E', title: '신혼부부 특례대출 2026', tags: ['신혼특례','정책대출','2026'], category: 'finance' },

  // F. 수익형부동산 (12)
  { idx: 97, group: 'F', title: '오피스텔 입주 절벽 — 2026 공급 분석', tags: ['오피스텔','입주절벽','공급'], category: 'apt' },
  { idx: 98, group: 'F', title: '역세권 오피스텔 수익률 TOP', tags: ['역세권','오피스텔','수익률'], category: 'apt' },
  { idx: 99, group: 'F', title: '코리빙 시장 현황', tags: ['코리빙','공유주거','수익형'], category: 'apt' },
  { idx: 100, group: 'F', title: '오피스텔 주택수 포함 여부 총정리', tags: ['오피스텔','주택수','세제'], category: 'finance' },
  { idx: 101, group: 'F', title: '꼬마빌딩 투자 가이드', tags: ['꼬마빌딩','수익형','상업용'], category: 'finance' },
  { idx: 102, group: 'F', title: '상가 투자 체크리스트', tags: ['상가','투자','임대수익'], category: 'finance' },
  { idx: 103, group: 'F', title: '상가 유형별 수익률 비교', tags: ['상가','수익률','비교'], category: 'finance' },
  { idx: 104, group: 'F', title: '상가 임대차 보호법 실무', tags: ['상가임대차','보호법','실무'], category: 'finance' },
  { idx: 105, group: 'F', title: '지식산업센터 투자 분석', tags: ['지식산업센터','아파트형공장','수익형'], category: 'finance' },
  { idx: 106, group: 'F', title: '물류센터 투자 기회', tags: ['물류센터','이커머스','수익형'], category: 'finance' },
  { idx: 107, group: 'F', title: '데이터센터 부동산 트렌드', tags: ['데이터센터','AI','부동산투자'], category: 'finance' },
  { idx: 108, group: 'F', title: '호텔·리빙 투자 시장', tags: ['호텔','리빙','수익형'], category: 'finance' },

  // G. 경매/토지 (8)
  { idx: 109, group: 'G', title: '경매 초보 가이드 — 입찰부터 낙찰까지', tags: ['경매','초보','입찰'], category: 'finance' },
  { idx: 110, group: 'G', title: '경매 권리분석 완벽 가이드', tags: ['경매','권리분석','말소기준권리'], category: 'finance' },
  { idx: 111, group: 'G', title: 'NPL 투자 가이드 — 부실채권 수익', tags: ['NPL','부실채권','투자'], category: 'finance' },
  { idx: 112, group: 'G', title: '토지 투자 — 용도지역 총정리', tags: ['토지투자','용도지역','지목'], category: 'finance' },
  { idx: 113, group: 'G', title: '인구감소지역 토지 투자 전략', tags: ['인구감소','토지','투자'], category: 'finance' },
  { idx: 114, group: 'G', title: '임야 투자 — 산지 개발 가능성', tags: ['임야','산지','토지투자'], category: 'finance' },
  { idx: 115, group: 'G', title: '빌라 월세 입주권 전략', tags: ['빌라','월세','입주권'], category: 'apt' },
  { idx: 116, group: 'G', title: 'PF 부실 경매 — 할인 매물 분석', tags: ['PF','부실','경매할인'], category: 'finance' },

  // H. 주식 (21)
  { idx: 117, group: 'H', title: 'AI 반도체 테마 총정리', tags: ['AI','반도체','HBM'], category: 'stock' },
  { idx: 118, group: 'H', title: '원전 테마주 랠리 분석', tags: ['원전','SMR','두산에너빌리티'], category: 'stock' },
  { idx: 119, group: 'H', title: '광통신 테마주 — 인프라 수혜', tags: ['광통신','5G','인프라'], category: 'stock' },
  { idx: 120, group: 'H', title: '태양광 테마 — 글로벌 수요', tags: ['태양광','신재생','한화솔루션'], category: 'stock' },
  { idx: 121, group: 'H', title: '로봇 테마주 현황', tags: ['로봇','자동화','두산로보틱스'], category: 'stock' },
  { idx: 122, group: 'H', title: '코스피 76% 상승 — 구조적 요인 분석', tags: ['코스피','상승','구조적'], category: 'stock' },
  { idx: 123, group: 'H', title: '밸류업 프로그램 수혜주 TOP', tags: ['밸류업','배당','주주환원'], category: 'stock' },
  { idx: 124, group: 'H', title: '건설주 전망 — 실적 회복 신호', tags: ['건설주','실적','회복'], category: 'stock' },
  { idx: 125, group: 'H', title: 'PF 리스크 건설주 영향', tags: ['PF','건설주','리스크'], category: 'stock' },
  { idx: 126, group: 'H', title: '정비사업 80조 수혜주 정리', tags: ['정비사업','80조','건설주'], category: 'stock' },
  { idx: 127, group: 'H', title: '2차전지 테마 — 밸류에이션 분석', tags: ['2차전지','배터리','LG에너지솔루션'], category: 'stock' },
  { idx: 128, group: 'H', title: '바이오 섹터 — 2026 전망', tags: ['바이오','2026','전망'], category: 'stock' },
  { idx: 129, group: 'H', title: '방산·조선 테마주 랠리', tags: ['방산','조선','수출'], category: 'stock' },
  { idx: 130, group: 'H', title: '지방선거 테마주 분석', tags: ['지방선거','정치테마','단기'], category: 'stock' },
  { idx: 131, group: 'H', title: 'ETF 완전정복 — 종류와 선택법', tags: ['ETF','인덱스펀드','투자'], category: 'stock' },
  { idx: 132, group: 'H', title: '외국인 자금 흐름 읽기', tags: ['외국인','수급','매매동향'], category: 'stock' },
  { idx: 133, group: 'H', title: '공모주 IPO 투자 전략', tags: ['공모주','IPO','청약'], category: 'stock' },
  { idx: 134, group: 'H', title: '미국 vs 한국 주식 투자 비교', tags: ['미국주식','한국주식','비교'], category: 'stock' },
  { idx: 135, group: 'H', title: '배당 분리과세 — 절세 전략', tags: ['배당','분리과세','절세'], category: 'stock' },
  { idx: 136, group: 'H', title: '배당주 순위 TOP 20', tags: ['배당주','순위','고배당'], category: 'stock' },
  { idx: 137, group: 'H', title: '배당 등급별 투자 가이드', tags: ['배당등급','투자전략','안정성'], category: 'stock' },

  // I. 재테크/절세 (13)
  { idx: 138, group: 'I', title: 'ISA 개편 2026 — 한도·세제 변화', tags: ['ISA','개편','세제'], category: 'finance' },
  { idx: 139, group: 'I', title: '청년 ISA 완전정리', tags: ['청년ISA','세제혜택','만기'], category: 'finance' },
  { idx: 140, group: 'I', title: 'ISA 증권사 비교 — 수수료와 상품', tags: ['ISA','증권사','수수료'], category: 'finance' },
  { idx: 141, group: 'I', title: 'ISA vs 연금저축 — 어느 게 유리한가', tags: ['ISA','연금저축','비교'], category: 'finance' },
  { idx: 142, group: 'I', title: '배당 분리과세 활용 가이드', tags: ['배당','분리과세','절세'], category: 'finance' },
  { idx: 143, group: 'I', title: '금 투자 — 실물·ETF·펀드 비교', tags: ['금투자','KRX','ETF'], category: 'finance' },
  { idx: 144, group: 'I', title: '비트코인 과세 — 2027 시행', tags: ['비트코인','가상자산','과세'], category: 'finance' },
  { idx: 145, group: 'I', title: '리츠 투자 가이드 — 국내외 비교', tags: ['리츠','REITs','부동산투자'], category: 'finance' },
  { idx: 146, group: 'I', title: '부동산 펀드 종류와 수익률', tags: ['부동산펀드','수익률','분산투자'], category: 'finance' },
  { idx: 147, group: 'I', title: '공동명의 세금 절세 전략', tags: ['공동명의','절세','부부'], category: 'finance' },
  { idx: 148, group: 'I', title: '증여세 계산기 실전 사용법', tags: ['증여세','계산기','공제'], category: 'finance' },
  { idx: 149, group: 'I', title: '종합소득세 신고 가이드', tags: ['종소세','신고','5월'], category: 'finance' },
  { idx: 150, group: 'I', title: '근로장려금 신청 가이드', tags: ['근로장려금','신청','자격'], category: 'finance' },

  // J. 생활정보 (12)
  { idx: 151, group: 'J', title: '신축 입주 체크리스트 총정리', tags: ['입주','체크리스트','신축'], category: 'general' },
  { idx: 152, group: 'J', title: '하자보수 신청 실무 가이드', tags: ['하자보수','신청','AS'], category: 'general' },
  { idx: 153, group: 'J', title: '인테리어 평당 비용 총정리', tags: ['인테리어','평당비용','공사'], category: 'general' },
  { idx: 154, group: 'J', title: '이사 체크리스트 — 14일 전부터', tags: ['이사','체크리스트','이사업체'], category: 'general' },
  { idx: 155, group: 'J', title: '전세사기 예방 — 등기부 확인법', tags: ['전세사기','예방','등기부'], category: 'general' },
  { idx: 156, group: 'J', title: '중개수수료 완전정리 — 법정요율', tags: ['중개수수료','법정요율','계산'], category: 'general' },
  { idx: 157, group: 'J', title: '셀프 등기 이전 가이드', tags: ['셀프등기','등기이전','비용'], category: 'general' },
  { idx: 158, group: 'J', title: '취득세 계산기 실전 사용', tags: ['취득세','계산기','다주택'], category: 'general' },
  { idx: 159, group: 'J', title: '재산세·종부세 가이드', tags: ['재산세','종부세','6월1일'], category: 'general' },
  { idx: 160, group: 'J', title: '귀농·귀촌 지원 총정리', tags: ['귀농','귀촌','지원금'], category: 'general' },
  { idx: 161, group: 'J', title: '관리비 절약 10가지', tags: ['관리비','절약','난방비'], category: 'general' },
  { idx: 162, group: 'J', title: '신혼부부 주거 로드맵 — 3년 계획', tags: ['신혼','주거','로드맵'], category: 'general' },
];

function slugify(title: string, idx: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^\w\s가-힣-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return `s170-${String(idx).padStart(3, '0')}-${base}`;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const fromI = argv.indexOf('--from');
  const toI = argv.indexOf('--to');
  const from = fromI >= 0 ? parseInt(argv[fromI + 1] || '0', 10) : 0;
  const to = toI >= 0 ? parseInt(argv[toI + 1] || String(TOPICS.length), 10) : TOPICS.length;
  return { dryRun, from, to };
}

async function generateContent(ai: Anthropic, topic: Topic): Promise<{ content: string; excerpt: string; tldr: string }> {
  const tagStr = topic.tags.join(', ');
  const prompt = `당신은 카더라 블로그의 전문 에디터입니다. 다음 주제로 한국어 블로그 포스트를 작성하세요.

제목: ${topic.title}
카테고리: ${topic.category}
태그: ${tagStr}
분량: 2,200~2,800자 (min_content_length=2000 필수 통과)

작성 규칙:
1. 마크다운 형식 (H2/H3, 리스트, 굵은 글씨 활용)
2. 첫 문단에 3~4줄 요약 (TL;DR 역할)
3. 본문 4~6개 H2 섹션, 각 섹션 300~500자
4. 실제 데이터·수치·법령 인용 (2026년 기준)
5. 투자 조언 금지 — 정보 전달 중심
6. 결론 섹션에 핵심 3~5줄 요약
7. FAQ 3~4개를 "## 자주 묻는 질문" H2 아래 배치
8. 각 H3 제목은 "Q." 로 시작, 답변 2~3줄

응답 형식 (엄격):
---TLDR---
(3줄 이내 요약)
---EXCERPT---
(1~2문장 본문 요약, 메타 디스크립션용 120자 이내)
---CONTENT---
(전체 마크다운 본문)`;

  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n');

  const tldrMatch = text.match(/---TLDR---\s*([\s\S]*?)\s*---EXCERPT---/);
  const excerptMatch = text.match(/---EXCERPT---\s*([\s\S]*?)\s*---CONTENT---/);
  const contentMatch = text.match(/---CONTENT---\s*([\s\S]*)$/);

  const tldr = (tldrMatch?.[1] || '').trim();
  const excerpt = (excerptMatch?.[1] || '').trim().slice(0, 160);
  const content = (contentMatch?.[1] || text).trim();

  if (content.length < 2000) {
    throw new Error(`content_too_short: ${content.length} chars`);
  }

  return { content, excerpt, tldr };
}

async function processOne(ai: Anthropic, admin: SupabaseClient, topic: Topic, dryRun: boolean) {
  try {
    const { content, excerpt, tldr } = await generateContent(ai, topic);
    const slug = slugify(topic.title, topic.idx);

    if (dryRun) {
      console.log(`[DRY] ${topic.idx.toString().padStart(3, '0')} ${topic.group} ${topic.title} — ${content.length}c`);
      return { ok: true, reason: 'dry_run' };
    }

    const result = await safeBlogInsert(admin, {
      slug,
      title: topic.title,
      content,
      excerpt,
      category: topic.category,
      tags: topic.tags,
      meta_description: excerpt,
      source_type: 'auto',
      source_ref: 's170-bulk',
    } as any);

    if (!result.success) {
      console.log(`[SKIP] ${topic.idx} ${topic.title} — ${result.reason}${result.reason === 'similar_title' ? ' → ' + (result as any).similarTo : ''}`);
      return { ok: false, reason: result.reason };
    }

    console.log(`[OK ] ${topic.idx.toString().padStart(3, '0')} ${topic.title} — id=${result.id}`);
    return { ok: true, id: result.id };
  } catch (e: any) {
    console.log(`[ERR] ${topic.idx} ${topic.title} — ${e?.message || e}`);
    return { ok: false, reason: 'exception' };
  }
}

async function main() {
  const { dryRun, from, to } = parseArgs();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !supaUrl || !supaKey) {
    console.error('Missing env: ANTHROPIC_API_KEY / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const ai = new Anthropic({ apiKey });
  const admin = createClient(supaUrl, supaKey, { auth: { persistSession: false } });

  const slice = TOPICS.slice(from, to);
  console.log(`Processing ${slice.length} topics (${from}..${to - 1})${dryRun ? ' [DRY-RUN]' : ''}`);

  const stats = { ok: 0, skipped: 0, failed: 0 };
  const CONCURRENCY = 5;

  for (let i = 0; i < slice.length; i += CONCURRENCY) {
    const batch = slice.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((t) => processOne(ai, admin, t, dryRun)));
    for (const r of results) {
      if (r.ok) stats.ok++;
      else if (r.reason === 'exception') stats.failed++;
      else stats.skipped++;
    }
    // rate limit 배치 간 2초
    if (i + CONCURRENCY < slice.length) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log('');
  console.log(`Done: ok=${stats.ok} skipped=${stats.skipped} failed=${stats.failed}`);
  console.log('DB: daily_create_limit=80 → 162 초과 시 2일 배치 or UPDATE blog_publish_config SET daily_create_limit=200 WHERE id=1');
}

main().catch((e) => { console.error(e); process.exit(1); });
