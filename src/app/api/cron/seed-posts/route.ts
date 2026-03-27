export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import { withCronLogging } from '@/lib/cron-logger';

const CATEGORIES = ['stock', 'apt', 'free', 'local'];
const REGIONS = ['서울','부산','경기','인천','대구','광주','대전','울산','세종','제주','강원','충북','충남','전북','전남','경북','경남'];

// Dynamic date suffix to prevent duplicate exhaustion
const today = new Date();
const dateTag = `${today.getMonth() + 1}/${today.getDate()}`;
const dayNames = ['일','월','화','수','목','금','토'];
const dayName = dayNames[today.getDay()];

const TEMPLATES = [
  // Stock
  { category: 'stock', title: `${dayName}요일 장 마감 후 정리`, content: '오늘 장 어떠셨나요? 수익 나신 분도 있고 손실 보신 분도 있을 텐데, 다 같이 복기해봐요. 내일 전략은 어떻게 잡으셨나요?' },
  { category: 'stock', title: `이번 주 주목할 종목 공유 (${dateTag})`, content: '이번 주 관심 종목 공유합니다. 실적 발표 시즌이라 변동성이 클 수 있으니 주의하세요. 다른 분들 관심 종목도 알려주세요!' },
  { category: 'stock', title: `반도체 수급 분석 ${dateTag}`, content: 'HBM 수요가 계속 증가하면서 SK하이닉스와 삼성전자 반도체 사업부 전망이 밝습니다. 다만 미중 갈등으로 인한 규제 리스크는 주의해야 합니다.' },
  { category: 'stock', title: `배당주 포트폴리오 점검 시기입니다`, content: '배당 시즌이 다가오고 있어요. 고배당주 위주로 포트폴리오 점검하실 때입니다. 배당성향, 지급 이력, 실적 성장성을 같이 봐야 합니다.' },
  { category: 'stock', title: `AI 관련주 아직 유효한가요?`, content: 'AI 테마가 작년부터 강세인데 지금 진입해도 괜찮을까요? 실적이 뒷받침되는 종목 vs 테마주만 있는 종목, 구분이 중요합니다.' },
  { category: 'stock', title: `미국 시장 따라가기 vs 국내 저평가주`, content: '요즘 미장 따라가는 게 나을까요, 국내 저평가주를 발굴하는 게 나을까요? 환율도 고려해야 하고 고민이 됩니다.' },
  { category: 'stock', title: `ETF 적립식 투자 현황 공유`, content: 'S&P500 ETF 매달 30만원씩 적립 중인데, 최근 수익률이 어떤지 공유합니다. 같이 적립하시는 분 계신가요?' },
  { category: 'stock', title: `오늘 외국인 수급 특이점 (${dateTag})`, content: '외국인 매매 동향이 요즘 좀 달라졌어요. 반도체 매수세가 줄고 금융주 쪽으로 관심이 옮겨가는 느낌입니다. 기관은 반대로 움직이고 있네요.' },
  { category: 'stock', title: `금리 동결 이후 투자 전략`, content: '한국은행이 금리를 동결했습니다. 인하 시점을 언제로 예상하시나요? 채권, 주식, 부동산 각각 어떻게 포지션 잡으실 건지 궁금합니다.' },
  { category: 'stock', title: `초보 투자자 질문 — 주식 시작할 때 얼마로?`, content: '주식 처음 시작하려는데 얼마부터 시작하면 좋을까요? 50만원? 100만원? 경험자분들 조언 부탁드립니다.' },
  // Apt
  { category: 'apt', title: `4월 청약 일정 확인하셨나요?`, content: '4월에 나오는 주요 청약 현장 정리합니다. 수도권 물량이 많이 나올 예정이니 가점 계산해보시고 미리 준비하세요!' },
  { category: 'apt', title: `분양가 상한제 지역 변경 사항 (${dateTag})`, content: '분양가 상한제 적용 지역이 일부 조정됐습니다. 해제된 곳과 신규 지정된 곳 정리해봤는데 확인해보세요.' },
  { category: 'apt', title: `전세 vs 매매 어떤 게 나을까요?`, content: '지금 전세로 사는 게 나을지 매매를 해야 할지 진짜 고민입니다. 금리가 내려가면 매매가 유리하다고 하는데, 언제 내려갈지도 모르겠고요.' },
  { category: 'apt', title: `재건축 초과이익 환수제 완화 소식`, content: '재건축 초과이익 환수제 완화 논의가 진행 중입니다. 면제 기준 상향, 부과 비율 조정 등 핵심 내용 정리합니다.' },
  { category: 'apt', title: `요즘 미분양 줍줍 괜찮나요?`, content: '미분양 물량이 있는 곳을 찾아보고 있는데, 미분양이 많은 곳은 이유가 있는 거라 조심스럽긴 합니다. 혹시 미분양으로 좋은 딜 잡으신 분 계신가요?' },
  { category: 'apt', title: `신도시 입주 후기 — 실거주 1년차`, content: '3기 신도시 입주한 지 1년 됐는데 실제 살아보니 생각보다 편의시설이 부족한 부분도 있고, 교통은 점점 나아지고 있어요. 질문 받습니다.' },
  { category: 'apt', title: `아파트 실거래가 추이 보는 법`, content: '카더라에서 아파트 실거래가 추이를 확인할 수 있어요. 관심 단지 등록하면 거래 발생 시 알림도 받을 수 있습니다. 아직 안 써보신 분은 한번 해보세요.' },
  { category: 'apt', title: `청약 가점 낮으면 어디를 노려야 할까요?`, content: '가점 40점대인데 수도권 당첨이 가능할까요? 추첨제 물량이 많은 현장이나 경쟁률이 낮은 지방 물량을 노리는 게 현실적인 것 같은데 의견 부탁드려요.' },
  { category: 'apt', title: `요즘 전세 시세 어떻게 되나요?`, content: '전세 만기 다가오는데 시세가 많이 올랐는지 내렸는지 감이 안 잡히네요. 같은 지역에 사시는 분들 최근 전세 계약 어떻게 하셨는지 궁금합니다.' },
  { category: 'apt', title: `분양권 전매 지금 해도 되나요?`, content: '분양권 전매가 가능한 현장인데, 프리미엄이 좀 붙었거든요. 지금 팔아야 할지 입주까지 기다려야 할지 고민입니다.' },
  // Free
  { category: 'free', title: `${dayName}요일 재테크 잡담방`, content: '오늘도 한 주 고생하셨습니다. 이번 주 재테크 관련 자유롭게 이야기 나눠요. 주식이든 부동산이든 절약이든 뭐든지 환영합니다!' },
  { category: 'free', title: `요즘 물가 진짜 미쳤지 않나요?`, content: '장보러 갔다가 깜짝 놀랐어요. 계란도 오르고 과일도 오르고... 다들 식비 절약 어떻게 하고 계신가요?' },
  { category: 'free', title: `월급 관리 루틴 공유해요`, content: '월급 들어오면 어떻게 관리하시나요? 저는 급여일에 바로 투자금 + 비상금 + 생활비로 나누는데, 다른 분들 방법도 궁금합니다.' },
  { category: 'free', title: `짠테크 팁 하나 공유`, content: '요즘 발견한 절약 팁인데, 카드사 실적 조건 맞추면 월 최대 5만원 이상 할인받을 수 있어요. 체크카드 실적 조건 비교해보세요.' },
  { category: 'free', title: `부자 되려면 뭘 해야 할까요?`, content: '진심으로 궁금합니다. 월급만으로는 한계가 있는 것 같은데, 부업? 투자? 사업? 다들 어떤 루트로 자산을 불려가고 계신가요?' },
  { category: 'free', title: `보험 리모델링 해보신 분 있어요?`, content: '보험료가 월 30만원 넘는데 진짜 다 필요한 건지 모르겠어요. 보험 리모델링 해보신 분 후기 좀 알려주세요.' },
  { category: 'free', title: `신용점수 올리는 꿀팁`, content: '신용점수가 생각보다 낮아서 대출 금리에서 손해 봤어요. 신용점수 올리는 실질적인 방법 공유합니다.' },
  { category: 'free', title: `연말정산 미리 준비하시나요?`, content: '아직 멀었다고 생각하시겠지만, 지금부터 연금저축이나 IRP에 넣어두면 연말에 편합니다. 미리 챙기세요!' },
  // Local
  { category: 'local', title: `우리 동네 부동산 분위기 공유`, content: '요즘 우리 동네 부동산 시장 분위기가 어떤가요? 매물은 많은데 거래가 안 되는 느낌인지, 아니면 급매가 나오면 바로 팔리는 분위기인지 공유해주세요.' },
  { category: 'local', title: `동네 맛집 추천해주세요!`, content: '이번 주말에 맛있는 거 먹으러 가고 싶은데 추천 좀 해주세요. 가성비 좋은 곳이면 더 좋아요!' },
  { category: 'local', title: `우리 지역 개발 호재 있나요?`, content: '교통이나 재개발 관련 우리 지역 호재 있으면 공유해주세요. GTX나 지하철 연장, 재건축 등 뭐든 좋아요.' },
  { category: 'local', title: `주말 나들이 갈 곳 추천`, content: '날씨가 좋아지니 주말에 어디 가볼까 고민이에요. 우리 동네 근처에 가볼 만한 곳 추천해주세요!' },
  { category: 'local', title: `이사 고민 — 이 동네 살기 어때요?`, content: '이사를 고민 중인데, 이 지역에 실제로 살고 계신 분들 생활 후기 좀 들려주세요. 교통, 학군, 편의시설 위주로요.' },
  // 2026 시사
  { category: 'stock', title: `2026 하반기 투자 전략 고민`, content: '상반기도 벌써 끝나가는데, 하반기 투자 전략 어떻게 잡으셨나요? 금리 인하 기대감이 있어서 채권이나 리츠도 괜찮을 것 같은데.' },
  { category: 'apt', title: `2026년 청약 시장 총정리`, content: '올해 청약 시장 총 정리합니다. 공급 물량, 분양가 추이, 경쟁률 변화 등 핵심만 짚어볼게요.' },
  { category: 'free', title: `올해 세금 바뀐 것들 정리`, content: '2026년부터 바뀐 세금 관련 규정 정리합니다. 종합소득세, 양도세, 취득세 등 변경사항 확인하세요.' },
  { category: 'stock', title: `코스피 전망 — 3000 돌파할까요?`, content: '코스피가 3000 근처까지 왔는데 돌파할 수 있을까요? 외국인 수급, 환율, 실적 시즌 등 변수가 많네요.' },
  { category: 'apt', title: `DSR 규제 완화되면 집 사야 할까요?`, content: 'DSR 규제 완화 소식이 들리는데, 이게 실현되면 대출 한도가 늘어나서 집값에도 영향이 있을까요?' },
  { category: 'free', title: `다들 비상금 얼마나 갖고 계세요?`, content: '갑자기 궁금해졌는데 비상금 보통 월급의 몇 배 정도 갖고 계시나요? 3개월치? 6개월치? 현실적으로 어려운 것 같은데...' },
  { category: 'stock', title: `2차전지 아직 살아있나요?`, content: '2차전지 관련주가 조정을 많이 받았는데 지금 분할매수 들어가도 될까요? 장기적으로는 전기차 시장이 성장할 거라 생각하는데...' },
  { category: 'apt', title: `전월세 전환율 계산 해보셨나요?`, content: '전세에서 월세로 전환할 때 전환율이 중요한데, 요즘 시장 전환율이 어느 정도인지 아시는 분 계신가요?' },
  { category: 'free', title: `사회초년생 재테크 Q&A`, content: '사회초년생인데 재테크 어디서부터 시작해야 할지 모르겠어요. 경험 많으신 분들 조언 부탁드립니다!' },
  { category: 'stock', title: `오늘의 투자 일기 (${dateTag})`, content: '오늘 투자 관련 느낀 점이나 매매 내역 공유해요. 수익이든 손실이든 기록이 중요하니까요!' },
  { category: 'apt', title: `이번 달 입주 물량 체크`, content: '이번 달 입주 물량이 많은 지역이 있는데, 입주 물량 많으면 전세가 하락 가능성이 있으니 참고하세요.' },
  { category: 'free', title: `카드 혜택 추천 부탁드려요`, content: '신용카드 바꾸려고 하는데 요즘 혜택 좋은 카드 추천해주세요. 주로 온라인 쇼핑이랑 카페를 많이 이용합니다.' },
];

const COMMENT_TEMPLATES = [
  'ㄹㅇ 공감합니다', '오 정보 감사합니다ㅎㅎ', '저도 알아보는 중이에요', '와 이거 대박이다',
  'ㅋㅋ 맞아요 진짜', '근데 요즘 다들 이렇게 하나요?', '저도 해봐야겠다', '정보 감사요~',
  '이거 진짜 유용하네요', '북마크 해둡니다ㅎㅎ', '공감 백배입니다', '좋은 정보 감사해요!',
  '오 이거 처음 알았어요', '댓글 달고 갑니다~', '저만 이런 줄 알았는데 아니었네ㅋㅋ',
  '헐 나도 이거 봤는데', '진짜요?? 대박', '저도 같은 생각이에요', '참고하겠습니다!',
];

function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('seed-posts', async () => {
    const admin = getSupabaseAdmin();

    const { data: seedUsers } = await admin.rpc('get_seed_users');
    if (!seedUsers || seedUsers.length === 0) {
      return { processed: 0, created: 0, failed: 0 };
    }

    // 1~3개 글 랜덤 생성
    const postCount = randInt(1, 3);
    const results: { title: string; comments: number; likes: number }[] = [];

    for (let i = 0; i < postCount; i++) {
      const userId = pick(seedUsers).id;
      const category = pick(CATEGORIES);
      const regionId = pick(REGIONS);

      let title = '', content = '', attempts = 0;
      let selectedTemplate;
      do {
        selectedTemplate = pick(TEMPLATES);
        title = selectedTemplate.title;
        content = selectedTemplate.content;

        // Haiku 생성 시도
        if (process.env.ANTHROPIC_API_KEY) {
          try {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
              body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001', max_tokens: 300,
                messages: [{ role: 'user', content: `한국 커뮤니티 앱 "카더라"에 올릴 자연스러운 게시글. 카테고리: ${category}. 지역: ${regionId}. stock→주식, apt→부동산, local→${regionId} 이야기, free→일상. 줄바꿈은 실제 줄바꿈 사용. JSON만: {"title":"제목(30자이내)","content":"내용(200자이내)"}` }],
              }),
              signal: AbortSignal.timeout(8000),
            });
            if (res.ok) {
              const data = await res.json();
              const match = (data.content?.[0]?.text || '').match(/\{[\s\S]*\}/);
              if (match) {
                const parsed = JSON.parse(match[0]);
                if (parsed.title && parsed.content) { title = parsed.title; content = parsed.content.replace(/\\n/g, '\n'); }
              }
            }
          } catch {}
        }

        // Check for duplicate title in last 6h (shorter window to allow template reuse across days)
        const { data: dup } = await admin.from('posts')
          .select('id')
          .eq('title', title)
          .gte('created_at', new Date(Date.now() - 21600000).toISOString())
          .limit(1);
        if (!dup || dup.length === 0) break; // unique title, proceed
        attempts++;
      } while (attempts < 5);

      if (attempts >= 5) continue; // skip if all attempts produced duplicates

      const finalCategory = (selectedTemplate as any).category || category;
      const finalRegion = finalCategory === 'local' ? regionId : 'all';

      // 게시글 created_at에 0~25분 랜덤 오프셋
      const offsetMinutes = randInt(0, 25);
      const postCreatedAt = new Date(Date.now() - offsetMinutes * 60000).toISOString();

      // slug 생성
      const slugBase = title.replace(/[^가-힣a-z0-9\s-]/gi, '').replace(/\s+/g, '-').toLowerCase();

      const { data: postData, error: postError } = await admin.from('posts').insert({
        author_id: userId,
        title, content,
        category: finalCategory,
        region_id: finalRegion,
        is_anonymous: false,
        created_at: postCreatedAt,
      }).select('id').single();

      if (postError || !postData) continue;
      const postId = postData.id;

      // slug 업데이트 (id 필요)
      await admin.from('posts').update({ slug: `${slugBase}-${postId}` }).eq('id', postId);

      // 시드 댓글 0~4개
      const commentCount = randInt(0, 4);
      if (commentCount > 0) {
        const commentUsers = pickN(seedUsers, commentCount);
        const commentRows = commentUsers.map((u: Record<string, any>) => ({
          post_id: postId,
          author_id: u.id,
          content: pick(COMMENT_TEMPLATES),
          comment_type: 'comment',
          created_at: new Date(new Date(postCreatedAt).getTime() + randInt(5, 120) * 60000).toISOString(),
        }));
        await admin.from('comments').insert(commentRows);
        await admin.from('posts').update({ comments_count: commentCount }).eq('id', postId);
      }

      // 시드 좋아요 0~8개
      const likeCount = randInt(0, 8);
      if (likeCount > 0) {
        const likeUsers = pickN(seedUsers, Math.min(likeCount, seedUsers.length));
        const likeRows = likeUsers.map((u: Record<string, any>) => ({
          post_id: postId,
          user_id: u.id,
        }));
        await admin.from('post_likes').insert(likeRows).then(() => {});
        await admin.from('posts').update({ likes_count: likeCount }).eq('id', postId);
      }

      results.push({ title, comments: commentCount, likes: likeCount });
    }

    try { revalidatePath('/feed'); revalidatePath('/hot'); } catch {}
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';
    fetch(`${siteUrl}/api/revalidate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: cronSecret, path: '/feed' }),
    }).catch(() => {});

    return {
      processed: postCount,
      created: results.length,
      failed: postCount - results.length,
      metadata: { posts: results },
    };
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 200 });
  }
  return NextResponse.json({ ok: true, ...result });
}
