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
  // 뻘글 (대폭 확대)
  { category: 'free', title: '아 배고프다', content: '점심 뭐 먹을지 고민인데 추천 좀요 ㅋㅋ', age: '20대' },
  { category: 'free', title: '오늘 날씨 실화??', content: '아침에 반팔 입고 나왔는데 저녁에 패딩이 필요함 ㅋㅋㅋ', age: '20대' },
  { category: 'free', title: '월요일이 왜 이렇게 길어', content: '아직 화요일도 안 됐는데 벌써 지침...', age: '20대' },
  { category: 'free', title: '야근하면서 주식 보는 사람', content: '나만 그런 거 아니죠? ㅋㅋ HTS 켜놓고 일하는 척', age: '20대' },
  { category: 'free', title: '커피값이 진짜 올랐다', content: '아아 한잔에 5천원이면 한달에 15만원인데... 그래도 못 끊는 사람', age: '20대' },
  { category: 'free', title: '택배 올 때까지 못 자는 사람', content: '새벽배송 시켰는데 5시부터 깨서 기다리는 중 ㅋ', age: '20대' },
  { category: 'free', title: '넷플릭스 뭐 봐요 요즘', content: '볼 게 없어서 같은 거 돌려보는 중... 추천 부탁', age: '20대' },
  { category: 'free', title: '다이어트 내일부터 한다', content: '매일 내일부터라고 하는데 오늘도 치킨 시켜먹음 ㅋ', age: '20대' },
  { category: 'free', title: '장보면 깜짝 놀라요', content: '계란 한판에 만원이 넘더라고요. 물가가 진짜 미쳤어요 ㅠ', age: '30대' },
  { category: 'free', title: '주말에 뭐 하세요?', content: '날씨 좋은데 집에만 있기 아까워요. 나들이 코스 추천해주세요!' },
  { category: 'free', title: '월급이 통장을 스쳐간다', content: '급여일인데 카드값 나가고 보험료 나가고 남는 게 없음', age: '30대' },
  { category: 'free', title: '점심시간에 주식 보는 직장인', content: '12시 되면 자동으로 HTS 켜지는 건 직업병인가요 ㅋ', age: '30대' },
  { category: 'free', title: '퇴근 후 치맥 한잔', content: '오늘 하루 수고했으니까 치킨에 맥주 한잔! 다들 수고하셨습니다', age: '30대' },
  { category: 'free', title: '월급 루팡 고백', content: '솔직히 회사에서 카더라 피드 보고 있는 사람 나만 있는 건 아니겠지?', age: '30대' },
  { category: 'free', title: '아이 학원비가 월급보다 비쌈', content: '국어 영어 수학 태권도... 이러다 내 노후가 없어지겠어요', age: '40대' },
  { category: 'free', title: '비 올 때 전 부치는 날', content: '비 오니까 전 부치고 막걸리 한잔 해야지. 날씨 핑계 인정 ㅎ', age: '40대' },
  { category: 'free', title: '건강이 재산이에요', content: '작년에 건강검진 받고 깜짝 놀랐습니다. 다들 건강검진 꼭 받으세요', age: '50대' },
  { category: 'free', title: '비상금 얼마나 갖고 계세요?', content: '갑자기 궁금해졌는데 비상금 보통 월급의 몇 배 정도?' },
  { category: 'free', title: '보험 정리 좀 해야겠어요', content: '보험료가 월 25만원 넘는데 진짜 다 필요한 건지 모르겠어요' },
  { category: 'free', title: '카드 혜택 추천 부탁', content: '신용카드 바꾸려고 하는데 요즘 혜택 좋은 카드 추천해주세요' },
  // 동네
  { category: 'local', title: '우리 동네 개발 소식', content: '교통이나 재개발 관련 호재 있으면 공유해주세요!' },
  { category: 'local', title: '동네 맛집 추천', content: '이번 주말에 맛있는 거 먹으러 갈 건데 추천 좀요!' },
  { category: 'local', title: '우리 동네 아파트 분위기', content: '요즘 매물은 많은데 거래가 안 되는 느낌? 체감이 어떠세요?' },
];

const COMMENTS: Record<string, string[]> = {
  '20대': ['ㄹㅇ 공감ㅋㅋ','오 대박','나도 이거 알아보는 중ㅎㅎ','ㅋㅋㅋ 진짜','ㅇㅈ요','이거 실화?','개꿀팁','북마크함','나만 그런 줄ㅋ','헐 대박','존버ㅋㅋ','ㄱㅅㄱㅅ','이거 진짜임?','아 공감 ㅋㅋ'],
  '30대': ['공감합니다 ㅎㅎ','정보 감사해요!','저도 같은 고민이에요','좋은 정보네요','이거 유용하다','참고할게요!','저도 해봐야겠어요','맞아요 진짜','정보 감사합니다~','공감 백배!','저도 알아보는 중','오 몰랐네요'],
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

    const postCount = randInt(2, 4);
    const results: { title: string; user: string; age: string; category: string }[] = [];
    let creditExhausted = false;

    for (let i = 0; i < postCount; i++) {
      if (creditExhausted) break;
      const user = pick(seedUsers);
      const toneKey = `${user.age_group}_${user.gender === 'female' ? 'female' : 'male'}`;
      const tone = TONE_GUIDE[toneKey] || TONE_GUIDE['30대_male'];

      // 카테고리 — 뻘글 40%, 주식 25%, 부동산 20%, 동네 15%
      const r = Math.random();
      const category = r < 0.40 ? 'free' : r < 0.65 ? 'stock' : r < 0.85 ? 'apt' : 'local';

      const filtered = TEMPLATES.filter(t => t.category === category && (!t.age || t.age === user.age_group));
      const fallback = filtered.length > 0 ? pick(filtered) : pick(TEMPLATES.filter(t => t.category === category));
      let title = fallback.title, content = fallback.content;

      // 템플릿 변형 (AI 제거 — 비용 절감, 템플릿 풀 충분)
      // 날짜/요일 변수 치환으로 자연스러움 유지
      title = title.replace(/4월/g, `${new Date().getMonth() + 1}월`);
      if (content.includes(dateTag)) content = content.replace(dateTag, new Date().toLocaleDateString('ko-KR'));

      // 중복 체크
      const { data: dup } = await admin.from('posts').select('id').eq('title', title).gte('created_at', new Date(Date.now() - 21600000).toISOString()).limit(1);
      if (dup && dup.length > 0) continue;

      const finalRegion = category === 'local' ? user.region_text : 'all';
      const postCreatedAt = new Date(Date.now() - randInt(0, 30) * 60000).toISOString();
      const slugBase = title.replace(/[^가-힣a-z0-9\s-]/gi, '').replace(/\s+/g, '-').toLowerCase();

      const { data: postData, error: postError } = await admin.from('posts').insert({
        author_id: user.id, title, content, category, region_id: finalRegion,
        is_anonymous: false, created_at: postCreatedAt,
      }).select('id').single();
      if (postError || !postData) continue;
      const postId = postData.id;
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
