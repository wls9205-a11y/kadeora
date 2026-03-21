import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ensureMinLength } from '@/lib/blog-padding';

const TOPICS = [
  { slug: 'emergency-fund-top5', title: '비상금 통장 추천 TOP 5 — 2026년 기준', tags: ['비상금', '통장', '저축'] },
  { slug: 'savings-rate-compare', title: '적금 금리 비교 — 시중은행 vs 인터넷은행', tags: ['적금', '금리', '은행'] },
  { slug: 'parking-account-guide', title: '파킹통장 완벽 가이드 — 하루만 넣어도 이자', tags: ['파킹통장', '금리', '이자'] },
  { slug: 'cma-account-compare', title: 'CMA 계좌 비교 — 증권사별 수익률 차이', tags: ['CMA', '증권사', '수익률'] },
  { slug: 'savings-vs-etf', title: '예적금 vs ETF — 안전자산과 투자자산 비교', tags: ['예적금', 'ETF', '투자'] },
  { slug: 'year-end-tax-tips', title: '연말정산 환급 극대화 전략 10가지', tags: ['연말정산', '절세', '환급'] },
  { slug: 'isa-account-guide', title: 'ISA 계좌 완벽 가이드 — 세제혜택 총정리', tags: ['ISA', '절세', '투자'] },
  { slug: 'pension-vs-irp', title: '연금저축 vs IRP — 어디에 넣어야 할까', tags: ['연금저축', 'IRP', '절세'] },
  { slug: 'income-tax-freelancer', title: '종합소득세 절세 팁 — 프리랜서 필수', tags: ['종합소득세', '절세', '프리랜서'] },
  { slug: 'capital-gains-tax', title: '양도소득세 계산법과 절세 전략', tags: ['양도소득세', '절세', '부동산'] },
  { slug: 'mortgage-rate-2026', title: '주택담보대출 금리 비교 — 2026년 기준', tags: ['주담대', '금리', '대출'] },
  { slug: 'jeonse-loan-guide', title: '전세대출 조건과 한도 총정리', tags: ['전세대출', '전세', '대출'] },
  { slug: 'dsr-regulation', title: 'DSR 규제 완벽 이해 — 나는 얼마까지 빌릴 수 있나', tags: ['DSR', '대출', '규제'] },
  { slug: 'ltv-dti-calculation', title: 'LTV DTI 계산법 — 부동산 대출 기초', tags: ['LTV', 'DTI', '부동산'] },
  { slug: 'credit-loan-compare', title: '신용대출 금리 비교 — 은행별 조건 정리', tags: ['신용대출', '금리', '은행'] },
  { slug: 'etf-beginner-guide', title: 'ETF 입문 가이드 — 처음 시작하는 분산투자', tags: ['ETF', '분산투자', '초보'] },
  { slug: 'sp500-etf-invest', title: 'S&P500 ETF 투자법 — 미국 대형주 한번에', tags: ['S&P500', 'ETF', '미국주식'] },
  { slug: 'nasdaq100-etf-compare', title: '나스닥100 ETF 비교 — QQQ vs TQQQ', tags: ['나스닥', 'ETF', 'QQQ'] },
  { slug: 'dividend-etf-top5', title: '배당 ETF 추천 TOP 5 — 매월 배당받기', tags: ['배당', 'ETF', '월배당'] },
  { slug: 'reits-investment', title: '리츠(REITs) 투자법 — 소액 부동산 투자', tags: ['리츠', 'REITs', '부동산'] },
  { slug: 'us-stock-tax-guide', title: '미국주식 양도세 신고법 — 초보자 가이드', tags: ['미국주식', '양도세', '세금'] },
  { slug: 'overseas-stock-tax', title: '해외주식 세금 가이드 — 250만원 공제 활용', tags: ['해외주식', '세금', '공제'] },
  { slug: 'fx-fee-saving', title: '환전 수수료 절약법 — 증권사별 비교', tags: ['환전', '수수료', '해외투자'] },
  { slug: 'dollar-invest-strategy', title: '달러 투자 전략 — 환테크 기초', tags: ['달러', '환테크', '투자'] },
  { slug: 'domestic-vs-overseas-etf', title: '해외 ETF vs 국내 상장 해외 ETF 비교', tags: ['ETF', '해외', '비교'] },
  { slug: 'twenties-finance-roadmap', title: '20대 사회초년생 재테크 로드맵', tags: ['20대', '재테크', '사회초년생'] },
  { slug: 'thirties-asset-allocation', title: '30대 직장인 자산배분 전략', tags: ['30대', '자산배분', '직장인'] },
  { slug: 'newlywed-finance', title: '신혼부부 재테크 — 맞벌이 자산관리', tags: ['신혼부부', '재테크', '맞벌이'] },
  { slug: 'forties-retirement-prep', title: '40대 중반 은퇴 준비 체크리스트', tags: ['40대', '은퇴', '준비'] },
  { slug: 'fifties-asset-management', title: '50대 퇴직 후 자산 운용 가이드', tags: ['50대', '퇴직', '자산운용'] },
  { slug: 'insurance-remodeling', title: '보험 리모델링 가이드 — 불필요한 보험 정리', tags: ['보험', '리모델링', '절약'] },
  { slug: 'real-loss-vs-fixed', title: '실손보험 vs 정액보험 — 뭐가 유리할까', tags: ['실손보험', '정액보험', '비교'] },
  { slug: 'pension-dc-vs-db', title: '퇴직연금 DC vs DB 비교 — 어떤 게 유리', tags: ['퇴직연금', 'DC', 'DB'] },
  { slug: 'national-pension-calc', title: '국민연금 예상 수령액 계산법', tags: ['국민연금', '수령액', '계산'] },
  { slug: 'severance-mid-settlement', title: '퇴직금 중간정산 장단점 분석', tags: ['퇴직금', '중간정산', '분석'] },
  { slug: 'fixed-cost-reduce-10', title: '고정비 줄이는 10가지 방법', tags: ['고정비', '절약', '생활비'] },
  { slug: 'phone-bill-saving', title: '통신비 절약 팁 — 알뜰폰 비교', tags: ['통신비', '알뜰폰', '절약'] },
  { slug: 'credit-card-maximize', title: '신용카드 혜택 극대화 꿀팁', tags: ['신용카드', '혜택', '포인트'] },
  { slug: 'check-vs-credit-card', title: '체크카드 vs 신용카드 — 소비 패턴별 추천', tags: ['체크카드', '신용카드', '비교'] },
  { slug: 'budgeting-app-top5', title: '가계부 쓰는 법 — 추천 앱 5가지', tags: ['가계부', '앱', '가계관리'] },
  { slug: 'jeonse-vs-wolse', title: '전세 vs 월세 비용 비교 분석', tags: ['전세', '월세', '비교'] },
  { slug: 'acquisition-tax-2026', title: '부동산 취득세 계산 — 2026년 기준', tags: ['취득세', '부동산', '세금'] },
  { slug: 'gap-investment-guide', title: '갭투자란 — 장점과 위험성', tags: ['갭투자', '부동산', '투자'] },
  { slug: 'officetel-roi', title: '오피스텔 투자 수익률 분석', tags: ['오피스텔', '수익률', '투자'] },
  { slug: 'housing-savings-guide', title: '주택청약종합저축 활용법 완벽 가이드', tags: ['청약통장', '저축', '청약'] },
  { slug: 'bitcoin-long-term', title: '비트코인 장기투자론 — 4년 주기설', tags: ['비트코인', '장기투자', '가상자산'] },
  { slug: 'crypto-tax-guide', title: '가상자산 세금 가이드 — 과세 시작 대비', tags: ['가상자산', '세금', '과세'] },
  { slug: 'stablecoin-defi', title: '스테이블코인 활용법 — DeFi 입문', tags: ['스테이블코인', 'DeFi', '가상자산'] },
  { slug: 'nft-reality-2026', title: 'NFT 투자 현실 — 2026년 시장 분석', tags: ['NFT', '투자', '시장분석'] },
  { slug: 'crypto-exchange-fee', title: '가상자산 거래소 수수료 비교', tags: ['거래소', '수수료', '가상자산'] },
];

function makeContent(t: typeof TOPICS[0]): string {
  return `## ${t.title}

${t.title}에 대해 꼼꼼히 정리했습니다. 최근 금융 환경이 빠르게 변화하면서 개인 자산관리의 중요성이 그 어느 때보다 커지고 있습니다. 이 글에서는 **${t.tags[0]}**을 중심으로 핵심 내용을 알기 쉽게 설명합니다.

현명한 재테크의 첫걸음은 정확한 정보를 바탕으로 본인에게 맞는 전략을 세우는 것입니다. 아래 내용을 참고하여 자산관리에 활용해보세요.

---

### 핵심 포인트

**${t.tags[0]}**과 관련하여 반드시 알아야 할 핵심 사항들을 정리했습니다. 금융 상품을 선택할 때는 수익률뿐만 아니라 **세금**, **수수료**, **유동성** 등을 종합적으로 고려해야 합니다.

특히 2026년에는 금리 변동, 세제 개편, 새로운 금융 상품 출시 등 다양한 변화가 예상되므로, 최신 정보를 지속적으로 확인하는 것이 중요합니다.

### 실전 가이드

1. **기본 개념 이해**: ${t.tags[0]}의 기본 원리와 구조를 먼저 파악하세요.
2. **비교 분석**: 유사 상품 간 수수료, 금리, 세제 혜택을 꼼꼼히 비교하세요.
3. **목표 설정**: 단기(1년), 중기(3년), 장기(10년+) 목표에 맞게 상품을 선택하세요.
4. **리스크 관리**: 원금 보장 여부, 환율 리스크, 유동성 리스크를 확인하세요.
5. **정기 점검**: 최소 반기마다 포트폴리오를 점검하고 리밸런싱하세요.

### 체크리스트

- **수익률 확인**: 세전/세후 수익률 차이를 반드시 확인
- **수수료 비교**: 가입비, 운용보수, 거래 수수료 등 총비용 비교
- **세금 혜택**: ISA, 연금저축 등 세제 혜택 상품 우선 활용
- **유동성**: 필요 시 자금을 빼는 데 걸리는 시간과 페널티 확인
- **안정성**: 예금자보호 여부, 신용등급, 운용사 규모 확인

---

### 관련 정보

- [**카더라 주식 시세** 보기 →](/stock)
- [**청약 일정** 확인 →](/apt)
- [**커뮤니티**에서 의견 나누기 →](/feed)
- [카더라 **블로그**에서 더 보기 →](/blog?category=finance)

카더라에서 매일 업데이트되는 재테크 정보를 확인하고, 현명한 자산관리를 시작하세요.

---

> 본 콘텐츠는 투자 권유가 아니며 참고용입니다. 금융 상품 가입 전 반드시 약관과 설명서를 확인하세요.`;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  let created = 0;

  for (const t of TOPICS) {
    const slug = `finance-${t.slug}`;
    const { data: exists } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
    if (exists) continue;

    const content = ensureMinLength(makeContent(t), 'general');
    await admin.from('blog_posts').insert({
      slug, title: t.title, content,
      excerpt: `${t.title}. ${t.tags.join(', ')} 관련 정보.`,
      category: 'finance', tags: ['재테크', ...t.tags],
      source_type: 'seed', cron_type: 'seed-finance', is_published: true,
      cover_image: `https://kadeora.app/api/og?title=${encodeURIComponent(t.title)}&type=blog`,
    });
    created++;
  }

  return NextResponse.json({ ok: true, created });
}
