export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import { withCronLogging } from '@/lib/cron-logger';

/**
 * seed-posts 크론 — v3 (페르소나 기반 자연스러운 피드 게시글)
 *
 * 시드 유저별 나이/성별/지역 반영
 * 20대~50대 연령대별 언어체 차별화
 * 주식/부동산 + 뻘글(일상/잡담) 비율 혼합
 * AI 생성 + 템플릿 폴백
 * 자연스러운 댓글 (연령대별)
 */

const today = new Date();
const dateTag = `${today.getMonth() + 1}/${today.getDate()}`;
const dayNames = ['일','월','화','수','목','금','토'];
const dayName = dayNames[today.getDay()];

const TONE_GUIDE: Record<string, string> = {
 '20대_male': '20대 남성. 반말+존댓말 섞어, ㅋㅋ ㅎㅎ 자연스럽게. "~했는데" "~인듯" "ㄹㅇ" 같은 표현. 예: "오늘 장 개폭락했는데 ㅋㅋ 멘탈 나감"',
 '20대_female': '20대 여성. "~했어요" "~것 같아요" 존댓말에 "ㅠㅠ" "ㅎㅎ". 예: "요즘 적금 이자 너무 적지 않아요? ㅠㅠ"',
 '30대_male': '30대 남성. 존댓말 베이스 편하게. "~합니다" "~것 같네요". 분석적. 예: "삼전 PER 기준으로 보면 아직 저평가 구간"',
 '30대_female': '30대 여성. 존댓말+친근. "~예요" "~거든요" "~네요". 공감 표현. 예: "요즘 전세 구하기 진짜 힘들지 않나요?"',
 '40대_male': '40대 남성. 격식 존댓말. "~입니다". 경험 기반 조언. 예: "20년 투자 경험상 분산투자가 답입니다"',
 '40대_female': '40대 여성. 따뜻한 존댓말. "~해요" "~더라고요". 실생활 경험. 예: "아이 학군 때문에 이사 고민이에요"',
 '50대_male': '50대 남성. 격식+차분. "~하는 것이 좋겠습니다". 예: "노후 자금은 안정적인 배당주 위주로 구성하는 게 바람직합니다"',
 '50대_female': '50대 여성. 따뜻+경험. "~했어요" "~이더라고요". 예: "남편이랑 둘이 연금저축 넣고 있는데 뿌듯해요"',
};

interface Template { category: string; title: string; content: string; age?: string }
const TEMPLATES: Template[] = [
 // 주식
 { category: 'stock', title: `${dayName}요일 장 마감 복기`, content: '오늘 장 어떠셨어요? 수익이든 손실이든 같이 공유해봐요' },
 { category: 'stock', title: '요즘 반도체주 어떻게 보세요?', content: 'HBM 수요는 계속 증가하는데 주가는 지지부진하네요' },
 { category: 'stock', title: 'ETF 적립식 vs 직접 매수', content: '매달 ETF 적립하는 것과 직접 종목 골라 매수하는 것 중에 뭐가 나을까요?' },
 { category: 'stock', title: '미장 따라갈까 국장 버틸까', content: '나스닥은 계속 오르는데 코스피는 제자리...' },
 { category: 'stock', title: '배당주 추천 좀요', content: '안정적으로 배당 받을 수 있는 종목 추천 부탁드립니다' },
 { category: 'stock', title: `오늘 투자 일기 ${dateTag}`, content: '오늘 매매 내역이나 느낀 점 공유해요' },
 { category: 'stock', title: '2차전지 아직 살아있나요?', content: '조정 많이 받았는데 분할매수 들어가도 될까요?' },
 // 부동산
 { category: 'apt', title: '4월 청약 일정 정리', content: '이번 달 나오는 청약 물량 확인하셨나요?' },
 { category: 'apt', title: '전세 vs 매매 고민', content: '지금 전세로 계속 살지 무리해서라도 매매를 해야 할지' },
 { category: 'apt', title: '청약 가점 낮으면 어디를', content: '40점대인데 수도권 당첨 가능할까요?' },
 { category: 'apt', title: '이번 달 입주 물량 체크', content: '입주 물량 많으면 전세가 하락 가능성 있으니 참고하세요' },
 { category: 'apt', title: '분양권 전매 고민', content: '프리미엄이 좀 붙었는데 지금 팔아야 할지 입주까지 기다려야 할지' },
 // 뻘글 (대폭 확대 — 55%)
 { category: 'free', title: '아 배고프다', content: '점심 뭐 먹을지 고민인데 추천 좀요 ㅋㅋ', age: '20대' },
 { category: 'free', title: '오늘 날씨 실화?', content: '아침에 반팔 입고 나왔는데 저녁에 패딩이 필요함 ㅋㅋㅋ', age: '20대' },
 { category: 'free', title: '월요일이 왜 이렇게 길어', content: '아직 화요일도 안 됐는데 벌써 지침...', age: '20대' },
 { category: 'free', title: '야근하면서 주식 보는 사람', content: '나만 그런 거 아니죠? ㅋㅋ HTS 켜놓고 일하는 척', age: '20대' },
 { category: 'free', title: '커피값이 진짜 올랐다', content: '아아 한잔에 5천원이면 한달에 15만원인데... 그래도 못 끊는 사람', age: '20대' },
 { category: 'free', title: '택배 올 때까지 못 자는 사람', content: '새벽배송 시켰는데 5시부터 깨서 기다리는 중 ㅋ', age: '20대' },
 { category: 'free', title: '넷플릭스 뭐 봐요 요즘', content: '볼 게 없어서 같은 거 돌려보는 중... 추천 부탁', age: '20대' },
 { category: 'free', title: '다이어트 내일부터 한다', content: '매일 내일부터라고 하는데 오늘도 치킨 시켜먹음 ㅋ', age: '20대' },
 { category: 'free', title: '장보면 깜짝 놀라요', content: '계란 한판에 만원이 넘더라고요. 물가가 진짜 미쳤어요 ㅠ', age: '30대' },
 { category: 'free', title: '주말에 뭐 하세요?', content: '날씨 좋은데 집에만 있기 아까워요. 나들이 코스 추천해주세요' },
 { category: 'free', title: '월급이 통장을 스쳐간다', content: '급여일인데 카드값 나가고 보험료 나가고 남는 게 없음', age: '30대' },
 { category: 'free', title: '점심시간에 주식 보는 직장인', content: '12시 되면 자동으로 HTS 켜지는 건 직업병인가요 ㅋ', age: '30대' },
 { category: 'free', title: '퇴근 후 치맥 한잔', content: '오늘 하루 수고했으니까 치킨에 맥주 한잔 다들 수고하셨습니다', age: '30대' },
 { category: 'free', title: '월급 루팡 고백', content: '솔직히 회사에서 카더라 피드 보고 있는 사람 나만 있는 건 아니겠지?', age: '30대' },
 { category: 'free', title: '아이 학원비가 월급보다 비쌈', content: '국어 영어 수학 태권도... 이러다 내 노후가 없어지겠어요', age: '40대' },
 { category: 'free', title: '비 올 때 전 부치는 날', content: '비 오니까 전 부치고 막걸리 한잔 해야지. 날씨 핑계 인정 ㅎ', age: '40대' },
 { category: 'free', title: '건강이 재산이에요', content: '작년에 건강검진 받고 깜짝 놀랐습니다. 다들 건강검진 꼭 받으세요', age: '50대' },
 { category: 'free', title: '비상금 얼마나 갖고 계세요?', content: '갑자기 궁금해졌는데 비상금 보통 월급의 몇 배 정도?' },
 { category: 'free', title: '보험 정리 좀 해야겠어요', content: '보험료가 월 25만원 넘는데 진짜 다 필요한 건지 모르겠어요' },
 { category: 'free', title: '카드 혜택 추천 부탁', content: '신용카드 바꾸려고 하는데 요즘 혜택 좋은 카드 추천해주세요' },
 // ── 뻘글 추가분 ──
 { category: 'free', title: '알바 뛸까 투자할까', content: '용돈이 부족한데 알바를 뛰는 게 나을까 그 시간에 공부를 할까', age: '20대' },
 { category: 'free', title: '오늘 카페 어디 감?', content: '작업할 카페 추천해주세요. 콘센트 많은 곳으로 ㅎ', age: '20대' },
 { category: 'free', title: '중고거래 사기 당할 뻔', content: '당근에서 직거래 했는데 진짜 아슬아슬했음;; 조심하세요 ㅋ', age: '20대' },
 { category: 'free', title: '자취 꿀팁 공유', content: '자취 3년차인데 가성비 좋은 생활 꿀팁 있으면 같이 공유해요', age: '20대' },
 { category: 'free', title: '요즘 물가 체감이 어때요?', content: '편의점 삼각김밥도 2천원 넘는 세상... 다들 장 어디서 보세요?', age: '20대' },
 { category: 'free', title: '쿠팡 와우 해지할까 말까', content: '한달에 4,990원인데 로켓배송 없으면 못 살 것 같기도 하고', age: '20대' },
 { category: 'free', title: '이직 고민 중', content: '연봉은 비슷한데 워라밸이 좋은 회사 vs 연봉 500 더 주는 회사', age: '30대' },
 { category: 'free', title: '아이한테 용돈 얼마 주세요?', content: '초등학생 아이 용돈 기준이 궁금해요. 다들 얼마 정도?', age: '30대' },
 { category: 'free', title: '출퇴근 시간이 아깝다', content: '왕복 2시간인데... 이 시간에 뭐라도 하고 싶은데 항상 폰만 봄', age: '30대' },
 { category: 'free', title: '점심값 만원 시대', content: '구내식당 없는 회사는 점심이 전쟁이에요. 김밥천국도 8천원;', age: '30대' },
 { category: 'free', title: '요즘 좋았던 유튜브 채널', content: '재테크 관련 유튜브 채널 추천해주세요 자극적이지 않은 걸로', age: '30대' },
 { category: 'free', title: '연말정산 미리 준비하시나요?', content: '매년 토해내기만 하는데 올해는 좀 돌려받고 싶어요', age: '30대' },
 { category: 'free', title: '집 정리가 안 된다', content: '미니멀리즘 도전 3일차에 포기... 버리는 것도 기술이에요', age: '30대' },
 { category: 'free', title: '아침에 일어나기 힘든 계절', content: '이불 밖은 위험해... 알람 5번 맞추는 사람 모여', age: '20대' },
 { category: 'free', title: '반려동물 키우시는 분', content: '고양이 키우고 싶은데 자취방에서 가능할까요? 경험담 부탁', age: '20대' },
 { category: 'free', title: '운동 뭐 하세요?', content: '헬스 갈까 필라테스 갈까 수영 갈까... 결정장애 ㅠ', age: '30대' },
 { category: 'free', title: '차 살까 안 살까', content: '서울인데 차가 필요한지 모르겠어요. 유지비만 생각하면 ㄷㄷ', age: '30대' },
 { category: 'free', title: '연금저축 하고 계세요?', content: 'IRP vs 연금저축펀드 뭐가 나을지 아직도 모르겠음', age: '30대' },
 { category: 'free', title: '부모님 용돈 얼마 드려요?', content: '매달 드리고 싶은데 현실적으로 고민이에요. 다들 어느 정도?', age: '30대' },
 { category: 'free', title: '캠핑 다녀왔습니다', content: '날씨 좋아서 가족 캠핑 다녀왔어요. 근데 장비 사는 데 돈이... ㅎ', age: '40대' },
 { category: 'free', title: '은퇴 후 뭐 하고 싶으세요?', content: '요즘 은퇴 후 계획을 세워보는데 막상 뭘 할지 모르겠어요', age: '40대' },
 { category: 'free', title: '아파트 관리비가 폭탄', content: '여름 전기세 합치면 40만원 넘는데 다들 비슷한가요?', age: '40대' },
 { category: 'free', title: '맥주 추천 좀', content: '편의점 맥주 중에 가성비 좋은 거 추천해주세요. 오늘 퇴근 후 한잔', age: '30대' },
 { category: 'free', title: '로또 이번 주 사셨나요', content: '매주 5천원씩 사는데 당첨은 5등이 최고 ㅋㅋ', age: '30대' },
 { category: 'free', title: '통신비 절약 팁', content: '알뜰폰으로 바꾸니까 월 2만원대면 충분하더라고요. 추천', age: '30대' },
 { category: 'free', title: '짠테크 고수 모여라', content: '가계부 쓰시는 분? 앱 추천이랑 절약 팁 공유해요', age: '30대' },
 { category: 'free', title: '퇴사 후기 들려드림', content: '3년 다닌 회사 퇴사하고 3개월 차. 솔직한 후기', age: '30대' },
 { category: 'free', title: '오늘 하루 감사한 것 3가지', content: '1. 출근 안 하는 주말 2. 따뜻한 커피 3. 카더라 피드 ㅎ' },
 // ── 두산위브 트리니뷰 구명역 특집 (5월 분양 핫이슈) ──
 { category: 'apt', title: '구포동 두산위브 트리니뷰 청약 고민', content: '구명역 바로 앞이라 입지는 괜찮은데 지역주택조합이라 좀 걱정... 분양가 얼마나 나올지도 궁금하고 다들 어떻게 보세요?' },
 { category: 'apt', title: '부산 북구에 드디어 신축이', content: '구포동에 두산위브가 들어온다는데 구명역 앞이라 위치 좋더라고요. 5월 모집공고 나온다는데 경쟁률 어떨지' },
 { category: 'apt', title: '지역주택조합 경험 있으신 분', content: '두산위브 트리니뷰 구명역이 지조 사업인데 추가분담금 같은 거 실제로 나오나요? 경험자분 의견 부탁' },
 { category: 'apt', title: '구포동 시세 많이 올랐네', content: '반도유보라 75타입이 5억 가까이 가는데 여기에 두산위브까지 오면 구포동 시세 더 오를까요?', age: '30대' },
 { category: 'apt', title: '구명역 역세권 신축 나온다', content: '구명역 도보 1분이면 진짜 초역세권인데 분양가만 적정하면 대박 아닌가요? 5월 공고 기다리는 중' },
 { category: 'apt', title: '두산위브 분양가 얼마 나올까', content: '구포동 반도유보라가 75타입 4.6억인데 지조라 좀 싸게 나오겠죠? 3억대면 로또급일 듯', age: '20대' },
 // 동네
 { category: 'local', title: '우리 동네 개발 소식', content: '교통이나 재개발 관련 호재 있으면 공유해주세요' },
 { category: 'local', title: '동네 맛집 추천', content: '이번 주말에 맛있는 거 먹으러 갈 건데 추천 좀요' },
 { category: 'local', title: '우리 동네 아파트 분위기', content: '요즘 매물은 많은데 거래가 안 되는 느낌? 체감이 어떠세요?' },
];

const COMMENTS: Record<string, string[]> = {
 '20대': ['ㄹㅇ 공감ㅋㅋ','오 대박','나도 이거 알아보는 중ㅎㅎ','ㅋㅋㅋ 진짜','ㅇㅈ요','이거 실화?','개꿀팁','북마크함','나만 그런 줄ㅋ','헐 대박','존버ㅋㅋ','ㄱㅅㄱㅅ','이거 진짜임?','아 공감 ㅋㅋ'],
 '30대': ['공감합니다 ㅎㅎ','정보 감사해요','저도 같은 고민이에요','좋은 정보네요','이거 유용하다','참고할게요','저도 해봐야겠어요','맞아요 진짜','정보 감사합니다~','공감 백배','저도 알아보는 중','오 몰랐네요'],
 '40대': ['경험상 맞는 말씀','좋은 정보 감사합니다','참고가 되네요','그렇군요','저도 비슷한 생각','도움이 됐습니다','좋은 의견이십니다','공감합니다','저도 그랬어요','유익하네요','알아봐야겠어요'],
 '50대': ['좋은 정보 감사합니다','참고하겠습니다','경험에서 나오는 말씀이네요','맞습니다','도움이 됐습니다','좋은 말씀','공감이 됩니다','새로 알았네요'],
};

function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN<T>(arr: T[], n: number): T[] { return [...arr].sort(() => Math.random() - 0.5).slice(0, Math.min(n, arr.length)); }

interface SeedUser { id: string; nickname: string; age_group: string; gender: string; region_text: string; bio: string }

export async function GET(req: NextRequest) {
 const authHeader = req.headers.get('authorization');
 const cronSecret = process.env.CRON_SECRET;
 if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

 const result = await withCronLogging('seed-posts', async () => {
 const admin = getSupabaseAdmin();
 const { data: rawUsers } = await admin.from('profiles').select('id, nickname, age_group, gender, region_text, bio').eq('is_seed', true);
 const seedUsers: SeedUser[] = (rawUsers || []).map((u: any) => ({
 id: u.id, nickname: u.nickname || '익명',
 age_group: u.age_group || '30대', gender: u.gender === 'female' ? 'female' : 'male',
 region_text: u.region_text || '서울', bio: u.bio || '',
 }));
 if (seedUsers.length === 0) return { processed: 0, created: 0, failed: 0 };

 // ── 엔티티 동적 템플릿: 실제 종목명/현장명 자연스럽게 언급 ──
 let entityTemplates: Template[] = [];
 try {
   const [{ data: topStocks }, { data: topApts }] = await Promise.all([
     admin.from('stock_quotes').select('symbol, name, price, change_pct, currency, sector').eq('is_active', true).gt('price', 0).order('volume', { ascending: false, nullsFirst: false }).limit(40),
     (admin as any).from('apt_sites').select('name, region, sigungu, builder').eq('is_active', true).not('analysis_text', 'is', null).order('page_views', { ascending: false, nullsFirst: false }).limit(40),
   ]);
   const rs = (a: any[]) => a[Math.floor(Math.random() * a.length)];
   if (topStocks?.length) {
     // 3~5개 종목을 뽑아서 다양한 패턴 생성
     const picked = topStocks.sort(() => Math.random() - 0.5).slice(0, 5);
     for (const s of picked) {
       const isUS = s.currency === 'USD';
       const p = isUS ? `$${Number(s.price).toFixed(0)}` : `${Number(s.price).toLocaleString()}원`;
       const chg = Number(s.change_pct);
       const s2 = rs(topStocks.filter((x: any) => x.symbol !== s.symbol && x.sector === s.sector));
       const patterns = [
         { title: `${s.name} 지금 매수 타이밍일까요?`, content: `${s.name}(${s.symbol}) 현재가 ${p}인데 여기서 분할매수 괜찮을까요? ${s.sector || ''} 섹터 전망이 궁금합니다` },
         { title: `${s.name} ${chg >= 0 ? '상승' : '하락'} 이유 아시는 분?`, content: `${s.name} 오늘 ${chg >= 0 ? '+' : ''}${chg.toFixed(1)}% ${chg >= 0 ? '올랐는데' : '빠졌는데'} 무슨 뉴스 있나요?` },
         { title: `${s.name} 장기 보유 vs 단타`, content: `${s.name} 보유 중인데 장기 가져갈지 단기로 수익 실현할지 고민이에요` },
         { title: `${s.name} 배당은 어떤가요?`, content: `${s.name}(${s.symbol}) 배당 투자 괜찮을까요? 배당 수익률이나 배당 성장률 아시는 분` },
         ...(s2 ? [{ title: `${s.name} vs ${s2.name} 비교`, content: `같은 ${s.sector || ''} 섹터인데 ${s.name}이랑 ${s2.name} 중에 어디가 더 나을까요? 카더라에서 비교해봤는데 의견 궁금해요` }] : []),
         { title: `${s.name} 차트 분석 부탁`, content: `${s.name} 기술적 분석 잘하시는 분 계신가요? 지지선 저항선 어디쯤인지 궁금합니다` },
       ];
       entityTemplates.push({ category: 'stock', ...rs(patterns) });
     }
   }
   if (topApts?.length) {
     const picked = topApts.sort(() => Math.random() - 0.5).slice(0, 5);
     for (const a of picked) {
       const patterns = [
         { title: `${a.name} 청약 넣을지 고민`, content: `${a.region} ${a.sigungu || ''} ${a.name} 관심 있는 분? ${a.builder || '시공사'} 시공인데 경쟁률이 걱정이에요` },
         { title: `${a.name} 분양가 어떻게 보세요?`, content: `${a.name} 분양가가 주변 시세 대비 적정한지 궁금해요. ${a.region} ${a.sigungu || ''} 지역 아시는 분 의견 부탁` },
         { title: `${a.name} 주변 인프라 어때요?`, content: `${a.name} 근처 학교, 마트, 교통 상황 아시는 분 있으면 정보 부탁드려요` },
         { title: `${a.region} ${a.sigungu || ''} 부동산 전망`, content: `${a.region} ${a.sigungu || ''} 지역 부동산 분위기 어떤가요? ${a.name} 때문에 관심 갖게 됐는데 투자 가치가 있을까요` },
         { title: `${a.name} 입주 준비하시는 분?`, content: `${a.name} 계약하신 분 계신가요? 입주 준비 꿀팁이나 인테리어 비용 공유해요` },
         { title: `${a.builder || '시공사'} 시공 아파트 후기`, content: `${a.builder || '시공사'}에서 시공한 다른 아파트 살아보신 분 있나요? ${a.name} 청약 고민 중이라 시공 품질이 궁금해요` },
       ];
       entityTemplates.push({ category: 'apt', ...rs(patterns) });
     }
   }
 } catch {}
 // 동적 템플릿을 기존 템플릿 풀에 합치기
 const ALL_TEMPLATES = [...TEMPLATES, ...entityTemplates];

 const postCount = randInt(2, 4); // v3: 2~4개로 축소 (기존 4~7)
 const results: { title: string; user: string; age: string; category: string }[] = [];
 let creditExhausted = false;

 // ── 라운드 로빈: 최근 게시한 시드 유저 제외 ──
 const { data: recentPosts } = await admin.from('posts')
 .select('author_id')
 .in('author_id', seedUsers.map(u => u.id))
 .order('created_at', { ascending: false })
 .limit(postCount + 2);
 const recentAuthorIds = new Set((recentPosts || []).map(p => p.author_id));
 // 최근 쓰지 않은 유저를 우선, 없으면 전체에서 선택
 const availableUsers = seedUsers.filter(u => !recentAuthorIds.has(u.id));
 const userPool = availableUsers.length >= postCount ? availableUsers : seedUsers;
 // 셔플해서 순서대로 사용 (같은 유저 연속 방지)
 const shuffledUsers = [...userPool].sort(() => Math.random() - 0.5);

 // ── 7일 중복 체크용 기존 제목 가져오기 ──
 const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
 const { data: existingPosts } = await admin.from('posts')
 .select('title')
 .in('author_id', seedUsers.map(u => u.id))
 .gte('created_at', sevenDaysAgo);
 const usedTitles = new Set((existingPosts || []).map(p => p.title));
 const usedTemplatesThisRun = new Set<string>();

 for (let i = 0; i < postCount; i++) {
 if (creditExhausted) break;
 // 라운드 로빈 유저 선택
 const user = shuffledUsers[i % shuffledUsers.length];
 const toneKey = `${user.age_group}_${user.gender === 'female' ? 'female' : 'male'}`;
 const tone = TONE_GUIDE[toneKey] || TONE_GUIDE['30대_male'];

 // 카테고리 — 뻘글 55%, 주식 18%, 부동산 15%, 동네 12%
 const r = Math.random();
 const category = r < 0.35 ? 'stock' : r < 0.65 ? 'apt' : r < 0.90 ? 'free' : 'local';

 const filtered = ALL_TEMPLATES.filter(t => t.category === category && (!t.age || t.age === user.age_group) && !usedTemplatesThisRun.has(t.title));
 const fallback = filtered.length > 0 ? pick(filtered) : pick(ALL_TEMPLATES.filter(t => t.category === category && !usedTemplatesThisRun.has(t.title)));

 // ── 동적 변형: 매번 다른 제목/내용 생성 ──
 const hour = new Date().getHours();
 const timeSuffix = hour < 12 ? '오전' : hour < 18 ? '오후' : '저녁';
 const variations = [
 `(${dateTag})`, `[${timeSuffix}]`, `— ${dayName}요일`, '',
 `(${user.region_text})`, `${dateTag} ver.`, `#${Math.floor(Math.random() * 99) + 1}`,
 ];
 let title = fallback.title;
 let content = fallback.content;

 // 기본 치환
 title = title.replace(/4월/g, `${new Date().getMonth() + 1}월`);

 // 제목에 변형 추가 (7일 내 같은 제목 방지)
 // v3: 기본 제목의 앞 15자가 겹치면 중복으로 판단 (변형 suffix 무시)
 const baseTitle15 = title.slice(0, 15);
 const isTitleUsed = [...usedTitles].some(t => t.startsWith(baseTitle15));
 if (isTitleUsed) continue; // 유사 제목 존재 → 스킵 (변형 시도 안 함)

 const finalRegion = category === 'local' ? user.region_text : 'all';
 const postCreatedAt = new Date(Date.now() - randInt(0, 30) * 60000).toISOString();
 const slugBase = title.replace(/[^가-힣a-z0-9\s-]/gi, '').replace(/\s+/g, '-').toLowerCase();

 const { data: postData, error: postError } = await admin.from('posts').insert({
 author_id: user.id, title, content, category, region_id: finalRegion,
 is_anonymous: false, created_at: postCreatedAt,
 }).select('id').single();
 if (postError || !postData) continue;
 const postId = postData.id;
 usedTitles.add(title); // 이번 실행에서도 중복 방지
 usedTemplatesThisRun.add(fallback.title); // 같은 템플릿 재사용 방지
 await admin.from('posts').update({ slug: `${slugBase}-${postId}` }).eq('id', postId);

 // 댓글 0~5개 (연령대별)
 const cc = randInt(0, 5);
 if (cc > 0) {
 const cUsers = pickN(seedUsers, cc);
 await admin.from('comments').insert(cUsers.map((cu: SeedUser) => ({
 post_id: postId, author_id: cu.id,
 content: pick(COMMENTS[cu.age_group] || COMMENTS['30대']),
 comment_type: 'comment',
 created_at: new Date(new Date(postCreatedAt).getTime() + randInt(3, 180) * 60000).toISOString(),
 })));
 await admin.from('posts').update({ comments_count: cc }).eq('id', postId);
 }

 // 좋아요 0~10개
 const lc = randInt(0, 10);
 if (lc > 0) {
 const lUsers = pickN(seedUsers, Math.min(lc, seedUsers.length));
 await admin.from('post_likes').insert(lUsers.map((u: SeedUser) => ({ post_id: postId, user_id: u.id }))).then(() => {});
 await admin.from('posts').update({ likes_count: lc }).eq('id', postId);
 }
 results.push({ title, user: user.nickname, age: user.age_group, category });
 }

 try { revalidatePath('/feed'); revalidatePath('/hot'); } catch {}
 fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app'}/api/revalidate`, {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ secret: cronSecret, path: '/feed' }),
 }).catch(() => {});

 return { processed: postCount, created: results.length, failed: postCount - results.length, metadata: { posts: results, creditExhausted } };
 });
 if (!result.success) return NextResponse.json({ error: result.error }, { status: 200 });
 return NextResponse.json({ ok: true, ...result });
}
