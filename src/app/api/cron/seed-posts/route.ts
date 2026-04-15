export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import { withCronLogging } from '@/lib/cron-logger';

/**
 * seed-posts 크론 v4 — 다양하고 자연스러운 피드 게시글
 *
 * 핵심 개선:
 * ✅ 10가지 콘텐츠 타입 (토론, 꿀팁, 후기, 질문, 계산, 유머, 뉴스반응, TIL, 시리즈, 일상)
 * ✅ 24시간 내 동일 baseKey 1개 제한
 * ✅ 같은 유저 24h 내 최대 1게시글
 * ✅ 시간대별 콘텐츠 매칭
 * ✅ 실제 DB 데이터 기반 동적 생성
 * ✅ AI(Haiku)로 자연스러운 변형 + 폴백
 */

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
function getDateVars() {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    dayName: dayNames[now.getDay()],
    isWeekend: now.getDay() === 0 || now.getDay() === 6,
    hourKST: (now.getUTCHours() + 9) % 24,
  };
}

// ═══ 연령대별 말투 ═══
const TONE: Record<string, string> = {
  '20대_male': '반말+존댓말 섞어. ㅋㅋ ㅎㅎ 자연스럽게. "~했는데" "~인듯" "ㄹㅇ"',
  '20대_female': '"~했어요" "~것 같아요" 존댓말+ㅠㅠ ㅎㅎ. 이모티콘 1~2개',
  '30대_male': '존댓말. "~합니다" "~것 같네요". 분석적, 팩트 위주',
  '30대_female': '"~예요" "~거든요" "~네요". 공감 표현 많이. 친근',
  '40대_male': '격식 존댓말. "~입니다". 경험 기반 조언 톤',
  '40대_female': '"~해요" "~더라고요". 따뜻하고 실생활 경험 공유',
  '50대_male': '"~하는 것이 좋겠습니다". 격식+차분',
  '50대_female': '"~했어요" "~이더라고요". 따뜻+정감',
};

type ContentType = 'debate' | 'tip' | 'review' | 'question' | 'calc' | 'humor' | 'news_react' | 'til' | 'series' | 'casual' | 'content';

const TYPE_WEIGHTS: Record<ContentType, { weight: number; hours: number[] }> = {
  debate:     { weight: 10, hours: [19, 20, 21, 22] },
  tip:        { weight: 12, hours: [] },
  review:     { weight: 8,  hours: [18, 19, 20, 21] },
  question:   { weight: 12, hours: [] },
  calc:       { weight: 6,  hours: [9, 10, 11, 14, 15, 16] },
  humor:      { weight: 10, hours: [12, 13, 18, 19] },
  news_react: { weight: 8,  hours: [8, 9, 10, 17, 18] },
  til:        { weight: 6,  hours: [20, 21, 22] },
  series:     { weight: 3,  hours: [] },
  casual:     { weight: 15, hours: [] },
  content:    { weight: 14, hours: [] },
};

interface Template {
  baseKey: string;
  category: string;
  type: ContentType;
  prompt: string;
  fallback: { title: string; content: string };
  ageFilter?: string;
}

function getTemplates(): Template[] {
  const { dayName, isWeekend, month } = getDateVars();
  return [
  // ═══ 주식 — 토론 ═══
  { baseKey: 'stk_etf_vs_ind', category: 'stock', type: 'debate',
    prompt: '"ETF 적립식 vs 개별 종목 직투" 커뮤니티 논쟁 글. 양쪽 비교 후 "다들 어떻게?" 질문. 200자',
    fallback: { title: 'ETF 적립식 vs 개별 종목, 뭐가 나아요?', content: '매달 ETF 넣는 사람이랑 직접 종목 골라 사는 사람이랑 결국 수익률이 비슷하다는데 진짜인가요? 다들 어떻게 하세요?' }},
  { baseKey: 'stk_kr_vs_us', category: 'stock', type: 'debate',
    prompt: '"국장 vs 미장" 논쟁. 코스피 박스피 vs 나스닥 우상향. 200자',
    fallback: { title: '국장 버틸까 미장 갈까, 결론이 뭐예요?', content: '코스피는 매년 박스피인데 나스닥은 우상향이잖아요. 환율 리스크 감안해도 미장이 나은 거 아닌가 싶은데 국장파 의견도 듣고 싶어요' }},
  { baseKey: 'stk_grow_vs_div', category: 'stock', type: 'debate',
    prompt: '"성장주 vs 배당주" 투자 스타일 논쟁. 200자',
    fallback: { title: '성장주 vs 배당주, 30대는 뭘 해야?', content: '20대는 성장주, 40대는 배당주라는데 30대인 저는 뭘 해야 할지 모르겠어요. 다들 포트폴리오 어떻게 구성하세요?' }},
  { baseKey: 'stk_leverage', category: 'stock', type: 'debate',
    prompt: '레버리지 ETF 장기보유 찬반. "위험 vs 역사적 우상향" 논쟁. 200자',
    fallback: { title: '레버리지 ETF 장기보유, 미친 짓 vs 현명한 선택?', content: 'TQQQ 같은 3배 레버리지 장기 보유하는 사람들 있던데 횡보장에서 녹는다잖아요. 근데 10년 수익률 보면 엄청나고... 어떻게 생각하세요?' }},
  { baseKey: 'stk_ai_bubble', category: 'stock', type: 'debate',
    prompt: 'AI 관련주 거품론 vs 아직 시작이라는 논쟁. 200자',
    fallback: { title: 'AI 주식, 거품일까 시작일까?', content: 'AI 관련주 너무 올랐다는 사람도 있고 아직 초입이라는 사람도 있는데 진짜 어떻게 생각하세요? 엔비디아 지금 들어가도 늦지 않은 건가요?' }},

  // ═══ 주식 — 꿀팁 ═══
  { baseKey: 'stk_tax_tip', category: 'stock', type: 'tip',
    prompt: '주식 세금 절약 꿀팁 1가지. 최근 알게 된 느낌. 150자',
    fallback: { title: '해외주식 양도세 절세 꿀팁', content: '해외주식 양도소득 250만원까지 비과세. 매년 12월에 수익난 종목 일부 매도 → 바로 재매수하면 매년 250만원 비과세 혜택 받을 수 있어요' }},
  { baseKey: 'stk_tool_tip', category: 'stock', type: 'tip',
    prompt: '무료 투자 도구/사이트 1개 추천. 초보 눈높이. 150자',
    fallback: { title: '무료 주식 분석 도구 추천', content: '카더라에서 종목 비교하면 PER, PBR, 배당수익률 한눈에 보여요. 유료 사이트 없이도 충분합니다' }},
  { baseKey: 'stk_routine', category: 'stock', type: 'tip',
    prompt: '직장인 아침 투자 루틴. "출근 전 10분에 이것만" 톤. 150자',
    fallback: { title: '출근 전 10분 투자 루틴', content: '아침 8:50 선물지수 확인 → 관심종목 뉴스 → 예약매수 설정. 이 3단계만 해도 업무 중 차트 안 봐도 됩니다' }},
  { baseKey: 'stk_dividend_tip', category: 'stock', type: 'tip',
    prompt: '배당주 투자 입문 팁. 배당락일, 배당기준일 설명. 150자',
    fallback: { title: '배당주 초보가 꼭 알아야 할 것', content: '배당 받으려면 배당기준일 2영업일 전에 매수해야 해요. 배당락일에 사면 이번 배당 못 받습니다. 이거 모르고 당일 산 사람 여기 있음 ㅠ' }},

  // ═══ 주식 — 질문 ═══
  { baseKey: 'stk_begin_q', category: 'stock', type: 'question',
    prompt: '주식 왕초보 질문. 계좌 개설 후 뭘 사야 하는지 모르겠다는 느낌. 120자',
    fallback: { title: '주식 처음인데 뭘 사야 해요?', content: '계좌 만들었는데 뭘 사야 할지 모르겠어요. ETF가 낫다는데 어떤 ETF요? 삼성전자부터 사라는 말도 있고 혼란스러워요 ㅠ' }},
  { baseKey: 'stk_term_q', category: 'stock', type: 'question',
    prompt: 'PER, PBR 같은 용어를 모르겠다는 순수한 질문. 100자',
    fallback: { title: 'PER, PBR 쉽게 설명해주실 분?', content: '주식 글 읽으면 PER 몇 배니 PBR 저평가니 하는데 무슨 뜻인지 모르겠어요. 쉽게 설명된 자료 있을까요?' }},
  { baseKey: 'stk_loss_q', category: 'stock', type: 'question',
    prompt: '손절 기준 질문. "얼마까지 떨어지면 손절?" 느낌. 120자',
    fallback: { title: '손절 기준 어떻게 잡으세요?', content: '-10%면 자르는 사람, -30%까지 버티는 사람 다 있던데 다들 기준이 뭐예요? 저는 항상 늦게 잘라서 고통받는 중' }},
  { baseKey: 'stk_isa_q', category: 'stock', type: 'question',
    prompt: 'ISA 계좌, 연금저축 차이를 모르겠다는 질문. 120자',
    fallback: { title: 'ISA vs 연금저축 차이가 뭐예요?', content: '절세 계좌 만들라는데 ISA, 연금저축, IRP 셋 다 뭔지 모르겠어요. 뭘 먼저 가입해야 하나요? 직장인입니다' }},

  // ═══ 주식 — 후기 ═══
  { baseKey: 'stk_first_buy', category: 'stock', type: 'review', ageFilter: '20대',
    prompt: '주식 첫 매수 후기. 떨리면서 샀는데 바로 마이너스. 웃긴 톤. 150자',
    fallback: { title: '인생 첫 주식 샀는데 바로 마이너스 ㅋㅋ', content: '드디어 주식 시작! 삼전 10주 샀는데 다음날 바로 -2%... 타이밍이 예술이라더니 진짜네요 ㅋㅋ 존버합니다' }},
  { baseKey: 'stk_div_review', category: 'stock', type: 'review',
    prompt: '배당금 처음 받은 후기. 금액은 작지만 뿌듯. 150자',
    fallback: { title: '첫 배당금, 치킨 한 마리값이지만 뿌듯', content: '배당주 투자 6개월, 첫 배당금 입금. 치킨 한 마리값이지만 돈이 돈을 벌어오는 느낌이 좋네요. 복리의 마법 시작!' }},
  { baseKey: 'stk_loss_review', category: 'stock', type: 'review',
    prompt: '주식 손실 경험담. -30% 찍고 깨달은 교훈. 자조적이지만 유익. 180자',
    fallback: { title: '-30% 찍고 깨달은 3가지', content: '1. 몰빵은 멘탈이 안 됨\n2. 뉴스 보고 사면 이미 늦음\n3. 손절 못 하면 계좌가 손절 당함\n\n수업료 비쌌지만 이제라도 알았으니 다행' }},

  // ═══ 주식 — 유머 ═══
  { baseKey: 'stk_humor_law', category: 'stock', type: 'humor',
    prompt: '"주식의 법칙" 같은 자조 유머. 내가 사면 떨어지고 팔면 오르는. 100자',
    fallback: { title: '주식의 법칙 발견함', content: '1. 내가 사면 떨어진다\n2. 내가 팔면 오른다\n3. 존버하면 더 떨어진다\n4. 손절하면 반등한다\n\n이거 깨는 법 아시는 분?' }},
  { baseKey: 'stk_humor_salary', category: 'stock', type: 'humor',
    prompt: '월급 vs 주식 손실 비교 자조 유머. 100자',
    fallback: { title: '월급 vs 주식 손실', content: '월급: 통장을 스쳐간다\n주식 수익: 꿈에서만 존재\n주식 손실: 통장에 영구 거주\n\n...이게 맞나요?' }},
  { baseKey: 'stk_humor_chart', category: 'stock', type: 'humor',
    prompt: '차트 분석 유머. "차트 보면 다 아는데 수익이 안 난다" 류. 100자',
    fallback: { title: '차트 분석의 진실', content: '차트 볼 때: "여기가 지지선이니까 반등하겠지"\n현실: 지지선 뚫고 지하실로\n\n기술적 분석 고수분들 이런 적 없어요?' }},

  // ═══ 주식 — 계산 ═══
  { baseKey: 'stk_compound', category: 'stock', type: 'calc',
    prompt: '매달 50만원 연 10% 복리 20년 계산 공유. 구체적 숫자. 180자',
    fallback: { title: '매달 50만원, 20년 복리로 얼마?', content: '계산기 돌렸는데 매달 50만원 연 10% 복리 20년 = 원금 1.2억 → 결과 3.8억. 복리의 힘이 진짜임... 일찍 시작하는 게 답' }},
  { baseKey: 'stk_coffee_calc', category: 'stock', type: 'calc',
    prompt: '"매일 커피값 5천원을 투자했다면?" 라떼효과 계산. 150자',
    fallback: { title: '커피값을 투자했다면 얼마였을까?', content: '매일 5천원 × 365일 = 연 182만원. 이걸 연 8%로 10년 투자하면 약 2,800만원... 커피가 차 한 대값이었네요. 그래도 커피는 못 끊겠다 ㅋ' }},

  // ═══ 주식 — TIL ═══
  { baseKey: 'stk_til_after', category: 'stock', type: 'til',
    prompt: '"오늘 알게 된 것: 시간외 거래" 같은 TIL. 투자 상식 1가지. 150자',
    fallback: { title: 'TIL: 시간외 거래가 가능하다고?', content: '장 끝나고도 시간외 거래 가능한 거 오늘 처음 알았어요. 장 마감 후 뉴스 나오면 바로 대응 가능. 왜 이제 알았지...' }},
  { baseKey: 'stk_til_isa', category: 'stock', type: 'til',
    prompt: '"오늘 알게 된 것: ISA 비과세 혜택" TIL. 150자',
    fallback: { title: 'TIL: ISA 계좌가 이렇게 좋았어?', content: 'ISA 200만원까지 비과세, 초과분 9.9% 분리과세. 일반 계좌 15.4%보다 훨씬 낫네요. 바로 가입함' }},

  // ═══ 부동산 — 토론 ═══
  { baseKey: 'apt_buy_rent', category: 'apt', type: 'debate',
    prompt: '"전세 vs 매매" 지금 시점 고민. 양쪽 논거. 200자',
    fallback: { title: '전세 계속 vs 무리해서 매매, 정답이 뭘까?', content: '전세 만기 다가오는데 매매로 전환할지 고민이에요. 금리 높아서 대출이자 부담, 전세도 보증금 올라서 부담... 다들 어떻게 판단하셨어요?' }},
  { baseKey: 'apt_new_old', category: 'apt', type: 'debate',
    prompt: '"신축 청약 기다리기 vs 구축 바로 사기" 논쟁. 200자',
    fallback: { title: '청약 기다리기 vs 구축 바로 사기, 어느 쪽?', content: '청약 가점 50점대인데 계속 기다릴지 구축이라도 살지 고민이에요. 신축 로또 노리다 5년 날릴 수도 있고...' }},
  { baseKey: 'apt_invest_live', category: 'apt', type: 'debate',
    prompt: '"실거주 vs 투자" 아파트 선택 기준 토론. 200자',
    fallback: { title: '실거주용 vs 투자용, 기준이 다르지 않나요?', content: '실거주면 학군이 1순위인데 투자면 개발호재가 1순위잖아요. 요즘은 실거주 좋은 곳이 투자도 좋다는 말이 있더라고요' }},
  { baseKey: 'apt_region_gap', category: 'apt', type: 'debate',
    prompt: '서울 vs 지방 부동산 격차에 대한 토론. 200자',
    fallback: { title: '서울-지방 집값 격차, 더 벌어질까요?', content: '서울은 계속 오르는데 지방은 미분양 쌓이고... 이 격차가 계속 벌어질까요? 지방에 투자하는 건 이제 위험한 건가요?' }},

  // ═══ 부동산 — 꿀팁 ═══
  { baseKey: 'apt_check_tip', category: 'apt', type: 'tip',
    prompt: '아파트 임장 체크리스트 3가지. 실전 경험. 180자',
    fallback: { title: '임장 갈 때 이것만 체크하세요', content: '1. 평일 저녁 6시에 가보기 — 주차/실거주 체감\n2. 관리사무소에 관리비 물어보기\n3. 지하주차장 누수/균열 확인\n\n이 3개만 봐도 80%는 걸러져요' }},
  { baseKey: 'apt_sub_tip', category: 'apt', type: 'tip',
    prompt: '청약 당첨 확률 높이는 실전 팁. 150자',
    fallback: { title: '청약 당첨 확률 올리는 꿀팁', content: '가점 낮으면 추첨제 노리세요. 85㎡ 초과 = 100% 추첨. 비인기 지역 + 대형 평형이 의외로 당첨률 높아요' }},
  { baseKey: 'apt_loan_tip', category: 'apt', type: 'tip',
    prompt: '주택담보대출 금리 비교 팁. 은행 3곳 비교해보라는 조언. 150자',
    fallback: { title: '주담대 금리, 최소 3곳 비교하세요', content: '같은 조건인데 은행마다 금리 0.3~0.5% 차이 나요. 1억 대출이면 연 30~50만원 차이. 인터넷은행도 꼭 비교해보세요' }},

  // ═══ 부동산 — 질문 ═══
  { baseKey: 'apt_first_q', category: 'apt', type: 'question',
    prompt: '사회초년생 내 집 마련 첫 질문. 순수하게 모르는 사람. 130자',
    fallback: { title: '내 집 마련 어디서부터 시작해요?', content: '입사 2년차인데 집 살 수 있을까요? 청약통장은 있는데 뭘 해야 하는지 모르겠어요. 선배님들 처음에 어떻게 시작하셨어요?' }},
  { baseKey: 'apt_dsr_q', category: 'apt', type: 'question',
    prompt: 'DSR, LTV 개념 초보 질문. 120자',
    fallback: { title: 'DSR, LTV 이게 다 뭔가요?', content: 'DSR 40%, LTV 70% 이런 말만 하는데 무슨 뜻이에요? 대출 얼마까지 받을 수 있는지 계산 방법을 모르겠어요' }},
  { baseKey: 'apt_area_q', category: 'apt', type: 'question',
    prompt: '특정 지역 부동산 전망/이사 고민 질문. 130자',
    fallback: { title: '출퇴근 1시간 이내 지역 추천 좀', content: '직장이 강남인데 전세 3억대로 출퇴근 1시간 이내 어디가 좋을까요? 신혼이라 학군은 상관없고 교통 최우선이에요' }},

  // ═══ 부동산 — 후기 ═══
  { baseKey: 'apt_move_review', category: 'apt', type: 'review',
    prompt: '구축→신축 이사 감동 후기. 180자',
    fallback: { title: '구축→신축 이사하니 세상이 달라졌어요', content: '20년된 빌라에서 신축 아파트로 이사. 시스템 에어컨, 층간소음 거의 없음, 지하주차장에서 바로 엘베... 무리해서라도 옮기길 잘했어요' }},
  { baseKey: 'apt_sub_review', category: 'apt', type: 'review',
    prompt: '청약 4번만에 당첨 경험담. 180자',
    fallback: { title: '청약 4번 만에 당첨!', content: '3번 미당첨이라 포기할까 했는데 4번째에 특공으로 당첨! 포기하지 마세요. 가점 낮아도 특공 조건 맞으면 승산 있어요' }},
  { baseKey: 'apt_remodel_review', category: 'apt', type: 'review',
    prompt: '셀프 인테리어 후기. 예산, 기간, 만족도 포함. 180자',
    fallback: { title: '셀프 인테리어 후기 (예산 800만원)', content: '도배+장판+주방 싱크대+욕실 교체 총 800만원. 업자 맡기면 1,500이었는데 유튜브 보고 도배는 직접 했어요. 3주 걸렸지만 만족도 200%' }},

  // ═══ 부동산 — 계산 ═══
  { baseKey: 'apt_rent_calc', category: 'apt', type: 'calc',
    prompt: '"전세 3억 vs 매매 5억" 월 비용 비교 계산. 구체적 숫자. 200자',
    fallback: { title: '전세 3억 vs 매매 5억, 실제 월 비용', content: '전세 3억: 보증보험 15만 + 관리비 20만 = 월 35만\n매매 5억(대출 2억 3.5%): 이자 58만 + 관리비 20만 = 월 78만\n\n차액 월 43만원. 이게 자산 축적의 대가인 건가요?' }},

  // ═══ 재테크/일상 — 토론 ═══
  { baseKey: 'free_save_debate', category: 'free', type: 'debate',
    prompt: '"적금 vs 투자" 안전 vs 리스크 논쟁. 200자',
    fallback: { title: '적금이 바보짓이라는 말, 동의해요?', content: '적금 이자가 물가상승률도 못 따라간다고 투자하라는 사람 많은데 원금 보장 되는 적금이 진짜 바보짓인가요?' }},
  { baseKey: 'free_100m_debate', category: 'free', type: 'debate',
    prompt: '100만원 생기면 명품/여행/투자 중 뭐? 소비 가치관 토론. 150자',
    fallback: { title: '보너스 100만원, 명품 vs 여행 vs 투자?', content: '갑자기 100만원 생기면 뭐 하세요? 정답은 없겠지만 다들 우선순위가 궁금해요' }},
  { baseKey: 'free_retire_debate', category: 'free', type: 'debate',
    prompt: '"조기은퇴 FIRE vs 안정적 직장생활" 논쟁. 200자',
    fallback: { title: 'FIRE족 vs 안정 직장, 어떤 삶이 나아요?', content: '조기은퇴 해서 자유롭게 사는 FIRE족이 부럽기도 한데, 안정적인 월급의 가치도 무시 못하잖아요. 다들 은퇴 계획 어떻게 세우고 있어요?' }},

  // ═══ 일상 — 꿀팁 ═══
  { baseKey: 'free_save_tip1', category: 'free', type: 'tip',
    prompt: '직장인 월 절약 꿀팁. 통신비/보험/구독 정리 등. 180자',
    fallback: { title: '월 40만원 절약한 실전 방법', content: '알뜰폰 -5만 / 보험 정리 -8만 / 구독 정리 -3만 / 외식 축소 -15만 / 텀블러 -10만 = 월 41만원 절약!' }},
  { baseKey: 'free_save_tip2', category: 'free', type: 'tip',
    prompt: '짠테크 습관 1가지. 가계부, 현금봉투 등. 150자',
    fallback: { title: '짠테크 습관 하나로 월 20만원 아꼈어요', content: '매일 지출 사진 찍기 시작했더니 충동구매가 확 줄었어요. 앱 안 써도 됨. 카드 결제마다 영수증 사진 한 장. 일주일만 해보세요' }},
  { baseKey: 'free_tax_tip', category: 'free', type: 'tip',
    prompt: '연말정산 놓치기 쉬운 공제 항목 1가지. 150자',
    fallback: { title: '연말정산 때 이거 놓치지 마세요', content: '안경/콘택트렌즈 구매비도 의료비 공제 됩니다! 연 50만원 한도. 라식/라섹도 되고요. 의외로 모르는 분 많더라고요' }},
  { baseKey: 'free_card_tip', category: 'free', type: 'tip',
    prompt: '신용카드 실적 채우는 꿀팁 또는 추천. 150자',
    fallback: { title: '카드 실적 채우는 꿀팁', content: '공과금, 통신비, 구독료 전부 한 카드로 몰면 실적 자동 달성. 월 30만원 실적 카드인데 이것만으로 25만원 채워져요' }},

  // ═══ 일상 — 유머 ═══
  { baseKey: 'free_humor_pay', category: 'free', type: 'humor',
    prompt: '월급날 비극 유머. "들어왔다 나갔다" 류. 100자',
    fallback: { title: '월급날의 진실', content: '월급날 아침: 나 부자다!\n월급날 오후: 카드값 자동이체\n월급날 저녁: 관리비 이체\n월급날 밤: ...남은 거 있나?\n\n매달 반복' }},
  { baseKey: 'free_humor_adult', category: 'free', type: 'humor',
    prompt: '"어른이 되면 알게 되는 것" 공감 유머. 100자',
    fallback: { title: '어른이 되고 알게 된 것들', content: '1. 아프면 돈이 든다\n2. 건강해도 돈이 든다\n3. 살아있으면 돈이 든다\n4. 돈 벌려면 건강이 필요\n\n무한루프...' }},
  { baseKey: 'free_humor_wknd', category: 'free', type: 'humor',
    prompt: '주말 계획 vs 현실 유머. 100자',
    fallback: { title: '주말 계획 vs 현실', content: '계획: 운동, 독서, 자기계발\n현실: 침대, 유튜브, 배달\n\n일요일 밤: "다음 주말엔 진짜..."\n매주 반복' }},
  { baseKey: 'free_humor_diet', category: 'free', type: 'humor',
    prompt: '다이어트 실패 유머. "내일부터" 패턴. 100자',
    fallback: { title: '다이어트의 법칙', content: '월요일: 내일부터 한다\n화요일: 이번 주 안에 시작\n수요일: 다음 주 월요일부터\n...\n다음 달 1일: 내년부터' }},

  // ═══ 일상 — 뻘글 ═══
  { baseKey: `casual_am_${dayName}`, category: 'free', type: 'casual',
    prompt: `${dayName}요일 아침 출근 뻘글. 커피/지하철/날씨 중 1개. 80자`,
    fallback: { title: `${dayName}요일 아침`, content: isWeekend ? '주말인데 눈 떠보니 11시... 이게 행복이지' : '오늘도 출근 전쟁. 커피 한잔 하고 시작해야겠다' }},
  { baseKey: `casual_lunch_${dayName}`, category: 'free', type: 'casual',
    prompt: '점심 메뉴 고민 뻘글. 80자',
    fallback: { title: '점심 메뉴 선택장애', content: '매일 이 시간 시작되는 점심 전쟁... 어제 먹은 거 빼면 선택지가 없어요. 제발 추천 좀' }},
  { baseKey: `casual_eve_${dayName}`, category: 'free', type: 'casual',
    prompt: '퇴근 후 뻘글. 치맥/넷플/산책 중 1개. 80자',
    fallback: { title: '퇴근했다', content: '오늘도 수고했어요 다들. 치킨 시킬까 라면 끓일까 고민 중' }},
  { baseKey: 'casual_money', category: 'free', type: 'casual',
    prompt: '통장 잔고 걱정 뻘글. 100자',
    fallback: { title: '통장 잔고 보면 한숨', content: '월급날까지 2주인데 통장이 벌써... 다들 월급 전 마지막 주 어떻게 버텨요?' }},
  { baseKey: 'casual_pet', category: 'free', type: 'casual',
    prompt: '반려동물 일상 뻘글. 120자',
    fallback: { title: '퇴근길에 반겨주는 건 고양이뿐', content: '문 열면 달려오는 고양이가 세상에서 제일 귀여워요. 근데 밥 달라는 거였음 ㅋㅋ 그래도 귀여우니까 됐어' }},
  { baseKey: 'casual_exercise', category: 'free', type: 'casual',
    prompt: '운동 자조 뻘글. 헬스장 등록만 3번째 류. 100자',
    fallback: { title: '헬스장 등록만 3번째', content: '올해 목표: 운동 꾸준히\n현실: 3개월 등록 → 2번 감 → 만료\n\n이번엔 진짜... 라고 매번 말함' }},

  // ═══ 뉴스 반응 ═══
  { baseKey: 'news_inflation', category: 'free', type: 'news_react',
    prompt: `물가 상승 뉴스 반응. "${month}월 장보면 깜짝 놀란다" 톤. 130자`,
    fallback: { title: '마트 가면 깜짝 놀라요 요즘', content: `계란 한판 만원, 과일은 금값. ${month}월 물가가 또 올랐다는데 체감이 뉴스보다 심해요. 장볼 때 절약법 있으면 공유해주세요` }},
  { baseKey: 'news_interest', category: 'free', type: 'news_react',
    prompt: '금리 뉴스 반응. 대출 이자 걱정. 130자',
    fallback: { title: '금리 뉴스 볼 때마다 심장이 철렁', content: '기준금리 동결인데 대출 이자는 왜 높죠? 변동금리 받은 사람들 힘들 것 같아요. 고정금리로 갈아타야 하나' }},
  { baseKey: 'news_job', category: 'free', type: 'news_react',
    prompt: '취업/이직 관련 뉴스 반응. 구직 힘들다는 공감. 130자',
    fallback: { title: '취업시장 뉴스 볼 때마다 답답해요', content: '경기가 안 좋아서 채용이 줄었다는데 체감은 더 심해요. 이력서 넣어도 연락이 안 오네요. 같은 고민인 분 계세요?' }},

  // ═══ 시리즈 ═══
  { baseKey: `series_stock_d${Math.floor(Math.random() * 30) + 1}`, category: 'stock', type: 'series',
    prompt: `"주린이 일기 Day ${Math.floor(Math.random() * 30) + 1}" 형식. 주식 초보 하루. 150자`,
    fallback: { title: `주린이 일기 Day ${Math.floor(Math.random() * 30) + 1}`, content: '오늘 분할매수의 의미를 깨달았다. 몰빵하면 -10%에 멘탈 나가는데 3번 나눠 사니 평단가도 낮아지고 마음도 편함. 성장 중' }},
  { baseKey: `series_apt_n${Math.floor(Math.random() * 10) + 1}`, category: 'apt', type: 'series',
    prompt: `"부린이 탐방기 #${Math.floor(Math.random() * 10) + 1}" 형식. 모델하우스 방문 후기. 150자`,
    fallback: { title: `부린이 탐방기 #${Math.floor(Math.random() * 10) + 1}`, content: '첫 모델하우스 방문. 분위기에 휩쓸려 청약 넣을 뻔 ㅋㅋ 냉정하게 분석해야 하는데 인테리어 보면 마음이 흔들리네요' }},

  // ═══ 일상 추가 (casual) ═══
  { baseKey: 'casual_coffee_cost', category: 'free', type: 'casual',
    prompt: '카페 커피값 올랐다는 일상 뻘글. 100자',
    fallback: { title: '카페 커피 또 올랐어요', content: '아아 5,500원이 기본인 세상... 텀블러 들고 다니기 시작했어요. 다들 커피 어떻게 절약하세요?' }},
  { baseKey: 'casual_weather_money', category: 'free', type: 'casual',
    prompt: '날씨+돈 연결 뻘글. "비 오면 택시비" 류. 100자',
    fallback: { title: '비 올 때마다 지갑이 운다', content: '비 오면 택시비, 우산값, 빨래건조기 전기세... 날씨도 돈이더라고요. 장마 오면 진짜 큰일' }},
  { baseKey: 'casual_weekend_plan', category: 'free', type: 'casual',
    prompt: '주말 자기계발 vs 쉬기 고민. 100자',
    fallback: { title: '주말에 공부 vs 쉬기', content: '주중에는 "주말에 공부해야지" → 금요일 밤 "일단 쉬자" → 일요일 밤 "다음 주 주말엔..." 매주 반복 중' }},
  { baseKey: 'casual_delivery', category: 'free', type: 'casual',
    prompt: '배달비 비싸다는 뻘글. 100자',
    fallback: { title: '배달비가 음식값이랑 맞먹네요', content: '치킨 19,000원 + 배달비 4,000원... 직접 포장하러 가야 하나. 다들 배달 많이 시키세요 아니면 직접 가세요?' }},
  { baseKey: 'casual_sleep', category: 'free', type: 'casual',
    prompt: '수면 패턴 뻘글. 잠이 부족하다는. 80자',
    fallback: { title: '요즘 잠을 너무 못 자요', content: '새벽 1시에 눕는데 3시까지 잠이 안 옴. 스마트폰 때문인가... 수면 루틴 있으신 분?' }},
  { baseKey: 'casual_hobby_money', category: 'free', type: 'casual',
    prompt: '취미에 돈 쓰는 게 아까운지 토론. 120자',
    fallback: { title: '취미에 돈 쓰는 거 아깝나요?', content: '운동, 게임, 여행... 취미비가 만만찮은데 다들 한 달에 취미비 얼마나 쓰세요? 아예 안 쓰는 분도 있나요' }},
  { baseKey: 'casual_grocery', category: 'free', type: 'casual',
    prompt: '장보기 물가 충격 뻘글. 100자',
    fallback: { title: '마트 장바구니 10만원이 기본이네요', content: '대파 한 단 2,500원, 계란 한 판 8,000원... 예전에 5만원이면 한 주 먹었는데. 물가가 진짜 무섭다' }},
  { baseKey: 'casual_saving_goal', category: 'free', type: 'casual',
    prompt: '저축 목표 공유 뻘글. "올해 목표 1000만원" 류. 100자',
    fallback: { title: '올해 저축 목표 1000만원인데...', content: '4월인데 아직 200만원 모았어요. 속도가 안 나요 ㅠ 다들 연간 저축 목표 얼마로 잡으세요?' }},
  { baseKey: 'casual_commute', category: 'free', type: 'casual',
    prompt: '출퇴근 고충 뻘글. 100자',
    fallback: { title: '출퇴근 1시간 30분 버티는 중', content: '편도 1시간 30분이면 하루 3시간을 길에서 보내는 건데... 이사 가야 하나 차를 사야 하나. 다들 출퇴근 시간이 어떠세요?' }},
  { baseKey: 'casual_ott_cost', category: 'free', type: 'casual',
    prompt: 'OTT 구독 정리 뻘글. 넷플+유튜브+웨이브 등. 100자',
    fallback: { title: 'OTT 구독료만 월 5만원 ㅋㅋ', content: '넷플 17,000 + 유튜브프리미엄 14,900 + 쿠팡플레이... 정리해야 하는데 다 쓰고 있어서 뭘 끊을지 모르겠다' }},

  // ═══ 콘텐츠 언급 (content) — 카더라 기능 자연스럽게 노출 ═══
  { baseKey: 'ctn_calc_score', category: 'apt', type: 'content',
    prompt: '카더라 청약 가점 계산기를 써봤다는 후기. "생각보다 점수가 낮아서 충격" 느낌. 130자',
    fallback: { title: '청약 가점 계산해봤는데 충격', content: '카더라에서 청약 가점 계산기 돌려봤더니 42점... 생각보다 훨씬 낮았어요. 무주택 기간은 길어도 부양가족이 적으니 ㅠ 다들 가점 몇 점이세요?' }},
  { baseKey: 'ctn_calc_dsr', category: 'apt', type: 'content',
    prompt: '카더라 DSR 계산기 써본 후기. "대출 한도가 생각보다 적다" 톤. 130자',
    fallback: { title: 'DSR 계산해보니 대출 한도가...', content: 'DSR 계산기 돌려봤는데 연봉 5천이면 대출 한도가 이 정도밖에? 집값에 비하면 턱없이 부족. 현실 파악 됐습니다 ㅠ' }},
  { baseKey: 'ctn_calc_roi', category: 'stock', type: 'content',
    prompt: '카더라 주식 수익률 계산기로 계산해본 결과. "복리의 위력" 톤. 130자',
    fallback: { title: '수익률 계산기 돌려보니 소름', content: '매달 30만원씩 연 8% 20년이면 1.7억? 카더라 수익률 계산기로 돌려봤는데 복리의 힘이 진짜 무섭네요. 조금이라도 빨리 시작하는 게 답' }},
  { baseKey: 'ctn_calc_fee', category: 'apt', type: 'content',
    prompt: '중개수수료 계산기 써본 후기. "수수료가 이렇게 비싸?" 반응. 120자',
    fallback: { title: '중개수수료 계산해보니 500만원??', content: '5억 아파트 매매 시 중개수수료 계산해봤더니 400만원 넘음... 이게 맞나요? 법정 요율이 이렇게 높을 줄 몰랐어요' }},
  { baseKey: 'ctn_stock_compare', category: 'stock', type: 'content',
    prompt: '카더라에서 종목 비교 기능 써본 후기. 삼성 vs SK하이닉스 비교하면서. 150자',
    fallback: { title: '삼성전자 vs SK하이닉스 비교해봤어요', content: '카더라에서 종목 비교해봤는데 PER, PBR, 배당수익률 한눈에 비교 되더라고요. 삼성은 저평가, 하이닉스는 성장성... 어려워요' }},
  { baseKey: 'ctn_apt_analysis', category: 'apt', type: 'content',
    prompt: '카더라 단지 분석 기능 써본 후기. 관심 단지의 분석 데이터가 유용했다는 느낌. 150자',
    fallback: { title: '우리 동네 단지 분석 결과 봤는데', content: '카더라에서 우리 동네 아파트 분석해봤는데 교통점수, 학군점수 등 점수가 나오더라고요. 생각보다 학군이 약한 거 알고 충격' }},
  { baseKey: 'ctn_blog_useful', category: 'free', type: 'content',
    prompt: '카더라 블로그 글이 유용했다는 후기. 청약이나 주식 가이드 읽고 도움 된 느낌. 120자',
    fallback: { title: '블로그에서 읽은 청약 가이드 완전 유용', content: '청약 일정이랑 전략을 정리한 글 읽었는데 완전 쉽게 설명돼있어서 좋았어요. 초보한테 딱이에요. 블로그 자주 들어가게 됨' }},
  { baseKey: 'ctn_apt_trade', category: 'apt', type: 'content',
    prompt: '카더라에서 실거래가 확인한 후기. "옆 단지가 이 가격에 팔렸다고?" 반응. 130자',
    fallback: { title: '옆 단지 실거래가 보고 깜짝 놀람', content: '카더라에서 동네 실거래가 검색해봤는데 옆 단지가 2달 전에 이 가격에 거래? 우리 단지랑 2억 차이나는데 왜지... 신기하네요' }},
  { baseKey: 'ctn_sub_alert', category: 'apt', type: 'content',
    prompt: '카더라 청약 일정 알림이 유용하다는 글. "놓칠 뻔한 청약 알림 받아서 넣었다" 느낌. 130자',
    fallback: { title: '청약 알림 받아서 접수했어요!', content: '관심 지역 청약 일정 알림 설정해놨더니 딱 맞춰서 알려주네요. 이번에 놓칠 뻔한 거 알림 덕분에 접수함. 알림 꼭 켜놓으세요' }},
  { baseKey: 'ctn_calc_salary', category: 'free', type: 'content',
    prompt: '실수령액 계산기 써본 후기. 연봉 대비 실수령액 차이에 놀란 톤. 120자',
    fallback: { title: '연봉 5000이면 실수령 얼마인지 아세요?', content: '실수령액 계산기 돌려봤는데 연봉 5000만원이면 월 실수령 345만원... 세금이 이렇게 많이 나가는 줄 몰랐어요. 현타 옵니다' }},
  { baseKey: 'ctn_unsold_check', category: 'apt', type: 'content',
    prompt: '카더라에서 미분양 현황 확인한 후기. "이 지역은 미분양이 이렇게 많아?" 톤. 130자',
    fallback: { title: '미분양 현황 확인해봤는데 지방은...', content: '카더라에서 미분양 현황 봤는데 지방 미분양이 아직 많더라고요. 수도권은 괜찮은데 지방 투자는 좀 더 신중해야 할 듯' }},
  { baseKey: 'ctn_feed_good', category: 'free', type: 'content',
    prompt: '카더라 커뮤니티에서 좋은 정보 얻었다는 글. 자연스럽게. 100자',
    fallback: { title: '여기 커뮤니티 진짜 유익하네요', content: '부동산이랑 주식 정보를 한곳에서 보니까 편하고, 댓글에서도 배우는 게 많아요. 다들 적극적으로 공유해주시면 좋겠어요!' }},
];
}

// ═══ 타입별 댓글 ═══
const COMMENTS: Record<string, Record<string, string[]>> = {
  debate: {
    '20대': ['ㄹㅇ 이거 고민이에요', '저는 전자 ㅋㅋ', '둘 다 해본 사람?', '정답이 없는 듯'],
    '30대': ['저도 같은 고민이에요', '케바케인 것 같아요', '경험상 전자가 나았어요', '좋은 토론이네요'],
    '40대': ['경험에 비추어 보면...', '개인 상황에 따라 다릅니다', '양쪽 다 일리 있어요'],
    '50대': ['좋은 질문이십니다', '본인 상황에 맞게 하시면 됩니다', '깊이 생각해볼 문제네요'],
  },
  tip: {
    '20대': ['오 이거 몰랐네!', '저장 ㅋㅋ', '꿀팁 감사!', '나도 해봐야겠다'],
    '30대': ['좋은 정보 감사합니다', '바로 실행해봐야겠네요', '추가 팁 있으면 더 알려주세요'],
    '40대': ['실용적이네요', '주변에도 알려줘야겠어요', '저도 실천 중이에요'],
    '50대': ['유익한 정보입니다', '감사합니다'],
  },
  humor: {
    '20대': ['ㅋㅋㅋ 공감', '이거 나인데?', '빼박 내 이야기 ㅋ', '웃기면서 슬프다'],
    '30대': ['너무 공감 ㅋㅋ', '웃으면서도 슬프네요', '나만 이런 줄 알았는데'],
    '40대': ['ㅎㅎ 공감합니다', '현실이라 더 웃기네요'],
    '50대': ['ㅎㅎ 재밌습니다'],
  },
  question: {
    '20대': ['저도 궁금!', '아 나도 모름 ㅋ', '누가 알려주세요~'],
    '30대': ['저도 궁금했어요', '답변 기다립니다', '좋은 질문이에요'],
    '40대': ['이건 이렇게 하시면 됩니다', '제 경험을 말씀드리면...'],
    '50대': ['전문가 상담 추천합니다'],
  },
  review: {
    '20대': ['오 부럽다!', '나도 해보고 싶어요', '후기 감사!'],
    '30대': ['좋은 경험이네요', '저도 비슷한 경험 있어요', '공유 감사합니다'],
    '40대': ['좋은 후기 감사합니다', '참고하겠습니다'],
    '50대': ['좋은 경험을 나눠주셨네요'],
  },
  default: {
    '20대': ['ㅋㅋ 공감', '오 좋네요', '이거 진짜'],
    '30대': ['공감합니다', '좋은 글이에요', '참고할게요'],
    '40대': ['좋은 정보네요', '공감합니다'],
    '50대': ['감사합니다', '좋은 글이네요'],
  },
  content: {
    '20대': ['오 이거 나도 써봐야지', '저장!', '바로 해봄 ㅋㅋ', '이거 몰랐는데 대박'],
    '30대': ['좋은 정보 감사합니다', '저도 써봤는데 유용해요', '공유 감사합니다', '바로 확인해봐야겠네요'],
    '40대': ['실용적인 정보네요', '이런 기능이 있었군요', '잘 활용해야겠습니다'],
    '50대': ['유익한 정보 감사합니다', '좋은 도구네요'],
  },
};

// ═══ 유틸 ═══
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN<T>(arr: T[], n: number): T[] { return [...arr].sort(() => Math.random() - 0.5).slice(0, Math.min(n, arr.length)); }

function selectContentType(): ContentType {
  const { hourKST } = getDateVars();
  const eligible = Object.entries(TYPE_WEIGHTS).filter(([_, c]) =>
    c.hours.length === 0 || c.hours.includes(hourKST)
  );
  const total = eligible.reduce((s, [_, c]) => s + c.weight, 0);
  let r = Math.random() * total;
  for (const [type, c] of eligible) {
    r -= c.weight;
    if (r <= 0) return type as ContentType;
  }
  return 'casual';
}

async function generateWithAI(prompt: string, tone: string): Promise<{ title: string; content: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 400,
        system: `한국 부동산/주식/재테크 커뮤니티의 일반 유저로서 글을 작성합니다.
말투: ${tone}
규칙: 진짜 일반인처럼 자연스럽게. URL/링크/해시태그 절대 금지. 이모지 1~2개 이내.
출력형식:
제목: (30자 이내, "제목:" 접두사 포함)
---
(본문)`,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.content?.[0]?.text?.trim();
    if (!text) return null;
    const parts = text.split('---');
    if (parts.length >= 2) {
      const title = parts[0].replace(/^제목:\s*/i, '').trim().slice(0, 50);
      const content = parts.slice(1).join('---').trim();
      if (title && content) return { title, content };
    }
    const lines = text.split('\n').filter((l: string) => l.trim());
    if (lines.length >= 2) return { title: lines[0].replace(/^제목:\s*/i, '').trim().slice(0, 50), content: lines.slice(1).join('\n') };
    return null;
  } catch { return null; }
}

interface SeedUser { id: string; nickname: string; age_group: string; gender: string; region_text: string }

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await withCronLogging('seed-posts', async () => {
    const admin = getSupabaseAdmin();
    const { data: rawUsers } = await admin.from('profiles').select('id, nickname, age_group, gender, region_text').eq('is_seed', true);
    const seedUsers: SeedUser[] = (rawUsers || []).map((u: any) => ({
      id: u.id, nickname: u.nickname || '익명',
      age_group: u.age_group || '30대', gender: u.gender === 'female' ? 'female' : 'male',
      region_text: u.region_text || '서울',
    }));
    if (seedUsers.length === 0) return { processed: 0, created: 0, failed: 0 };

    // 24h 내 기존 포스트 조회 (유저/토픽 중복 방지)
    const since24h = new Date(Date.now() - 24 * 3600000).toISOString();
    const { data: recentPosts } = await admin.from('posts')
      .select('author_id, title').in('author_id', seedUsers.map(u => u.id))
      .gte('created_at', since24h).eq('is_deleted', false);

    const recentAuthorIds = new Set((recentPosts || []).map(p => p.author_id));
    const recentTitlePrefixes = new Set((recentPosts || []).map(p => p.title?.slice(0, 15)));

    const availableUsers = seedUsers.filter(u => !recentAuthorIds.has(u.id));
    if (availableUsers.length === 0) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'all_users_posted_today' } };

    const postCount = Math.min(randInt(3, 5), availableUsers.length);
    const selectedUsers = pickN(availableUsers, postCount);

    // ═══ 동적 데이터 기반 추가 템플릿 (v3: 9개 소스, 매일 새 콘텐츠) ═══
    let dynamicTemplates: Template[] = [];
    try {
      const [
        { data: stocks },
        { data: apts },
        { data: blogs },
        { data: issues },
        { data: volatileStocks },
        { data: activeSubs },
        { data: stockNews },
        { data: trending },
        { data: recentDeals },
      ] = await Promise.all([
        // 1. 인기 종목 (거래량 TOP)
        admin.from('stock_quotes').select('symbol, name, price, change_pct, currency')
          .eq('is_active', true).gt('price', 0).order('volume', { ascending: false, nullsFirst: false }).limit(20),
        // 2. 활발한 단지
        (admin as any).from('apt_sites').select('name, region, sigungu, builder')
          .eq('is_active', true).not('analysis_text', 'is', null)
          .order('page_views', { ascending: false, nullsFirst: false }).limit(20),
        // 3. 최근 인기 블로그
        admin.from('blog_posts').select('id, title, slug, category, view_count')
          .eq('is_published', true).gt('view_count', 3)
          .gte('created_at', new Date(Date.now() - 3 * 86400000).toISOString())
          .order('view_count', { ascending: false }).limit(10),
        // 4. 핫 이슈 (오늘)
        (admin as any).from('issue_alerts').select('title, category, summary, detected_keywords, final_score')
          .gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString())
          .gte('final_score', 45)
          .order('final_score', { ascending: false }).limit(10),
        // 5. 급등/급락 종목 (변동률 >5%)
        admin.from('stock_quotes').select('symbol, name, price, change_pct, currency')
          .eq('is_active', true).gt('price', 0)
          .order('change_pct', { ascending: false }).limit(10),
        // 6. 진행 중 청약 (마감 임박순)
        (admin as any).from('apt_subscriptions').select('house_nm, region_nm, tot_supply_hshld_co, rcept_endde, constructor_nm, is_price_limit')
          .gte('rcept_endde', new Date().toISOString().slice(0, 10))
          .order('rcept_endde', { ascending: true }).limit(10),
        // 7. 오늘 주식 뉴스
        (admin as any).from('stock_news').select('title, symbol, source, sentiment_label')
          .gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString())
          .order('created_at', { ascending: false }).limit(15),
        // 8. 트렌딩 키워드
        (admin as any).from('trending_keywords').select('keyword, heat_score, category, rank')
          .order('heat_score', { ascending: false }).limit(10),
        // 9. 최근 실거래 (고가 거래)
        (admin as any).from('apt_transactions').select('apt_name, region_nm, sigungu, deal_amount, exclusive_area, floor, deal_date')
          .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
          .order('deal_amount', { ascending: false }).limit(15),
      ]);

      // ── 소스 1: 인기 종목 → 의견/질문 (2~3개) ──
      if (stocks?.length) {
        for (const s of pickN(stocks as any[], randInt(2, 3))) {
          const p = s.currency === 'USD' ? `$${Number(s.price).toFixed(0)}` : `${Number(s.price).toLocaleString()}원`;
          const chg = Number(s.change_pct);
          dynamicTemplates.push({
            baseKey: `dyn_stk_${s.symbol}`, category: 'stock', type: pick(['question', 'debate', 'casual'] as ContentType[]),
            prompt: `${s.name}(${s.symbol}) 현재가 ${p}, ${chg >= 0 ? '+' : ''}${chg.toFixed(1)}%. 이 종목에 대한 의견/질문/고민 글. 일반인 느낌으로 자연스럽게. 150자`,
            fallback: { title: `${s.name} 어떻게 보세요?`, content: `${s.name} 현재 ${p}인데 ${chg >= 0 ? '오르고 있는데' : '빠지고 있는데'} 다들 어떻게 판단하세요? 의견 듣고 싶어요` },
          });
        }
      }

      // ── 소스 2: 급등/급락 종목 → 놀라는 반응 (1~2개) ──
      if (volatileStocks?.length) {
        const volFiltered = (volatileStocks as any[]).filter((s: any) => Math.abs(Number(s.change_pct)) > 5);
        for (const s of pickN(volFiltered, randInt(1, 2)) as any[]) {
          const chg = Number(s.change_pct);
          const p = s.currency === 'USD' ? `$${Number(s.price).toFixed(0)}` : `${Number(s.price).toLocaleString()}원`;
          dynamicTemplates.push({
            baseKey: `dyn_vol_${s.symbol}`, category: 'stock', type: pick(['news_react', 'casual'] as ContentType[]),
            prompt: `${s.name} 오늘 ${chg >= 0 ? '+' : ''}${chg.toFixed(1)}% ${chg >= 0 ? '급등' : '급락'}! 놀라는 반응 글. "ㄷㄷ" "무슨 일??" 톤. 120자`,
            fallback: { title: `${s.name} ${chg >= 0 ? '급등' : '급락'} ${chg.toFixed(0)}%...`, content: `${s.name} 오늘 ${chg >= 0 ? '+' : ''}${chg.toFixed(1)}%?? ${chg >= 0 ? '무슨 호재가 있는 건지' : '무슨 일인지'} 아시는 분? ${p}이면 ${chg >= 0 ? '들어갈 만한' : '물타기 해야 하나'}...` },
          });
        }
      }

      // ── 소스 3: 인기 블로그 → 공유/추천 (2~3개) ──
      if (blogs?.length) {
        for (const b of pickN(blogs as any[], randInt(2, 3))) {
          const catKo = b.category === 'apt' ? '부동산' : b.category === 'stock' ? '주식' : '재테크';
          dynamicTemplates.push({
            baseKey: `dyn_blog_${b.id}`, category: 'free', type: 'content' as ContentType,
            prompt: `카더라 블로그에서 "${b.title.slice(0, 30)}" 글 읽고 유익했다는 자연스러운 후기. ${catKo} 관심자 시점. URL 없이. 150자`,
            fallback: { title: `이 ${catKo} 글 유익하네요`, content: `카더라 블로그에서 "${b.title.slice(0, 35)}" 읽었는데 정리가 잘 되어있어요. ${catKo} 관심 있으신 분들 한번 읽어보세요. 조회수 ${b.view_count}이면 다들 보고 계신 듯` },
          });
        }
      }

      // ── 소스 4: 핫 이슈 → 반응/질문 (1~2개) ──
      if (issues?.length) {
        for (const iss of pickN(issues as any[], randInt(1, 2))) {
          const keywords = (iss.detected_keywords || []).slice(0, 3).join(', ');
          const catKo = iss.category === 'apt' ? '부동산' : '주식';
          dynamicTemplates.push({
            baseKey: `dyn_iss_${(iss.title || '').slice(0, 8)}`, category: iss.category === 'apt' ? 'apt' : 'stock', type: pick(['news_react', 'question', 'casual'] as ContentType[]),
            prompt: `"${iss.title.slice(0, 40)}" 뉴스에 대한 일반인 반응. ${keywords} 키워드 자연스럽게 언급. 커뮤니티 글 톤. 150자`,
            fallback: { title: `${iss.title.slice(0, 35)}...`, content: `${iss.summary ? iss.summary.slice(0, 80) : iss.title}... ${catKo} 시장에 영향 있을까요? 다들 어떻게 보세요?` },
          });
        }
      }

      // ── 소스 5: 활발한 단지 → 청약/투자 질문 (1~2개) ──
      if (apts?.length) {
        for (const a of pickN(apts as any[], randInt(1, 2))) {
          dynamicTemplates.push({
            baseKey: `dyn_apt_${(a.name || '').slice(0, 6)}`, category: 'apt', type: pick(['question', 'review', 'casual'] as ContentType[]),
            prompt: `${a.region} ${a.sigungu || ''} ${a.name} (${a.builder || '시공사 미정'}) 관련 실수요자/투자자 관점 글. 180자`,
            fallback: { title: `${a.name} 관심 있는 분?`, content: `${a.region} ${a.sigungu || ''} ${a.name} 어떠세요? ${a.builder || ''} 시공이고 입지 궁금한데 주변 시세 대비 어떤지 아시는 분?` },
          });
        }
      }

      // ── 소스 6: 청약 마감 임박 → D-day 긴박감 (1~2개) ──
      if (activeSubs?.length) {
        for (const sub of pickN(activeSubs as any[], randInt(1, 2))) {
          const endDate = new Date(sub.rcept_endde);
          const dDay = Math.ceil((endDate.getTime() - Date.now()) / 86400000);
          const units = sub.tot_supply_hshld_co ? `${sub.tot_supply_hshld_co}세대` : '';
          const builder = sub.constructor_nm || '';
          const priceLim = sub.is_price_limit ? '분양가상한제' : '';
          dynamicTemplates.push({
            baseKey: `dyn_sub_${(sub.house_nm || '').slice(0, 6)}`, category: 'apt', type: pick(['question', 'casual', 'news_react'] as ContentType[]),
            prompt: `${sub.region_nm} ${sub.house_nm} 청약 마감 D-${dDay}! ${units} ${builder} ${priceLim}. "넣을까 말까" 고민하는 글. 150자`,
            fallback: { title: `${sub.house_nm} 청약 D-${dDay}인데 넣어요?`, content: `${sub.region_nm} ${sub.house_nm} 청약 마감이 ${dDay}일 남았어요. ${units} ${builder ? builder + ' 시공' : ''}${priceLim ? ', ' + priceLim : ''}인데 경쟁률 어떻게 나올지... 넣으신 분?` },
          });
        }
      }

      // ── 소스 7: 주식 뉴스 → 반응/질문 (1~2개) ──
      if (stockNews?.length) {
        for (const news of pickN(stockNews as any[], randInt(1, 2))) {
          const sentimentKo = news.sentiment_label === 'positive' ? '호재' : news.sentiment_label === 'negative' ? '악재' : '뉴스';
          dynamicTemplates.push({
            baseKey: `dyn_news_${(news.title || '').slice(0, 8)}`, category: 'stock', type: pick(['news_react', 'question', 'casual'] as ContentType[]),
            prompt: `"${news.title.slice(0, 40)}" ${sentimentKo} 뉴스에 대한 일반인 반응. ${news.symbol ? news.symbol + ' 관련' : ''}. "이거 보셨어요?" 톤. 130자`,
            fallback: { title: `${news.title.slice(0, 30)}...`, content: `방금 ${news.source || '뉴스'}에서 "${news.title.slice(0, 35)}" 봤는데 ${sentimentKo}인 것 같은데 다들 어떻게 보세요?` },
          });
        }
      }

      // ── 소스 8: 트렌딩 키워드 → 관심/질문 (1~2개) ──
      if (trending?.length) {
        for (const t of pickN(trending as any[], randInt(1, 2))) {
          const catKo = t.category === 'apt' ? '부동산' : t.category === 'stock' ? '주식' : '경제';
          dynamicTemplates.push({
            baseKey: `dyn_trend_${t.keyword?.slice(0, 6)}`, category: t.category === 'apt' ? 'apt' : 'stock', type: pick(['question', 'casual', 'debate'] as ContentType[]),
            prompt: `요즘 "${t.keyword}" 많이 검색되고 있는데 이유가 뭔지 궁금해하는 글. ${catKo} 관심자 시점. 130자`,
            fallback: { title: `요즘 "${t.keyword}" 왜 핫한가요?`, content: `${catKo} 쪽에서 "${t.keyword}" 검색량이 올라가고 있는데 무슨 이유인지 아시는 분? 뉴스를 놓친 건지...` },
          });
        }
      }

      // ── 소스 9: 실거래 고가 거래 → 놀라는 반응 (1~2개) ──
      if (recentDeals?.length) {
        for (const deal of pickN(recentDeals as any[], randInt(1, 2))) {
          const amount = Number(deal.deal_amount);
          const amountStr = amount >= 10000 ? `${(amount / 10000).toFixed(1)}억` : `${amount.toLocaleString()}만원`;
          const area = deal.exclusive_area ? `${Math.round(Number(deal.exclusive_area))}㎡` : '';
          dynamicTemplates.push({
            baseKey: `dyn_deal_${(deal.apt_name || '').slice(0, 6)}`, category: 'apt', type: pick(['news_react', 'casual', 'question'] as ContentType[]),
            prompt: `${deal.region_nm || ''} ${deal.sigungu || ''} ${deal.apt_name} ${area} ${amountStr}에 거래됐다는 소식 반응. "이 가격 실화?" 톤. 130자`,
            fallback: { title: `${deal.apt_name} ${amountStr} 실거래??`, content: `${deal.region_nm || ''} ${deal.apt_name} ${area}가 ${amountStr}에 거래됐다는데... ${deal.floor ? deal.floor + '층' : ''} 이 가격이면 우리 동네랑 비교하면 어떤 수준인지 궁금하네요` },
          });
        }
      }

      console.log(`[seed-posts] dynamic templates: ${dynamicTemplates.length} (stocks:${stocks?.length || 0}, blogs:${blogs?.length || 0}, issues:${issues?.length || 0}, apts:${apts?.length || 0}, subs:${activeSubs?.length || 0}, news:${stockNews?.length || 0}, trends:${trending?.length || 0}, deals:${recentDeals?.length || 0})`);
    } catch (e) {
      console.warn('[seed-posts] dynamic template error:', (e as Error).message);
    }

    const allTemplates = [...getTemplates(), ...dynamicTemplates];
    const results: any[] = [];
    const usedKeysThisRun = new Set<string>();

    for (const user of selectedUsers) {
      const contentType = selectContentType();
      let candidates = allTemplates.filter(t =>
        t.type === contentType && (!t.ageFilter || t.ageFilter === user.age_group) &&
        !recentTitlePrefixes.has(t.fallback.title.slice(0, 15)) && !usedKeysThisRun.has(t.baseKey)
      );
      if (candidates.length === 0) {
        candidates = allTemplates.filter(t =>
          !usedKeysThisRun.has(t.baseKey) && (!t.ageFilter || t.ageFilter === user.age_group) &&
          !recentTitlePrefixes.has(t.fallback.title.slice(0, 15))
        );
      }
      if (candidates.length === 0) continue;

      const template = pick(candidates);
      usedKeysThisRun.add(template.baseKey);

      const toneKey = `${user.age_group}_${user.gender === 'female' ? 'female' : 'male'}`;
      const tone = TONE[toneKey] || TONE['30대_male'];

      let postContent = await generateWithAI(template.prompt, tone);
      const aiGenerated = !!postContent;
      if (!postContent) postContent = { ...template.fallback };

      if (recentTitlePrefixes.has(postContent.title.slice(0, 15))) continue;

      const category = template.category;
      const postCreatedAt = new Date(Date.now() - randInt(1, 20) * 60000).toISOString();

      const { data: postData, error: postError } = await admin.from('posts').insert({
        author_id: user.id, title: postContent.title, content: postContent.content,
        category, region_id: 'all', is_anonymous: false, created_at: postCreatedAt,
      }).select('id').single();
      if (postError || !postData) continue;

      const postId = postData.id;
      const slugBase = postContent.title.replace(/[^가-힣a-z0-9\s-]/gi, '').replace(/\s+/g, '-').toLowerCase();
      await admin.from('posts').update({ slug: `${slugBase}-${postId}` }).eq('id', postId);

      // 댓글 0~4개
      const cc = randInt(0, 4);
      if (cc > 0) {
        const pool = COMMENTS[template.type] || COMMENTS.default;
        const cUsers = pickN(seedUsers.filter(u => u.id !== user.id), cc);
        await admin.from('comments').insert(cUsers.map((cu: SeedUser) => ({
          post_id: postId, author_id: cu.id,
          content: pick(pool[cu.age_group] || pool['30대']),
          comment_type: 'comment',
          created_at: new Date(new Date(postCreatedAt).getTime() + randInt(5, 240) * 60000).toISOString(),
        })));
        await admin.from('posts').update({ comments_count: cc }).eq('id', postId);
      }

      // 좋아요 0~8개
      const lc = randInt(0, 8);
      if (lc > 0) {
        const lUsers = pickN(seedUsers.filter(u => u.id !== user.id), Math.min(lc, seedUsers.length - 1));
        await admin.from('post_likes').insert(lUsers.map((u: SeedUser) => ({ post_id: postId, user_id: u.id }))).then(() => {});
        await admin.from('posts').update({ likes_count: lc }).eq('id', postId);
      }

      results.push({ title: postContent.title, user: user.nickname, age: user.age_group, category, type: template.type, aiGenerated });
    }

    try { revalidatePath('/feed'); revalidatePath('/hot'); } catch {}
    return { processed: postCount, created: results.length, failed: postCount - results.length, metadata: { posts: results } };
  });

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 200 });
  return NextResponse.json({ ok: true, ...result });
}
