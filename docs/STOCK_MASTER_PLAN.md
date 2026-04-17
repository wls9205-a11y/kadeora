# 카더라 주식 섹터 마스터 설계안

> **Mission**: 네이버 주식 검색 1등 + 네이버금융 다음에 반드시 들르는 사이트 + 서학개미의 공식 홈그라운드
> **Author**: Claude × Node (2026-04-16)
> **Scope**: 국내주식 + 해외주식 + 주식 블로그 + SEO + 수익화 + 법적 프레임
> **이전 문서**: 없음 (이 문서가 master reference)

---

## 0. 설계 철학 — 세 개의 공리

이 문서 전체를 관통하는 세 가지 전제다. 모든 세부 설계는 이 공리에서 파생된다.

**공리 1. 네이버금융을 정면으로 이기려 하지 마라.**
네이버금융은 무료·공짜·완전한 데이터 포털이다. 같은 영역(호가/차트/재무제표 단순 조회)에서는 영원히 못 이긴다. 대신 카더라는 "**네이버금융에서 확인하고 바로 다음에 들르는 사이트**" 포지션을 노린다. 사용자가 네이버금융에서 보고 온 그 종목에 대해 카더라에서만 볼 수 있는 "**해석·맥락·개인화**"를 제공한다. 네이버금융이 "무엇을"을 보여준다면, 카더라는 "**왜**"를 설명한다.

**공리 2. 해외주식은 한국어 정보 격차 자체가 해자다.**
서학개미 600만 명 시장에 Bloomberg 품질의 한국어 콘텐츠가 거의 없다. 인베스팅닷컴 한국어판은 자동번역 품질이 낮고, 시킹알파·배런스·WSJ은 언어 장벽이 있고, 유튜브는 파편화·검색 불가. **한국어로 된 깊이 있는 해외주식 정보**를 구조화해서 제공하기만 해도 블루오션. 특히 밤 10시~새벽 5시 한국 인터넷이 거의 비어있는 시간대가 미국장 개장 시간이라는 비대칭이 결정적.

**공리 3. AI 네이티브 × 개인화 = 포털이 영원히 못 하는 차별화.**
네이버금융은 모든 사용자에게 같은 화면을 보여준다. 토스증권은 앱 내에서만 개인화된다. 카더라는 **로그인 사용자의 관심종목·보유종목·리스크 성향 기반 콘텐츠를 AI로 생성**해서 푸시·알림톡·이메일로 전달할 수 있다. 이건 구조적으로 포털이 따라오기 힘든 영역이다.

---

## 1. 경쟁 구도 완전 해부

### 1.1 국내주식 경쟁자

| 서비스 | 강점 | 약점 | 카더라 침투각 |
|---|---|---|---|
| 네이버금융 | 데이터 완전성, 트래픽, 네이버 검색 연동 | 2005년 UI, 커뮤니티 노후, 개인화 없음, 해석 없음 | 해석·개인화·커뮤니티 2.0 |
| 토스증권 | 모바일 UX 최강, 체결 연동 | 분석 콘텐츠 부족, 해외주식 깊이 부족, 웹 약함 | 웹·SEO·깊이 |
| 증권플러스 | 커뮤니티 활발 | 종목 상세 깊이 부족, 해외주식 약함 | 깊이·해외 |
| 카카오증권 | 자본력 | 실질 폐업 수준 | N/A |
| 뉴지스탁 | 스크리너 특화, 테크니컬 신호 | 일반 사용자 진입장벽 높음, UI 올드 | 일반 유저 접근성 |
| 알파스퀘어 | 차트·지표 프로급 | 무료 티어 제한, 초보 진입장벽 | 무료 깊이 |
| 한경컨센서스 | 리서치 리포트 | UI 낡음, 검색·개인화 없음 | 리포트 다이제스트 |
| 38커뮤니케이션 | 비상장·IPO 전문 | 극도로 올드 UI, 광고 범람 | IPO 허브 현대화 |

**핵심 인사이트**: 네이버금융·토스·증권플러스 3강 구도인데, **"종목 상세 깊이 + 커뮤니티 + 개인화 + 현대적 UI"를 동시에 만족하는 서비스가 없다.** 여기가 카더라의 자리.

### 1.2 해외주식 경쟁자 (한국어권)

| 서비스 | 강점 | 약점 |
|---|---|---|
| 인베스팅닷컴 한국어 | 데이터 완전성, 경제 캘린더 | 자동번역 품질 낮음, 콘텐츠 품질 낮음 |
| 야후파이낸스 | 완전한 데이터 | 한국어 지원 없음 |
| 시킹알파 | 분석 깊이 최강 | 영어 장벽, 유료 |
| 한국경제 글로벌마켓 | 언론 권위 | 단편 기사 중심, 구조화 없음 |
| 토스증권 해외 | 매매 연동 | 분석 콘텐츠 거의 없음 |
| 서학개미 유튜브 | 접근성 | 영상 파편화, 검색 불가, 품질 편차 큼 |
| 텔레그램/카톡방 | 속도 | 사라지는 정보, 검색 불가, 신뢰도 낮음 |

**핵심 인사이트**: **한국어로 구조화된 해외주식 허브가 사실상 없다.** 인베스팅닷컴은 자동번역, 토스는 매매 중심, 유튜브는 파편화. 제대로 만들면 독점이다.

### 1.3 포지셔닝 선언

> 카더라 주식 = **"네이버금융의 데이터 신뢰도 + 토스의 UX + 시킹알파의 깊이 + 한국어 + AI 개인화"**

---

## 2. 법적/데이터 인프라 — 가장 먼저 정리해야 할 것

**이 섹션은 Toss Payments 심사 진행 중인 상황에서 특히 중요하다. 법적 리스크를 선제적으로 차단하지 않으면 나중에 전체 구조를 갈아엎어야 할 수 있다.**

### 2.1 자본시장법 리스크 (최우선)

한국의 「자본시장과 금융투자업에 관한 법률」에서 가장 조심해야 할 개념:

**(1) 유사투자자문업 등록 필요 여부**
특정·불특정 다수에게 **대가를 받고** 투자 조언을 제공하면 유사투자자문업 등록 대상이다. 현재 카더라가 무료 서비스인 한 등록 대상이 아니지만, **프리미엄 티어(월 구독)를 출시하는 순간 유사투자자문업 등록이 필요해질 수 있다.** Toss 심사 후 프리미엄 런칭 시 금감원 등록 선행 필수.

**(2) 투자자문업 vs 정보제공**
결정적 구분선: "매수·매도 권유"인가 "정보 제공"인가.
- 금지: "삼성전자 지금 사세요", "AAPL 매도 타이밍입니다"
- 허용: "외국인이 3일 연속 순매수 중", "컨센서스 대비 어닝 서프라이즈"

**(3) AI 생성 콘텐츠 특별 주의**
크론으로 자동 생성하는 블로그에 "추천"·"매수"·"매도" 같은 권유 표현이 들어가면 대량으로 법적 리스크가 발생한다. **모든 AI 생성 콘텐츠에 권유 표현 필터를 강제로 통과시켜야 한다.**

**(4) 개인화 브리핑 최대 위험**
특정 사용자에게 특정 종목 매매 권유로 해석될 여지가 있으면 투자자문업으로 본다. 개인화 브리핑은 반드시 "정보 제공" 틀 안에서, "고려해볼 만한 이벤트", "관심 종목의 주요 뉴스" 형식으로.

**(5) 필수 Disclaimer 표준**
모든 분석 콘텐츠 하단에 고정 문구:

> 본 콘텐츠는 정보 제공 목적으로 작성된 것이며, 특정 종목의 매매를 권유하지 않습니다. 투자 판단의 최종 책임은 투자자 본인에게 있으며, 당사는 투자 결과에 대해 어떠한 책임도 지지 않습니다. 과거 수익률이 미래 수익률을 보장하지 않습니다.

`components/legal/InvestmentDisclaimer.tsx` 컴포넌트 신설 후 모든 주식 관련 페이지·블로그 포스트 하단에 자동 삽입.

**(6) 콘텐츠 사전 필터 미들웨어**
```ts
// lib/ai/investmentAdviceFilter.ts
const FORBIDDEN_PATTERNS = [
  /매수.{0,5}추천/, /매도.{0,5}추천/, /사세요/, /파세요/,
  /지금.{0,5}(사|팔)/, /(급등|급락).{0,10}확실/,
  /반드시.{0,5}(상승|하락)/, /목표주가.{0,5}달성/,
];
function sanitizeAiContent(text: string): string {
  // 권유성 문장 제거 또는 정보성 문장으로 변환
}
```
모든 Sonnet/Haiku 생성 크론의 출력을 이 필터 통과 후 DB 저장.

**(7) 광고성 표현 규제**
"원금 보장", "확실한 수익", "10배 확정" 같은 표현 사용 금지. 증권사 계좌개설 제휴 페이지는 특히 주의.

### 2.2 데이터 소스 전략

| 계층 | 소스 | 비용 | 신뢰도 | 사용처 |
|---|---|---|---|---|
| **무료 공개** | KRX 정보데이터시스템 | 0 | 최고 | 국내 기초 데이터, 공매도, 대차잔고 |
| **무료 공개** | DART (전자공시시스템) | 0 | 최고 | 공시, 재무제표(XBRL), 주요주주 변경 |
| **무료 공개** | 한국은행 ECOS | 0 | 최고 | 금리, 환율, 거시지표 |
| **무료 공개** | FRED (미국) | 0 | 최고 | 미국 거시지표 |
| **무료 공개** | SEC EDGAR | 0 | 최고 | 미국 기업 공시, 10-K/10-Q |
| **무료 공개** | Yahoo Finance (비공식 API) | 0 | 중 | 해외주식 시세·재무 (백업용) |
| **저비용 유료** | Finnhub | $30~100/월 | 상 | 해외 실적 캘린더, 뉴스, 애널리스트 |
| **저비용 유료** | Polygon.io | $29~200/월 | 상 | 해외 실시간 시세, 옵션 |
| **저비용 유료** | Alpha Vantage | $50/월 | 중 | 해외 기초 데이터 백업 |
| **증권사** | KIS Developers | 무료(계좌필요) | 최고 | 국내 실시간 시세, 체결, 호가 |
| **증권사** | 키움 OpenAPI+ | 무료(계좌필요) | 최고 | 국내 실시간 백업 |
| **고비용** | FnGuide | 수백만원/월 | 최고 | 필요 없음 (자체 구축) |

**미싱 API 재우선순위화**:
1. **FINNHUB_API_KEY** — 해외주식 전체 전략의 기반. 최우선 확보.
2. **KIS_APP_KEY** — 국내 실시간 데이터. Node가 한국투자증권 계좌 개설 후 발급. 실시간 체결 없이 공공데이터 API만으로도 당일 15분 지연 데이터는 가능하므로 Phase 1에서는 없어도 됨.
3. **APT_DATA_API_KEY** — 부동산 영역. 본 문서 범위 밖.

**데이터 수집 금지 영역**:
- 네이버금융, 토스증권 크롤링: 법적 리스크(이용약관 위반) + 차단 리스크
- 증권사 유료 리포트 무단 전재: 저작권 침해

### 2.3 저작권 안전 영역

- DART 공시: 공공저작물, 전재 가능
- KRX 데이터: 공공정보, 전재 가능 (출처 표기)
- SEC Filing: Public Domain
- 한국은행 통계: 공공정보
- **IR 공식 유튜브 자막**: 주의. 저작권 있음. 요약·인용 수준까지만. 전체 자막 전재 금지.
- **애널리스트 공개 리포트 (한경컨센서스)**: 전재 금지. 목표주가·의견 같은 팩트만 추출, 링크.

---

## 3. 국내주식 완전 재설계

### 3.1 핵심 차별화 축

네이버금융·토스·증권플러스가 모두 약한 영역에 집중한다:

1. **수급 해석 레이어** — 외국인/기관/개인 조합 신호
2. **공매도·대차잔고 인텔리전스** — 숏스퀴즈 후보 자동 탐지
3. **DART 공시 AI 다이제스트** — 일 수천 건 공시를 자동 분류·요약
4. **실적 시즌 전면 커버리지** — KOSPI200 전체 자동 분석
5. **IPO/공모주 허브** — 청약일정부터 상장 후까지
6. **우선주 아비트라지 트래커** — 전문가도 안 보는 영역
7. **리츠 허브** — 부동산 플랫폼과의 독점 시너지
8. **주주총회 캘린더** — 3월 시즌 트래픽 폭발
9. **세금 계산기 3종** — 양도세·배당세·금투세
10. **토론방 2.0** — 수급 인증 뱃지

### 3.2 수급 해석 레이어 (Flow Signal Engine)

**왜 중요한가**: 네이버금융은 외국인·기관·개인 일별 수급을 숫자로만 보여준다. 카더라는 여기서 **조합 신호**를 추출해서 해석한다. "외국인 3일 연속 순매수"는 누구나 보여주지만, "외국인 3일 연속 순매수 + 기관 중립 + 52주 신고가 미달성 + 상대적 저평가"는 아무도 안 만든다.

**신호 레시피 (Phase 1에 10개 론칭, 점진 확장)**:

1. **외인 누적 매수 돌파**: 외국인 5일 누적 순매수 +2σ 이상 종목 (섹터별 정규화)
2. **기관 집중 매수**: 기관 3일 연속 순매수 + 단일 기관 유형 집중도 높음
3. **수급 역전 신호**: 외국인·기관 방향 동일 전환 (이전 5일 매도→매수 or 그 반대)
4. **대차잔고 감소 + 주가 상승**: 숏커버링 후보 (숏스퀴즈 전조)
5. **공매도 과열 + 수급 반전**: 공매도 과열 종목 지정 + 외국인 매수 전환
6. **개인 매도 + 외국인 매수**: 개인 매도 피크에 외국인이 받아가는 종목 (전형적 바닥 신호)
7. **거래대금 폭증 + 주가 소폭**: 세력 누적 흔적 (M&A/테마 전조)
8. **프로그램 매수 우위**: 차익거래 vs 비차익 분해
9. **주간 대형주 vs 중소형주 자금이동**: 섹터 로테이션 전조
10. **배당락 전 매수 집중**: 배당락일 D-5 ~ D-1 수급 변화

**구현 구조**:
```
/stock/signals/                 — 신호 허브 (전체 시그널 카드)
/stock/signals/foreign-buying   — 외국인 누적 매수
/stock/signals/short-squeeze    — 숏스퀴즈 후보
/stock/signals/individual-sell  — 개인 투매 후 외인 유입
...
```

각 신호 페이지는 **동적 랜딩 페이지**로 매일 자동 업데이트. `flow_signals` 테이블에 시그널 ID + 종목 + 날짜 + 해석 텍스트(Haiku 생성) 저장. 각 페이지 자체가 **"외국인 순매수 종목", "공매도 과열", "숏스퀴즈"** 같은 롱테일 키워드를 모두 흡수한다.

### 3.3 공매도·대차잔고 대시보드

한국 개인투자자가 가장 궁금해하면서 **네이버금융에 거의 없는 데이터**. KRX에서 매일 공개한다.

**대시보드 구성**:
- 공매도 과열종목 지정 현황 (실시간 업데이트, 5영업일 지정)
- 종목별 공매도 잔고 비율 Top 50 / Bottom 50
- 대차잔고 급증 TOP (1일/5일/20일 기준)
- 대차잔고 감소 TOP (숏커버링 후보)
- 공매도 비중 역사적 추이 차트
- 숏스퀴즈 후보 알고리즘 (공매도↑ + 대차잔고↓ + 주가 반등 초입)

**키워드 포획**:
- "공매도 과열종목" (월 검색량 수만)
- "대차잔고" (월 수만)
- "숏스퀴즈 종목"
- "공매도 비율 높은 종목"

**크론**: `cron/krx-short-selling-daily` (매일 18시, KRX 공매도 데이터 수집)

### 3.4 DART 공시 AI 파이프라인 (가장 큰 미개척 영역)

**왜 핵심인가**: DART에 매일 수백~수천 건의 공시가 올라오는데, 이걸 체계적으로 분류·요약해주는 사이트가 거의 없다. **한국에만 있는 독점적 데이터 자원**이다. 99%의 한국 주식 사이트가 이걸 활용하지 않는다.

**파이프라인 설계**:

```
1. cron/dart-ingest (매 15분)
   → DART Open API에서 신규 공시 수집
   → dart_filings 테이블에 저장

2. cron/dart-classify (매 30분)
   → 미분류 공시를 Haiku로 카테고리 분류
   → 카테고리: 실적공시, 주요주주변경, 자사주취득/처분,
              유상증자, 무상증자, 분할/합병, 공급계약,
              임원매매, 감사보고서, 정정공시, 기타

3. cron/dart-summarize (매 1시간)
   → 중요 공시(실적/주주변경/대규모계약 등)를 Sonnet으로 한국어 요약
   → 종목 자동 태깅 (기업코드 → 종목코드 매핑)

4. cron/dart-blog-generate (매일 18:30)
   → "오늘의 주요 공시 TOP 20" 블로그 자동 발행
   → "주요주주 변경 공시 정리" 주간 블로그
   → "임원 매매 동향" 주간 블로그
```

**파생 콘텐츠**:
- `/stock/disclosures` — 공시 허브, 실시간 피드
- `/stock/disclosures/insider-trading` — 임원 매매 대시보드
- `/stock/disclosures/major-shareholders` — 주요주주 변경 추적
- `/stock/disclosures/capital-raises` — 유상증자/무상증자 캘린더

**XBRL 재무제표 자체 DB화 (Phase 2 고급 과제)**:
DART는 사업보고서를 XBRL 형식으로도 제공한다. 이걸 파싱해서 재무제표를 자체 DB로 구축하면 **FnGuide를 자체 재구성**할 수 있다. 매출/영업이익/순이익/ROE/부채비율 등 10년치 역사 DB. 한 번 구축해두면 영구 자산. `financial_statements_xbrl` 테이블에 누적.

### 3.5 실적 시즌 자동 커버리지

**왜 중요한가**: 분기 실적 시즌(1·4·7·10월)에 검색량이 폭발한다. "[종목] 실적", "[종목] 영업이익", "[종목] 실적 발표" 키워드가 연중 피크를 찍는다. 대부분 사이트가 대형주 10~20개만 커버한다. **카더라는 KOSPI200 전 종목을 커버하는 유일한 한국어 사이트**가 될 수 있다.

**구조**:

1. **컨센서스 테이블 자체 구축**
   - 한경컨센서스, 네이버금융 공개 데이터 기반
   - `analyst_consensus` 테이블: 종목 × 분기 × 증권사 × (매출 컨센 / 영업이익 컨센 / 순이익 컨센)
   - 매일 업데이트 (목표주가 변경 감지 시 "애널리스트 목표가 상향" 블로그 자동 발행)

2. **실적 발표 감지 → 5분 내 한국어 요약**
   - DART "매출액 또는 손익구조변동" 공시 감지
   - 공시 → Sonnet 요약 → 블로그 + 푸시 + 알림톡
   - 구조: 실적 표 / 컨센 대비 / YoY 비교 / 가이던스 / 주요 코멘트 / 주가 영향 분석

3. **어닝 서프라이즈/쇼크 자동 분류**
   - 영업이익 컨센 대비 +10% 이상: 서프라이즈
   - -10% 이하: 쇼크
   - 주간 "이번주 어닝 서프라이즈 TOP 10" 블로그

**크론**:
- `cron/earnings-krx-realtime` (DART 감지, 5분 간격)
- `cron/earnings-krx-daily-summary` (매일 18:00)
- `cron/earnings-krx-weekly-recap` (매주 금 20:00)

### 3.6 IPO/공모주 허브

**왜 중요한가**: "공모주" 키워드는 한국 증시에서 괴물급 트래픽. 청약일정, 경쟁률, 의무보유확약 해제, 상장일 주가, 환불일 같은 시즌 키워드 검색량 엄청나다.

**허브 구조**:
- `/ipo` — 허브
- `/ipo/schedule` — 전체 청약 캘린더
- `/ipo/[company]` — 기업별 상세 페이지 (수요예측 결과, 경쟁률, 밴드, 의무보유, 상장일)
- `/ipo/lockup-calendar` — 의무보유 해제 캘린더 (상장 후 1개월/3개월/6개월)
- `/ipo/post-listing-performance` — 상장 후 수익률 트래킹
- `/spac` — 스팩(SPAC) 전용 허브 (한국 SPAC 붐 재조명)

**데이터 소스**:
- 38커뮤니케이션 (크롤링 리스크 — 대체 소스 필요)
- IPO STOCK (공개 API 없음, 수동 크롤링 윤리 검토)
- DART 증권신고서 자동 추출 → **자체 DB 구축이 안전**

**블로그 자동화**:
- 청약일 D-1 프리뷰
- 청약 결과 즉시 발행
- 상장일 아침 브리핑
- 상장일 마감 분석
- 의무보유 해제 1주일 전 경고 포스트

### 3.7 테마·섹터 로테이션 엔진 + 자체 지수 개발

**자체 지수 (언론 인용 유도)**:
- **카더라 AI 지수**: AI 관련주 30종목 동일가중
- **카더라 K-배당귀족 지수**: 10년 연속 배당 증가
- **카더라 원전 르네상스 지수**
- **카더라 바이오 혁신 지수**
- **카더라 K-방산 지수**

각 지수는 매일 산출·기록. `kadeora_indices` 테이블. 지수가 크게 움직이면 자동 블로그 발행. **자체 지수는 언론이 인용할 만한 권위 자산**이다. "카더라 AI 지수, 연초 이후 37% 상승" 같은 기사가 나오면 백링크·브랜드 가치 폭발.

**섹터 로테이션 시각화**:
- Relative Rotation Graph (RRG) 한국판 자체 구현
- 섹터별 자금 이동 히트맵
- 테마별 주간 상승률 Top 10

### 3.8 코퍼레이트 액션 캘린더 (미개척)

주주가치에 직결되는데 시각화가 전혀 없는 영역:
- 배당락 캘린더
- 권리락 캘린더
- 유상증자/무상증자 일정
- 액면분할·액면병합
- 주주명부 폐쇄
- **주주총회 캘린더** (3월 주총 시즌 트래픽 폭발, "주주제안", "주주총회 의결권" 키워드)

`/stock/corporate-actions` 허브 + 월별 전용 페이지. 주총 시즌 전에 "3월 주주총회 일정 총정리" 블로그 자동 발행은 거의 확정 트래픽 폭탄.

### 3.9 세금 계산기 3종

계산기 페이지는 체류시간 길고 재방문율 높다. SEO 권위도 자동 상승.

1. **양도세 계산기**: 대주주 요건, 해외주식 양도세, 손익통산
2. **배당소득세 계산기**: 14% 원천징수, 금융소득종합과세, 건보료 영향
3. **금융투자소득세 시뮬레이터**: 시행 여부 별 시나리오

각 계산기는 "입력값 기반 결과 페이지"로 자동 생성되어 프로그래매틱 SEO 자산이 된다.

### 3.10 토론방 2.0 + 수급 인증 시스템

기존 discussion rooms 확장:

**수급 인증 뱃지**:
- 실제 MTS 스크린샷 업로드 (한국투자/키움/삼성/미래에셋 등)
- 보유 수량 인증 시 "🔶 인증 보유자" 뱃지
- 익명성 유지 (수량·평균단가는 가림 옵션)
- 인증 사용자의 의견에 가중치

**투자 의견 투표**:
- 종목별 "매수/중립/매도" 투표 집계
- 주간/월간 방향성 변화 추적
- 인증 유저 한정 집계와 전체 집계 분리 표시

**법적 주의**: "매수 의견 70%" 같은 표시가 **매수 권유로 해석되지 않도록** 반드시 "현재 커뮤니티 의견 분포"라는 맥락 명시.

### 3.11 한국어 자연어 스크리너

**쿼리 예시**:
- "배당수익률 5% 이상 저PER 반도체주"
- "부채비율 100% 미만 성장 배당주"
- "최근 어닝 서프라이즈 난 중소형주"

Haiku가 한국어 질의를 구조화된 SQL 필터로 변환 → Supabase 쿼리 → 결과 렌더링. 각 검색 결과 페이지가 **URL로 공유 가능**하고 **SEO에 인덱싱** → 프로그래매틱 SEO 자산.

---

## 4. 해외주식 완전 재설계

### 4.1 핵심 차별화 축

1. **야간 시간대 지배** — 22:00~05:00 KST 한국 인터넷 빈 시간
2. **실적 + 컨퍼런스콜 한글 실시간** — 10분 내 한국어 요약
3. **10-K/10-Q XBRL 한글 파싱** — 한국어로 볼 수 있는 유일한 사이트
4. **매크로 × 종목 자동 매핑** — FOMC → 수혜/피해 섹터
5. **환율 레이어** — 원화 기준 수익률, 환헤지 ETF 비교
6. **ADR·교차상장 허브** — 쿠팡·팔란티어·알리바바
7. **ETF 구성종목 한국어 해설** — VOO/QQQ/SCHD 리밸런싱 트래킹
8. **옵션 플로우** (고급) — Unusual Whales 한국어
9. **크립토 × 주식 상관** — 비트코인 ETF, MSTR, COIN
10. **IR 컨퍼런스콜 유튜브 자막 DB** — 젠슨 황 검색 가능

### 4.2 야간 시간대 완전 지배 (ROI 최고)

**비대칭의 본질**: 한국 언론·커뮤니티가 가장 활동이 적은 22:00~05:00이 미국장 개장 시간. 서학개미 600만 명이 정보에 굶주려 있는 시간대. 이 시간대에 유일하게 한국어 구조화 정보를 제공하면 구글 검색·네이버 뉴스·카톡 공유가 카더라로 집중된다.

**크론 스케줄 (KST)**:

| 시각 | 크론 | 내용 |
|---|---|---|
| 21:30 | `us-premarket-watchlist` | 프리마켓 주요 등락 종목 TOP 20 |
| 22:00 | `us-premarket-movers-push` | 급등/급락 종목 알림톡+푸시 |
| 22:35 | `us-opening-bell-live` | 개장 15분 후 주요 종목 움직임 |
| 23:30 | `us-morning-brief` | 오프닝 1시간 종합 브리핑 |
| 01:00 | `us-midday-update` | 정오 업데이트 + 주요 매크로 뉴스 |
| 03:30 | `us-closing-hour` | 마감 30분 전 주요 종목 |
| 05:10 | `us-closing-bell-recap` | 마감 요약 + 다음날 포인트 |
| 05:30 | `us-aftermarket-earnings` | 장 마감 후 실적 발표 (AAPL, NVDA 등 대형주) |
| 06:30 | `us-aftermarket-final` | 시간외 최종 움직임 |
| 07:00 | `us-daily-recap-blog` | 전일 미국장 종합 블로그 발행 |

**채널 전략**:
- 블로그 포스트 (SEO)
- 카카오 알림톡 (구독자)
- 텔레그램 봇 (실시간)
- 웹 푸시 (PWA)
- Twitter/X 한국어 계정 (자동 포스팅)

**핵심**: **텔레그램 봇이 킬러 채널**. 앱 설치 없이 구독 가능, 심야에 가장 활발. `kadeora_us_stocks_bot`.

### 4.3 실적 발표 + 컨퍼런스콜 한글 실시간

**구조**:

```
1. Finnhub earnings calendar API로 실적 발표 일정 수집
   → earnings_events_us 테이블

2. 발표 시각 도달 → SEC 8-K 감지 → 즉시 파싱
   - 매출 / EPS / 가이던스 / 세그먼트 / 특이사항

3. Sonnet으로 한국어 요약 (5분 내)
   - 형식: 헤드라인 / 실적표 / 컨센 대비 / YoY / 가이던스 / 주가 반응 / 카더라 해석

4. 자동 발행 + 푸시
```

**컨퍼런스콜 한글화 (게임체인저)**:

미국 기업 IR은 대부분 공식 유튜브 채널에 컨콜 영상 게시 (Apple, NVIDIA, Tesla, AMZN 등). 이걸 활용:

```
1. 공식 IR 유튜브 채널 모니터링 (youtube_channel_monitor 크론)
2. 신규 영상 감지 → 자막 추출 (YouTube API + Whisper 백업)
3. Sonnet으로 한국어 섹션별 요약:
   - 오프닝 코멘트 (CEO)
   - 분기 실적 설명
   - 가이던스
   - Q&A 핵심 질문 TOP 5
   - 주요 키워드 (AI, 가이던스, 마진, 경쟁)
4. 전문 블로그 포스트 자동 발행
5. 자막 전문은 DB에 저장 (저작권 주의 — 요약·인용만 공개)
```

**파생 자산**: `ir_transcripts` 테이블에 누적하면 **"젠슨 황이 지난 8분기 동안 AI에 대해 한 발언 추이"** 같은 분석이 가능해진다. 이게 한국어 독점 콘텐츠로 **엄청난 SEO·브랜드 자산**.

### 4.4 10-K/10-Q XBRL 한글 파싱 (독점 영역)

**왜 중요한가**: 미국 기업의 연간보고서(10-K)·분기보고서(10-Q)는 SEC EDGAR에 공개되며, XBRL 구조화 데이터도 함께 제공된다. 한국어로 이걸 파싱·해설하는 사이트가 **전혀 없다.**

**파이프라인**:
```
1. SEC EDGAR RSS 모니터링
2. 신규 10-K/10-Q 감지 → XBRL 파싱
3. 주요 재무지표 추출: Revenue, Operating Income, Net Income,
   EPS, FCF, Debt, R&D ratio, Segment revenue
4. YoY/QoQ 비교 자동 생성
5. Sonnet으로 MD&A(경영진 논의·분석) 섹션 한글 요약
   - 리스크 팩터 신규 추가/삭제 감지 (중요!)
   - 세그먼트 성장률
   - 자본배분 코멘트
6. 블로그 발행 + 종목 페이지 "최신 10-K/10-Q" 섹션
```

**리스크 팩터 변화 감지**는 특히 독점 콘텐츠가 된다. 예: NVIDIA가 10-K에 "중국 수출 규제"를 새로 추가하면 그 자체가 뉴스.

### 4.5 매크로 × 종목 자동 매핑

**매트릭스 DB**: `macro_stock_impact`
```
매크로 이벤트 × 섹터/종목 × 영향 방향 × 영향 크기 × 근거
예:
- FOMC 금리 인상 → 성장주 (-강), 은행 (+약), 리츠 (-중)
- CPI 서프라이즈 → 채권수익률 (+), 테크 (-), 필수소비재 (+)
- 유가 급등 → 에너지 (+강), 항공 (-강), 화학 (-중)
- 달러 인덱스 급등 → 이머징 (-), 반도체 수출 (-약), 원자재 (-)
```

**플로우**:
```
1. 경제지표 캘린더 모니터링 (FOMC, CPI, PPI, 고용, 소매판매, ISM)
2. 발표 감지 → 실제값 vs 컨센서스 비교
3. 서프라이즈 감지 시 → 매트릭스에서 영향 섹터/종목 자동 조회
4. Sonnet이 "오늘 CPI 서프라이즈 수혜주 TOP 10" 자동 생성
5. 블로그 발행 + 섹터 페이지에 해당 이벤트 뱃지
```

**경제지표 캘린더 자체 구축**:
- 인베스팅닷컴 한국어가 유일한 한국어 캘린더인데 번역 품질 낮음
- FRED API + 자체 한국어 설명으로 자체 캘린더
- `/macro/calendar` — 주간/월간 경제지표 캘린더
- 각 지표 상세 페이지 (예: `/macro/cpi`, `/macro/fomc`) — 과거 추이, 해석, 관련 종목

### 4.6 환율 레이어 (언더 커버드)

서학개미가 뼈아프게 체감하지만 어떤 한국어 사이트도 잘 다루지 않는 영역:

**기능**:
- 종목 상세 페이지: **원화 차트 / 달러 차트 토글**
- 포트폴리오 원화 기준 수익률 (환율 변동 분해)
- 환헤지 ETF 비교 (헤지형 vs 언헤지형 누적 성과)
- DXY (달러 인덱스) × 종목 상관관계 분석
- 원달러 환율 시계열 + 예측 범위 (BoK 외환시장 동향 기반)

**블로그 자동 콘텐츠**:
- "원달러 환율 급등 시 한국인이 주의해야 할 미국주식"
- "QQQ vs QQQ 환헤지형 성과 비교 — [날짜] 업데이트"

### 4.7 ADR · 교차상장 허브

한국인 투자자 집중 ADR 전용 페이지:
- **쿠팡 (NYSE: CPNG)** — 한국 기업, 미국 상장
- **팔란티어 / 소파이 / 페이팔** — 한국인 선호
- **TSMC ADR vs 대만 원주** — 괴리율 추적
- **알리바바 ADR vs 홍콩 (9988.HK)** — 괴리율
- **삼성전자 GDR vs KOSPI** — 국내 vs 해외 상장

`/stock/adr` — ADR 허브
`/stock/adr/[symbol]` — 개별 ADR, 원주 대비 프리미엄/디스카운트 차트

### 4.8 ETF 구성종목 한국어 해설

**타겟 ETF** (한국인 투자 비중 높은 순):
- VOO, QQQ, SPY — 대형주 지수
- SCHD, JEPI, JEPQ — 배당 ETF
- SMH, SOXX — 반도체
- VNQ — 리츠
- TLT, IEF — 국채
- GLD — 금
- ARKK — 혁신
- BITO, IBIT — 비트코인

**기능**:
- ETF 구성종목 한국어 해설
- 리밸런싱 이벤트 감지 → 편입/편출 자동 블로그
- 배당 지급일 캘린더
- 운용보수·수익률·배당수익률 비교표
- 한국 상장 유사 ETF 비교 (TIGER 미국S&P500 vs VOO)

### 4.9 옵션 플로우 (고급, Phase 3)

Unusual Whales 스타일 한국어 구현:
- Unusual Options Activity
- Max Pain 가격
- Gamma Exposure (GEX) 종목별
- Put/Call Ratio 추이
- 대형 옵션 블록 거래

**데이터 소스**: Polygon.io ($199/월 옵션 플랜)
**난이도**: 높음. 하지만 한국어로는 완전 독점.

### 4.10 크립토 × 주식 상관 (신흥 영역)

비트코인 ETF 승인 이후 중요도 폭증:
- BTC 가격 × MSTR, COIN, MARA, RIOT 상관관계
- IBIT / FBTC 순유출입 트래킹
- BTC × NASDAQ 상관계수 추이
- 이더리움 ETF 승인 임팩트

---

## 5. AI 네이티브 기능 (카더라 고유 무기)

### 5.1 종목 Q&A 챗봇 (각 종목 페이지 하단)

**구조**:
- 종목 페이지 하단 "이 종목에 대해 물어보세요" 챗 인터페이스
- 질의 예시: "삼성전자 PBR이 왜 이렇게 낮아?", "쿠팡 경쟁사는?", "NVDA 10-K 리스크 팩터 요약"
- RAG 구조:
  - 종목 재무 데이터 (DB)
  - 최신 공시/뉴스 (DB)
  - 10-K/10-Q 요약 (DB)
  - 실시간 주가 데이터
  - 애널리스트 컨센서스
- Sonnet으로 응답 생성, 인용 출처 표기

**법적 안전장치**:
- "매수/매도 추천"류 질의는 감지 후 "정보 제공만 가능" 응답
- 모든 응답에 disclaimer 자동 삽입
- 질의·응답 로그 저장 (`stock_qa_logs`)

**수익화**: 무료 일 3회, 플러스 유저 무제한.

### 5.2 "오늘 왜 올랐지?" 버튼 (주가 움직임 자동 원인 분석)

각 종목 페이지에 **"오늘 ±N% 움직임, 왜?"** 버튼. 클릭 시:

```
Sonnet이 다음 데이터를 종합해서 한국어 분석:
1. 당일 관련 뉴스 (크롤링된 헤드라인)
2. 당일 공시 (DART/SEC)
3. 동종업종 움직임 비교
4. 지수 움직임 (KOSPI/NASDAQ)
5. 매크로 이벤트 (FOMC, 환율, 유가)
6. 수급 데이터 (외국인/기관)
7. 애널리스트 리포트 업데이트
8. 소셜 급증 키워드
```

**결과**: "오늘 삼성전자 +3.2% 상승은 다음 요인들의 조합으로 보입니다: ① 외국인 3일 연속 순매수 (영향 강), ② 메모리 반도체 업황 턴어라운드 우려 완화 뉴스 (영향 중), ③ KOSPI 지수 전체 +0.8% 동반 상승 (영향 약). *이는 정보 제공이며 매매 권유가 아닙니다.*"

**SEO 부산물**: 이 분석 자체가 "삼성전자 오늘 상승 이유 2026-04-16" 같은 URL로 인덱싱되어 롱테일 키워드 흡수.

### 5.3 AI 개인화 브리핑

**로그인 유저 맞춤**:
- 관심종목·보유종목 기반 일일 브리핑
- 매일 아침 8:00 국내장 개장 전 브리핑
- 매일 아침 7:00 해외장 마감 후 브리핑
- 주말: 주간 포트폴리오 리뷰

**채널**: 카카오 알림톡 (월 1회 무료) + 이메일 (월 1회 무료) + 웹 푸시 (3회 무료)
플러스 구독자: 카카오 매일 + 이메일 매일 + 푸시 무제한

**법적 주의**: 개별 종목 매매 권유로 해석되지 않게, "관심종목 주요 이벤트", "오늘 체크할 포인트" 형식. 구체 매매 지시 금지.

### 5.4 리포트 다이제스트

**공개 리포트만 합법 요약**:
- 한경컨센서스에 공개된 애널리스트 리포트 목록
- 리포트 전재 금지, **목표주가·의견·핵심 논거 3줄 요약**만
- 각 요약에 "원문 보기" 링크 (출처 크레딧)
- DART 증권신고서의 분석 섹션 요약

**파생 콘텐츠**:
- 주간 "이번주 애널리스트 목표주가 상향/하향" 블로그
- 종목 상세 페이지 "최근 애널리스트 의견" 섹션

### 5.5 투자 일지 AI 분석 (리텐션 킬러)

사용자가 매매 기록(CSV 업로드 or MTS 연동 or 수동 입력) 업로드하면:
- 승률
- 평균 보유 기간
- 손익비
- 손실 종목 공통점 (섹터/시총/진입 시점)
- "최근 3개월간 당신의 매매 패턴은..." AI 분석 리포트

**리텐션 효과**: 매매 기록 누적된 유저는 절대 이탈 안 함 (데이터 lock-in).

### 5.6 IR 유튜브 자막 검색 엔진

**"젠슨 황이 지난 2년간 중국에 대해 뭐라고 말했는지 검색"** 같은 질의가 가능한 DB:
- 주요 IR 공식 채널 (NVDA, AAPL, TSLA, MSFT, AMZN, GOOGL, META, NFLX 등 50+)
- 자막 DB 누적 (`ir_transcripts`)
- 벡터 임베딩 기반 의미 검색
- 키워드 검색 + 문맥 발췌 + 영상 타임스탬프 링크

**한국어 독점**: 전 세계 어디에도 한국어로 이걸 제공하는 서비스 없음.

---

## 6. 커뮤니티·소셜 해자

### 6.1 수급 인증 뱃지 (섹션 3.10 확장)
MTS 스크린샷 업로드 → 보유 인증 → 🔶 뱃지 → 발언 가중치.

### 6.2 포트폴리오 공개 리더보드 (익명)
- 익명 포트폴리오 공개 옵션
- 월간/연간 수익률 리더보드
- 포트폴리오 상세 페이지 (공유 가능 OG 이미지 자동 생성)
- 탐험 탭에서 "전체 공개 포트폴리오" 검색 가능
- 상위권 포트폴리오는 프로필 페이지로 권위 빌드
- **법적 주의**: "이 포트폴리오를 따라 사세요"류 표현 불가. "참고용" 문구 강제.

### 6.3 종목별 전문가 Pick (유저 기여)
유저가 종목에 대한 긴 분석글(Seeking Alpha 스타일) 작성 가능:
- 심사 후 "전문가 픽" 뱃지
- 분석글 → 블로그로 전환 (SEO 자산)
- 추천수 높은 분석가 프로필 페이지

### 6.4 주린이 용어사전 (위키형)
- 500~1000개 용어 자체 구축
- `/glossary/[term]` — 각 용어 페이지
- **프로그래매틱 SEO 자산**: 롱테일 키워드 무한 흡수
- 예: "PBR이란", "EPS 계산", "선물옵션 만기일", "차등배당", "자사주 소각"

### 6.5 예측 게임 (월간 수익률 맞히기)
- 월초에 "이번 달 KOSPI 종가 맞히기"
- 상위 10% 상품 지급 (포인트)
- 상위권 유저 프로필 권위 빌드
- 리텐션 + UGC

### 6.6 투자 일지 공개 기능
섹션 5.5의 투자 일지를 선택적으로 공개 가능. 베스트 투자 일지 큐레이션 → 블로그 → SEO.

---

## 7. DB 스키마 상세

Supabase에 추가되어야 할 주요 테이블. 기존 테이블과 충돌하지 않게 네이밍.

```sql
-- ==================================
-- 7.1 국내주식 데이터
-- ==================================

CREATE TABLE flow_snapshots_krx (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  trade_date DATE NOT NULL,
  foreign_net BIGINT,
  institution_net BIGINT,
  individual_net BIGINT,
  pension_net BIGINT,
  insurance_net BIGINT,
  investment_trust_net BIGINT,
  foreign_ownership_ratio NUMERIC(5,2),
  UNIQUE(symbol, trade_date)
);
CREATE INDEX idx_flow_symbol_date ON flow_snapshots_krx(symbol, trade_date DESC);

CREATE TABLE short_selling_krx (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  trade_date DATE NOT NULL,
  short_volume BIGINT,
  short_amount BIGINT,
  short_ratio NUMERIC(5,2),
  is_overheat BOOLEAN DEFAULT FALSE,
  overheat_until DATE,
  UNIQUE(symbol, trade_date)
);

CREATE TABLE lending_balance_krx (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  trade_date DATE NOT NULL,
  balance_shares BIGINT,
  balance_amount BIGINT,
  change_1d NUMERIC,
  change_5d NUMERIC,
  UNIQUE(symbol, trade_date)
);

CREATE TABLE flow_signals (
  id BIGSERIAL PRIMARY KEY,
  signal_type TEXT NOT NULL, -- 'foreign_buying_breakout', 'short_squeeze_candidate', etc
  symbol TEXT NOT NULL,
  signal_date DATE NOT NULL,
  strength NUMERIC,
  interpretation_ko TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE dart_filings (
  id BIGSERIAL PRIMARY KEY,
  rcept_no TEXT UNIQUE NOT NULL,
  corp_code TEXT,
  corp_name TEXT,
  symbol TEXT,
  report_nm TEXT,
  category TEXT, -- 실적공시/주요주주변경/자사주/유상증자/...
  importance_score INTEGER, -- 1-10
  summary_ko TEXT,
  original_url TEXT,
  filed_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ
);
CREATE INDEX idx_dart_symbol_date ON dart_filings(symbol, filed_at DESC);
CREATE INDEX idx_dart_category ON dart_filings(category, filed_at DESC);

CREATE TABLE financial_statements_xbrl (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  period TEXT NOT NULL, -- '2025Q4', '2025', etc
  report_type TEXT, -- 'annual', 'quarterly'
  revenue BIGINT,
  operating_income BIGINT,
  net_income BIGINT,
  total_assets BIGINT,
  total_equity BIGINT,
  total_debt BIGINT,
  eps NUMERIC,
  bps NUMERIC,
  roe NUMERIC,
  roa NUMERIC,
  debt_ratio NUMERIC,
  raw_data JSONB,
  UNIQUE(symbol, period)
);

CREATE TABLE analyst_consensus (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  target_date DATE NOT NULL, -- 컨센서스 집계 기준일
  target_period TEXT, -- '2026', '2026Q2', etc
  revenue_consensus BIGINT,
  operating_income_consensus BIGINT,
  eps_consensus NUMERIC,
  target_price_avg NUMERIC,
  target_price_high NUMERIC,
  target_price_low NUMERIC,
  num_analysts INTEGER,
  buy_ratio NUMERIC,
  hold_ratio NUMERIC,
  sell_ratio NUMERIC,
  UNIQUE(symbol, target_date, target_period)
);

CREATE TABLE earnings_events (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  market TEXT NOT NULL, -- 'KRX', 'US'
  period TEXT,
  scheduled_at TIMESTAMPTZ,
  actual_at TIMESTAMPTZ,
  status TEXT, -- 'scheduled', 'released', 'analyzed'
  revenue_actual BIGINT,
  revenue_consensus BIGINT,
  eps_actual NUMERIC,
  eps_consensus NUMERIC,
  surprise_pct NUMERIC,
  category TEXT, -- 'surprise_positive', 'surprise_negative', 'inline'
  summary_ko TEXT,
  blog_post_id BIGINT
);

CREATE TABLE ipo_events (
  id BIGSERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  symbol TEXT, -- 상장 후 부여
  subscription_start DATE,
  subscription_end DATE,
  demand_forecast_result JSONB,
  final_price INTEGER,
  band_low INTEGER,
  band_high INTEGER,
  competition_ratio NUMERIC,
  lockup_info JSONB,
  listing_date DATE,
  first_day_close INTEGER,
  first_day_change NUMERIC,
  status TEXT, -- 'upcoming', 'subscribing', 'listed', 'cancelled'
  dart_filing_url TEXT
);

CREATE TABLE corporate_actions (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  action_type TEXT, -- 'dividend', 'rights', 'split', 'merger', 'agm'
  action_date DATE,
  ex_date DATE,
  record_date DATE,
  details JSONB,
  description_ko TEXT
);

CREATE TABLE kadeora_indices (
  id BIGSERIAL PRIMARY KEY,
  index_code TEXT NOT NULL, -- 'KD_AI', 'KD_DIVIDEND_KING', etc
  index_name TEXT,
  calc_date DATE NOT NULL,
  value NUMERIC,
  change_pct NUMERIC,
  constituents JSONB, -- 종목 리스트 + 가중치
  UNIQUE(index_code, calc_date)
);

-- ==================================
-- 7.2 해외주식 데이터
-- ==================================

CREATE TABLE stocks_us_details (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT UNIQUE NOT NULL,
  exchange TEXT,
  company_name TEXT,
  company_name_ko TEXT, -- 한글 기업명
  sector TEXT,
  industry TEXT,
  ir_youtube_channel_id TEXT, -- IR 공식 유튜브 채널
  is_adr BOOLEAN DEFAULT FALSE,
  adr_underlying_symbol TEXT, -- ADR의 경우 원주 심볼
  adr_ratio NUMERIC -- 1 ADR = N 원주
);

CREATE TABLE sec_filings (
  id BIGSERIAL PRIMARY KEY,
  accession_number TEXT UNIQUE NOT NULL,
  symbol TEXT,
  form_type TEXT, -- '10-K', '10-Q', '8-K'
  filed_at TIMESTAMPTZ,
  period_of_report DATE,
  summary_ko TEXT,
  risk_factors_new TEXT[], -- 신규 리스크 팩터
  risk_factors_removed TEXT[], -- 삭제된 리스크 팩터
  xbrl_data JSONB,
  original_url TEXT
);

CREATE TABLE ir_transcripts (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  video_id TEXT UNIQUE,
  video_title TEXT,
  published_at TIMESTAMPTZ,
  transcript_raw TEXT, -- 자막 원문
  transcript_segments JSONB, -- 타임스탬프 + 세그먼트
  summary_ko TEXT,
  key_quotes_ko JSONB, -- 주요 발언 한글 번역
  topics TEXT[], -- ['AI', 'China', 'Gaming', ...]
  embeddings VECTOR(1536) -- 의미 검색용
);

CREATE TABLE macro_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT, -- 'FOMC', 'CPI', 'PPI', 'NFP', 'ISM', 'Retail_Sales'
  country TEXT,
  scheduled_at TIMESTAMPTZ,
  actual_value NUMERIC,
  consensus_value NUMERIC,
  previous_value NUMERIC,
  surprise_magnitude NUMERIC,
  description_ko TEXT
);

CREATE TABLE macro_stock_impact (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  surprise_direction TEXT, -- 'positive', 'negative'
  target_entity_type TEXT, -- 'sector', 'theme', 'symbol'
  target_entity TEXT,
  impact_direction TEXT, -- 'positive', 'negative'
  impact_magnitude TEXT, -- 'strong', 'moderate', 'weak'
  rationale_ko TEXT
);

CREATE TABLE etf_holdings (
  id BIGSERIAL PRIMARY KEY,
  etf_symbol TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  holding_symbol TEXT,
  weight_pct NUMERIC,
  shares BIGINT,
  UNIQUE(etf_symbol, as_of_date, holding_symbol)
);

CREATE TABLE etf_rebalancing_events (
  id BIGSERIAL PRIMARY KEY,
  etf_symbol TEXT NOT NULL,
  event_date DATE,
  symbols_added TEXT[],
  symbols_removed TEXT[],
  weight_changes JSONB,
  description_ko TEXT
);

-- ==================================
-- 7.3 커뮤니티/유저
-- ==================================

CREATE TABLE user_holdings_verifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  symbol TEXT,
  broker TEXT, -- '한국투자', '키움', 'Fidelity', 'Robinhood', ...
  screenshot_url TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID, -- 운영자
  status TEXT -- 'pending', 'approved', 'rejected'
);

CREATE TABLE user_portfolios_public (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  slug TEXT UNIQUE,
  name TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  holdings JSONB,
  monthly_return NUMERIC,
  ytd_return NUMERIC,
  last_updated_at TIMESTAMPTZ
);

CREATE TABLE user_stock_opinions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  symbol TEXT,
  opinion TEXT, -- 'buy', 'hold', 'sell'
  horizon TEXT, -- 'short', 'mid', 'long'
  rationale TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE stock_qa_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  symbol TEXT,
  question TEXT,
  answer TEXT,
  sources JSONB,
  feedback INTEGER, -- -1, 0, 1
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_trading_journals (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  symbol TEXT,
  action TEXT, -- 'buy', 'sell'
  quantity NUMERIC,
  price NUMERIC,
  executed_at TIMESTAMPTZ,
  notes TEXT,
  is_public BOOLEAN DEFAULT FALSE
);

-- ==================================
-- 7.4 SEO/메타
-- ==================================

CREATE TABLE programmatic_seo_pages (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  page_type TEXT, -- 'stock_dividend_year', 'theme_leaders', ...
  metadata JSONB,
  last_generated_at TIMESTAMPTZ,
  pageview_count BIGINT DEFAULT 0
);

CREATE TABLE stock_hero_slides (
  id BIGSERIAL PRIMARY KEY,
  slide_order INTEGER,
  title_ko TEXT,
  subtitle_ko TEXT,
  image_url TEXT, -- /api/og?design=X&...
  link_url TEXT,
  active_from TIMESTAMPTZ,
  active_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);
```

**RLS 주의**: `user_holdings_verifications`, `user_trading_journals`는 본인만 읽기·쓰기. `user_portfolios_public.is_public = true`인 경우만 공개.

**기존 `database.ts` 미반영 테이블**: `(sb as any).from('table_name')` 패턴 필수 (Node의 기존 규칙).

---

## 8. 크론 오케스트레이션 — 시간대별 완전 플로우

KST 기준. 기존 크론 위에 추가·재구성.

### 8.1 평일 하루 (영업일)

| KST | 크론 | 내용 | 모델 |
|---|---|---|---|
| 05:10 | us-closing-bell-recap | 미국장 마감 요약 | Haiku |
| 05:30 | us-aftermarket-earnings | 시간외 실적 (AAPL/NVDA 등) | Sonnet |
| 06:00 | us-daily-recap-blog | 전일 미국장 종합 블로그 | Sonnet |
| 07:00 | us-overnight-macro-brief | 간밤 매크로 이벤트 정리 | Haiku |
| 07:30 | krx-premarket-brief | 국내장 개장 전 브리핑 | Haiku |
| 08:00 | personalized-morning-brief | 개인화 아침 브리핑 | Haiku |
| 08:30 | krx-opening-checklist | 오늘 체크리스트 (실적/공시/이벤트) | Haiku |
| 09:00 | krx-opening-bell | 개장 후 주요 종목 움직임 | Haiku |
| 10:00 | krx-flow-signal-scan-1 | 수급 시그널 스캔 1 | Haiku |
| 11:30 | krx-midday-movers | 오전장 이슈 종목 | Haiku |
| 13:00 | krx-midday-brief | 점심 브리핑 | Haiku |
| 14:00 | krx-flow-signal-scan-2 | 수급 시그널 스캔 2 | Haiku |
| 15:10 | krx-pre-close | 마감 20분 전 주요 움직임 | Haiku |
| 15:35 | krx-closing-bell | 장 마감 요약 | Sonnet |
| 16:00 | krx-flow-daily-finalize | 수급 최종 집계 + 시그널 확정 | Haiku |
| 16:30 | krx-daily-recap-blog | 국내장 종합 블로그 | Sonnet |
| 17:00 | krx-top-movers-blog | "오늘의 특징주 TOP 10" | Haiku |
| 17:30 | krx-short-selling-daily | 공매도 데이터 집계 | - |
| 18:00 | dart-daily-digest | DART 주요 공시 다이제스트 | Sonnet |
| 18:30 | earnings-krx-daily | 실적 발표 종목 요약 | Sonnet |
| 19:00 | analyst-consensus-changes | 애널 목표가 변경 추적 | Haiku |
| 20:00 | us-preview-blog | 오늘 미국장 프리뷰 | Sonnet |
| 20:30 | macro-calendar-tomorrow | 내일 주요 경제지표 | Haiku |
| 21:30 | us-premarket-watchlist | 프리마켓 워치리스트 | Haiku |
| 22:00 | us-premarket-movers-push | 프리마켓 알림톡/푸시 | - |
| 22:35 | us-opening-bell-live | 미국장 개장 15분 후 | Haiku |
| 23:30 | us-morning-brief | 개장 1시간 종합 | Sonnet |

심야:
| 01:00 | us-midday-update | 미국 정오 업데이트 | Haiku |
| 03:30 | us-closing-hour | 마감 30분 전 | Haiku |

### 8.2 실시간 트리거 (이벤트 기반)

- **DART 공시 감지**: 매 15분 폴링, 실적 공시 감지 시 즉시 요약 크론 트리거
- **SEC 8-K 감지**: 매 10분 폴링, 주요 기업 8-K 감지 시 즉시 요약
- **IR 유튜브 신규 영상**: 매 30분 폴링, 신규 영상 감지 시 자막 추출 → 요약 파이프라인
- **FOMC/CPI 발표**: 시간 정각 즉시 데이터 수집 → 매크로 영향 매핑 → 블로그

### 8.3 주간/월간

| 주기 | 크론 | 내용 |
|---|---|---|
| 일요일 19:00 | weekly-market-preview | 이번 주 주요 이벤트 프리뷰 |
| 금요일 18:00 | weekly-krx-recap | 국내장 주간 리뷰 |
| 토요일 08:00 | weekly-us-recap | 미국장 주간 리뷰 |
| 토요일 10:00 | weekly-ipo-digest | 다음 주 IPO 일정 |
| 토요일 12:00 | weekly-sector-rotation | 주간 섹터 로테이션 분석 |
| 일요일 14:00 | weekly-kadeora-index | 자체 지수 주간 움직임 |
| 월초 (1일 09:00) | monthly-macro-outlook | 월간 매크로 전망 |
| 월말 (말일 18:00) | monthly-review | 월간 종합 리뷰 |
| 분기초 | quarterly-earnings-kickoff | 이번 분기 실적 시즌 프리뷰 |
| 연초/연말 | yearly-outlook / recap | 연간 전망/회고 |

### 8.4 크론 설계 원칙

- 모든 크론 `withCronLogging` 래퍼 사용 (기존 규칙)
- 항상 HTTP 200 반환 (기존 규칙)
- `{ processed, created, updated, failed, metadata }` 반환 형식 (기존 규칙)
- 블로그 생성은 `safeBlogInsert` 통과 (기존 규칙)
- 포인트 변경은 `award_points`/`deduct_points` RPC만 (기존 규칙)
- **신규 규칙: AI 생성 콘텐츠는 `sanitizeAiContent` 필터 강제 통과**

---

## 9. OG·이미지·영상 파이프라인

### 9.1 OG 디자인 확장 (design=7~12)

기존 design 1~6 위에 추가:

- **design=7** 실적 카드: 종목명 + EPS/매출 + 컨센 대비 색상 표시
- **design=8** 수급 카드: 외인/기관/개인 3일 누적 막대
- **design=9** 차트 카드: 30일 스파크라인 + 현재가 + 전일비
- **design=10** 랭킹 카드: 5개 종목 리스트 + 썸네일
- **design=11** 매크로 카드: FOMC/CPI 같은 이벤트 + 수혜 섹터
- **design=12** 비교 카드: 종목 A vs 종목 B (가로 분할)

**각 design은 포스트 카테고리에 자동 매핑**:
- 실적 블로그 → design=7
- 수급 시그널 블로그 → design=8
- 종목 상세 페이지 → design=9
- "TOP N" 블로그 → design=10
- 매크로 블로그 → design=11
- 비교 블로그 → design=12

### 9.2 동적 차트 이미지 API (`/api/chart-image`)

```
/api/chart-image?symbol=005930&period=30d&type=line
/api/chart-image?symbol=AAPL&period=1y&type=candle&overlay=ma20,ma60
/api/chart-image?compare=005930,000660&period=3m
```

- 이미지 생성: `@vercel/og` + 커스텀 차트 그리기
- 캐시: Vercel Edge Cache 1시간
- **모든 주식 블로그 본문에 자동 삽입** (Sonnet 프롬프트에 차트 위치 마커 포함)

### 9.3 Remotion 쇼츠 영상 자동 생성 (게임체인저)

**왜 중요한가**: 네이버는 2025년부터 영상 콘텐츠 가중치 대폭 상향. YouTube Shorts, 네이버 클립, 카카오뷰까지 영상 채널이 폭발.

**파이프라인**:
```
1. 주제 선정 (주간 Top 5 상승/하락 종목, 오늘의 특징주 등)
2. 스크립트 생성 (Sonnet, 60초 분량)
3. TTS 음성 생성 (OpenAI TTS-HD Korean or ElevenLabs Korean)
4. Remotion 템플릿 렌더링:
   - 인트로 (2초): 카더라 로고 + 타이틀
   - 차트 애니메이션 (15초)
   - 핵심 팩트 3가지 (30초, 각 10초)
   - CTA (5초): "더 자세한 내용은 카더라에서"
5. 렌더링 → YouTube Shorts / 네이버 클립 / 인스타 릴스 / 쇼츠 탭
6. 각 플랫폼 autoupload
```

**크론**: `cron/shorts-daily-generation` (매일 16:30, 장 마감 후)

**예상 편당 비용**: 스크립트 $0.01 + TTS $0.05 + 렌더 $0.02 = $0.08 (약 100원). 하루 3편 생산 시 월 10,000원 이하.

### 9.4 네이버 플랫폼 특화

- **네이버 클립**: 세로형 1080×1920, 15~60초
- **카카오뷰**: 가로형 1080×1080 + 링크 카드
- **네이버 프리미엄콘텐츠**: 유료 콘텐츠 배포 채널 — 프리미엄 티어 출시 시 연계

---

## 10. 네이버 SEO 심화 + Google Discover

### 10.1 네이버 SEO 핵심

**네이버의 검색 엔진 원리 (2026년 기준)**:
- C-Rank + D.I.A.+ 알고리즘
- 전문성·인기도·최신성·신뢰도 4축
- 문서의 **고유 정보 가치** 중시 (자동번역·복붙 콘텐츠 감점)
- **이미지 풍부도** 중요 (포스트당 3장 이상 고유 이미지 강력 가점)
- **체류시간·스크롤 깊이** 간접 반영 (네이버 View 탭 노출에 영향)

**실천 규칙**:
1. 모든 블로그 포스트 고유 이미지 3장 이상 (OG + 차트 + 비교 이미지)
2. 본문 첫 문단 100자 내 핵심 키워드 3회
3. `<h2>` 최소 5개, 각 키워드 포함
4. 본문 1500~3000자 (너무 짧지도, 너무 길지도 않게)
5. 내부 링크 5~10개 (종목 페이지, 관련 블로그, 테마 페이지)
6. 외부 출처 링크 1~3개 (DART, KRX, SEC 등 권위 소스)
7. **작성자·수정일 명시** (E-E-A-T)
8. 카테고리·태그 명확히 (네이버는 카테고리 구조 본다)

### 10.2 네이버 Smart Block 타겟팅

Smart Block은 특정 쿼리에 대해 블로그·카페·지식인 등을 섞어서 보여주는 네이버의 프리미엄 영역. 타겟 쿼리 패턴:

**커버 쿼리 템플릿 30종** (모두 크론으로 자동 생성):

*국내주식*:
1. "[종목] 배당금 [연도]"
2. "[종목] 목표주가"
3. "[종목] 실적 발표일"
4. "[종목] 액면분할"
5. "[종목] 공매도"
6. "[종목] 외국인 보유비율"
7. "[종목] 자사주 매입"
8. "[섹터] 대장주"
9. "[테마] 관련주"
10. "[테마] 수혜주"
11. "공모주 [월] 청약"
12. "[종목] 의무보유 해제"
13. "코스피 전망 [월]"
14. "[지수] 구성종목"

*해외주식*:
15. "[종목] 실적 발표"
16. "[종목] 배당"
17. "[종목] 목표주가"
18. "[ETF] 구성종목"
19. "[ETF] 배당"
20. "FOMC [월] 예상"
21. "CPI [월] 예상"
22. "미국주식 양도세"
23. "[종목] 분할"
24. "[종목] 10-K"

*계산기/가이드*:
25. "양도세 계산기"
26. "배당소득세 계산"
27. "주식 용어 [용어]"
28. "[종목] 차트 분석"
29. "[종목] PER"
30. "[종목] 매수 타이밍" — ⚠️ 이건 유사투자자문 리스크. 대신 "[종목] 밸류에이션" 같은 중립적 표현.

### 10.3 프로그래매틱 SEO (이전 답변에 없던 핵심 전략)

**규모의 SEO**. 조합으로 수만 페이지 자동 생성:

**페이지 타입 1: 종목 × 연도 배당**
- URL 패턴: `/stock/[symbol]/dividend/[year]`
- 예: `/stock/005930/dividend/2025`
- 종목 수 728 × 연도 5년치 = 3,640 페이지
- 각 페이지: 배당금 내역, 배당락일, 배당수익률, 배당성향, 과거 비교

**페이지 타입 2: 종목 × 분기 실적**
- URL 패턴: `/stock/[symbol]/earnings/[period]`
- 예: `/stock/005930/earnings/2025Q4`
- 728 × 4분기 × 5년 = 14,560 페이지

**페이지 타입 3: 테마 × 연도 리더**
- URL 패턴: `/theme/[theme]/leaders/[year]`
- 예: `/theme/반도체/leaders/2025`
- 50 테마 × 5년 = 250 페이지

**페이지 타입 4: 섹터 × 지표**
- URL 패턴: `/sector/[sector]/[metric]`
- 예: `/sector/금융/per-low`, `/sector/반도체/dividend-yield-high`

**페이지 타입 5: 용어 사전**
- URL 패턴: `/glossary/[term]`
- 500~1,000 용어

**페이지 타입 6: 날짜별 증시 요약 (유니크)**
- URL 패턴: `/market/[date]`
- 예: `/market/2026-04-16`
- 영구 아카이브. 미래 사용자가 "2026년 4월 16일 주가" 검색 시 유입.
- 영업일 × 몇 년치 = 수천 페이지

**페이지 타입 7: ETF × 날짜 보유종목**
- `/etf/QQQ/holdings/2026-04-16`

**총 자동 생성 페이지 규모**: Phase 2 완료 시 20,000~50,000페이지. 블로그 포스트와 별개로 SEO 자산.

### 10.4 내부 링크 그래프 최적화

**원칙**: 모든 페이지에 최소 15개 내부 링크 + 최소 3개 외부 권위 링크.

**링크 그래프 구조**:
```
블로그 포스트 → 종목 페이지 (3~5개)
               → 관련 블로그 (3~5개)
               → 테마 페이지 (1~2개)
               → 용어 사전 (2~3개)

종목 페이지   → 유사 종목 (3개)
              → 관련 블로그 (6~8개)
              → 속한 테마 (1~2개)
              → 속한 섹터 (1개)
              → 코퍼레이트 액션 (해당 시)

테마 페이지   → 구성 종목 (10~30개)
              → 관련 블로그
              → 유사 테마
```

### 10.5 Google Discover 타겟팅 (이전 답변에 없음)

**Google Discover는 모바일 한정이고, 한국어 사용자의 주식 검색 트래픽 상당 부분이 Discover에서 발생한다.** 특히 아침 출근길 스마트폰 스크롤.

**Discover 선정 규칙**:
- 1200×1200 큰 이미지 (카더라 OG 기본 1200×630인데, Discover용 **정방형 추가 생성 필요**)
- 최신성 (24시간 내 발행)
- 신뢰도 (도메인 권위 + 작성자 명시)
- 시의성 (트렌드 키워드 포함)
- **제목 클릭 유발 요소**: 수치, 구체 기간, 변화

**`/api/og-discover` 신설**: 1200×1200 정방형 OG 이미지.
**메타태그**: `max-image-preview:large` 필수.

### 10.6 JSON-LD 구조화 데이터 확장

현재 BlogPosting·ApartmentComplex·BreadcrumbList 등은 있음. 주식 영역 추가:

```jsonld
// 종목 상세 페이지
{
  "@type": "FinancialProduct",
  "name": "삼성전자 보통주",
  "category": "Stock",
  "provider": { "@type": "Organization", "name": "Samsung Electronics" }
}

// 실적 발표 이벤트
{
  "@type": "Event",
  "name": "삼성전자 2026년 1분기 실적 발표",
  "startDate": "2026-04-30T08:00",
  "eventAttendanceMode": "OnlineEventAttendanceMode"
}

// 종목 Q&A (매우 강력 — 네이버·구글 둘 다 좋아함)
{
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "삼성전자 2026년 배당금은?", ... }
  ]
}

// 데이터셋 (기업 재무 데이터)
{
  "@type": "Dataset",
  "name": "삼성전자 분기별 재무 데이터",
  "temporalCoverage": "2020/2026"
}
```

### 10.7 사이트맵 분할

현재 단일 sitemap에서:
```
sitemap-index.xml
├── sitemap-blog-stock.xml    (주식 블로그)
├── sitemap-blog-apt.xml      (부동산 블로그)
├── sitemap-stock-krx.xml     (국내 종목)
├── sitemap-stock-us.xml      (해외 종목)
├── sitemap-theme.xml         (테마)
├── sitemap-sector.xml        (섹터)
├── sitemap-etf.xml           (ETF)
├── sitemap-ipo.xml           (IPO)
├── sitemap-glossary.xml      (용어)
├── sitemap-market-daily.xml  (일일 증시)
└── sitemap-programmatic.xml  (프로그래매틱 SEO)
```

네이버·구글 웹마스터 도구에 각각 등록.

### 10.8 RSS 피드 분할

- `/rss/stock.xml` — 전체 주식
- `/rss/stock-krx.xml` — 국내만
- `/rss/stock-us.xml` — 해외만
- `/rss/stock-earnings.xml` — 실적만 (페드북 구독자용)
- `/rss/stock-flows.xml` — 수급 시그널만

---

## 11. 노출면적 최대화 완전 전략

### 11.1 히어로 이미지 캐러셀 (/stock 상단)

이전 답변과 동일하되 확장:
- 7~10 슬라이드 자동 회전 (5초)
- 슬라이드 다이버시티: 급등주·급락주·실적·공시·테마·매크로·IPO·신고가·미국 야간장 하이라이트·이벤트 캘린더
- **쇼츠 영상 슬라이드 추가** (1슬라이드가 자동재생 영상)
- 모바일: 1.2 : 1 비율, 데스크탑: 16 : 6
- 첫 슬라이드 priority + preload

### 11.2 Sticky 요소 4종

1. **데스크탑 우측 사이드바** (종목 상세): 미니 차트 + 현재가 + 수급 + 관심 버튼
2. **모바일 하단바** (종목 상세): 현재가 + "관심 + 알림" CTA
3. **사이트 전체 우측 하단 플로팅**: "AI에게 물어보기" 챗 버튼 (Q&A 진입)
4. **읽기 진행률 바** (블로그): 상단 1px 진행률

### 11.3 푸터 벨트 (모든 페이지)

푸터 바로 위 2단:
- 상단: "지금 뜨는 종목 20선" (실시간 업데이트)
- 하단: "오늘의 매크로 이벤트" (FOMC/CPI/실적)

### 11.4 PWA + 웹 푸시

- `manifest.json` + 서비스워커 (이미 Next.js에서 간단)
- 홈화면 설치 유도 팝업 (3회 방문 유저 대상)
- 웹 푸시: 구독 팝업 (첫 방문 7일 이후 1회만)
- 푸시 채널:
  - 관심종목 급등락 (±5% 이상)
  - 관심종목 실적 발표
  - 관심종목 중요 공시
  - 미국장 오픈 요약 (23:00)
  - 미국장 마감 요약 (05:30)

### 11.5 카카오 플러스친구 + 텔레그램 봇

**카카오 플러스친구**:
- Solapi 이미 연동되어 있음
- 구독자 기반 일일 알림톡 (월 1회 무료, 추가는 프리미엄)
- 주간 증시 요약 리치 메시지

**텔레그램 봇** (`@kadeora_bot`):
- 심야 미국장 실시간 알림 (킬러 채널)
- 봇에서 직접 종목 검색: `/stock AAPL`
- 종목 알람 설정: `/alert AAPL 200`
- 실적 달력: `/earnings`

### 11.6 네이버 View 탭 제목 패턴 (고확률 노출)

**수치 패턴**:
- "2026년 [종목] 배당금 [금액]원 정리"
- "[종목] 목표주가 [금액]원, [증권사] 전망"
- "[섹터] 대장주 TOP 5 정리"

**질문 패턴** (스마트블록 최적화):
- "[종목] 지금 사도 될까? 밸류에이션 분석"
- "[테마] 어떤 종목이 대장주?"

**시즌 패턴**:
- "[월] [종목] 배당락일 정리"
- "[분기] 실적 발표 일정"
- "[연도] 공모주 청약 일정"

**비교 패턴**:
- "[종목 A] vs [종목 B] — 누가 더 유망한가"
- "[ETF A] vs [ETF B] — 수익률·배당 비교"

**가이드 패턴**:
- "[종목] 차트 분석 방법 A to Z"
- "[ETF] 세금 처리 방법 정리"

### 11.7 외부 채널 확장

- **네이버 블로그**: 주요 포스트 크로스포스팅 (원본 링크 포함, 중복 콘텐츠 페널티 주의하여 요약·발췌)
- **티스토리/브런치**: 장문 에세이형 콘텐츠
- **YouTube Shorts 채널**: 쇼츠 영상 전용
- **인스타 릴스**: 동일 쇼츠 재활용
- **스레드/X**: 시그널 발생 시 자동 포스팅

---

## 12. 수익화 구조 (Toss 심사 이후 설계)

### 12.1 프리미엄 티어 3단

| 티어 | 가격 | 내용 |
|---|---|---|
| **Basic** | 무료 | 기본 데이터, 일 1회 브리핑, AI Q&A 3회/일 |
| **Plus** | 월 9,900원 | 개인화 일일 브리핑(카톡+이메일), 수급 시그널 전체, AI Q&A 무제한, 실시간 알림 |
| **Pro** | 월 29,900원 | Plus + 옵션 플로우 + 백테스팅 + 프리미엄 콘텐츠 + API 액세스(월 10K 콜) |

**연간 결제 20% 할인**: Plus 95,000원/년, Pro 287,000원/년.

**법적**: 유사투자자문업 등록 필수. Toss 결제 심사와 병행.

### 12.2 증권사 계좌개설 제휴 (고수익)

- 국내: 삼성증권, 미래에셋, 한국투자, 키움, 토스증권, NH투자, 대신
- 해외: 토스증권 해외, 미래에셋 해외, Firstrade(한국어 지원), Webull Korea

**랜딩 페이지**: `/partnership/broker/[broker]` — 해당 증권사 장단점 + 수수료 비교 + 이벤트
**리워드**: 계좌 개설 + 입금 + 거래 시 건당 2~10만원
**예상 월 매출**: 월 100건 기준 200~1,000만원

**법적**: 광고성 콘텐츠 명시 의무. "광고 포함" 라벨.

### 12.3 교육 콘텐츠 판매 (장기)

- "주린이 탈출 30일" 강의 (가격 49,000원)
- "해외주식 세금 완벽 가이드" e북 (19,900원)
- Stripe 또는 Toss로 결제

### 12.4 B2B API (Phase 3)

- 자체 구축한 수급 시그널·공시 요약·지수 데이터를 B2B API로 판매
- 타겟: 리서치 회사, 핀테크 스타트업, 미디어
- 월 50~500만원 구간

### 12.5 광고 최소화 원칙

- **애드센스·구글 디스플레이 광고 금지** (UX 파괴)
- 증권사 제휴 광고만 허용 (관련성 높음)
- 유료 티어 유입을 주 수익화 전략으로

---

## 13. 리텐션 시스템

### 13.1 일일 로그인 스트릭

- 3일/7일/30일/100일 스트릭 뱃지
- 스트릭 유지 시 포인트 보너스
- 7일 연속 로그인: Plus 1주 무료 체험

### 13.2 포인트 경제 재설계

기존 `award_points`/`deduct_points` 활용:
- 로그인: 10p
- 블로그 읽기: 5p (BlogReadGate 연동)
- 커뮤니티 글 작성: 50p
- 댓글: 10p
- 투자 일지 기록: 20p
- 포트폴리오 공개: 100p (1회)

**포인트 사용처**:
- AI Q&A 추가 (50p/회)
- 프리미엄 콘텐츠 열람 (100p/건)
- 카카오 알림톡 추가 (200p/회)
- Plus 1일 체험 (1,000p)

### 13.3 알림 구독 시스템

3단계 세분화:
- **종목 알림**: 관심종목 가격 ±%, 실적, 공시
- **테마 알림**: 관심 테마 급등, 관련 뉴스
- **매크로 알림**: FOMC, CPI, 주요 경제지표

각 알림 채널 선택: 푸시 / 알림톡 / 이메일 / 텔레그램.

### 13.4 개인 대시보드 (`/my`)

- 관심종목 대시보드 (가격 + 시그널 + 최근 뉴스)
- 보유종목 분석 (성과 + 리스크)
- 월간 성적표 (수익률 + 유사 유저 대비 퍼센타일)
- 오늘의 할 일 (실적 발표 관심종목 / 배당락일 / 미국장 일정)

---

## 14. 측정 & 실험

### 14.1 핵심 지표 (North Star)

- **주간 활성 유저 (WAU)**: 목표 3개월 뒤 현재 대비 5배
- **세션당 페이지뷰**: 현재 1.025 → 목표 3.0
- **알림 구독자 수**: 3개월 뒤 10,000명
- **텔레그램 봇 구독자**: 3개월 뒤 5,000명
- **Plus 전환율**: 가입 유저의 5%
- **네이버 View 탭 상위 10개 키워드 1페이지 진입 개수**: 50개
- **Google Discover 노출**: 월 100만 impression

### 14.2 코호트 분석

- 신규 유저의 D1/D7/D30 리텐션
- 첫 방문 소스별 리텐션 (네이버 vs 구글 vs 카톡 vs 직접)
- 첫 방문 페이지별 전환율 (블로그 vs 종목 vs 홈)
- Plus 전환 전환 퍼널 분석

### 14.3 A/B 테스트 우선순위

1. 히어로 캐러셀 유무 (전체 사이트 지표)
2. BlogReadGate 임계값 (3 / 5 / 7 / 무제한)
3. 종목 페이지 sticky CTA 위치
4. AI Q&A 버튼 배치 (플로팅 vs 종목 페이지 하단)
5. OG 디자인 CTR 비교 (design 2 vs 7 vs 9)
6. 푸시 구독 팝업 타이밍

### 14.4 관측 도구

- Vercel Analytics (기본)
- GA4 (이벤트 기반)
- Microsoft Clarity (히트맵·세션 리플레이) - 무료이면서 강력함
- Supabase Realtime (실시간 방문자 피드, 이미 FocusTab에 있음)

---

## 15. 리스크 & 미싱 피스

### 15.1 법적 리스크 (최중요)

- **유사투자자문업 미등록 상태에서 프리미엄 출시**: 큰 리스크. Plus 런칭 전 반드시 등록.
- **AI 생성 콘텐츠의 권유 표현**: 필터 누락 시 대량 위반.
- **애널리스트 리포트 무단 전재**: 저작권 침해. 요약·링크만 허용.
- **종목 토론방 명예훼손**: 유저 글 모니터링 + 신고 기능 필수.
- **허위 정보 유포**: 공시 오인·수급 오해석 시 법적 문제. 자동 생성 검수 프로세스 필요.

### 15.2 데이터 정확성

- KRX·DART API 장애 시 대체 소스 필요
- Finnhub·Polygon 데이터 오류 시 검증 로직
- XBRL 파싱 오류 발생 시 블로그 자동 발행 차단
- **모든 데이터 페이지에 "데이터 정확성 무보장" 문구**

### 15.3 AI 환각

- Sonnet 결과의 20~30%는 환각 가능성
- 실적 수치·공시 내용은 반드시 원본 데이터 기반으로만 생성 (RAG 강제)
- 생성 후 숫자 재검증 로직
- 환각 발견 시 유저 신고 → 자동 rollback

### 15.4 크론 장애

- 크론 하나 실패 시 다운스트림 전체 영향
- 모든 크론 재시도 3회
- Slack/Discord 알림 통합
- 크론 의존성 그래프 시각화 (`/admin/cron-dependency`)

### 15.5 경쟁사 대응

- 네이버금융이 AI 기능 추가하면? → 카더라는 "해석 깊이 + 커뮤니티"로 차별화
- 토스증권이 웹 강화하면? → 카더라는 "SEO + 콘텐츠 량" 우위
- **전제: 포털·증권사의 구조적 약점(개인화 불가, 혁신 속도 느림)은 지속될 것**

### 15.6 미싱 피스 (이 문서에서도 아직 못 다룬 것)

- **모바일 앱**: PWA로 당분간 커버하되, Phase 4 (6개월 후) 네이티브 앱 검토
- **음성 인터페이스**: "카더라, 삼성전자 어때?" 보이스 Q&A (Phase 4)
- **블록체인 자산 (크립토) 전면 커버**: 현재 "크립토 × 주식 상관"까지만 계획. 크립토 자체 허브는 별도 프로젝트.
- **비상장 기업**: 38커뮤니케이션 영역. 법적 이슈 있어 신중.
- **P2P 투자·사모펀드**: 현재 범위 밖. 규제 리스크 큼.

---

## 16. 12주 실행 로드맵 (4주 → 12주로 확장)

### Phase 1 (Week 1~2): 법적·데이터 인프라

- [ ] 자본시장법 검토 + 표준 disclaimer 컴포넌트
- [ ] `sanitizeAiContent` 필터 미들웨어
- [ ] Finnhub API 구독 + 연동
- [ ] KIS Developers 계좌 개설 신청
- [ ] 신규 DB 스키마 마이그레이션 (20+ 테이블)
- [ ] 유사투자자문업 등록 여부 검토 → 필요 시 서류 준비

### Phase 2 (Week 3~4): 해외주식 야간 지배 (ROI 최고)

- [ ] 심야 크론 10종 (us-premarket, opening-bell, midday, closing, aftermarket, recap)
- [ ] 텔레그램 봇 구축 (`@kadeora_bot`)
- [ ] Solapi 야간 푸시 연동
- [ ] 해외주식 상세 페이지 Hero 리디자인
- [ ] OG design=9 (차트 카드) 구현
- [ ] 히어로 캐러셀 (/stock 상단)

### Phase 3 (Week 5~6): 국내 수급·공매도 인텔리전스

- [ ] KRX 수급 데이터 일일 수집 크론
- [ ] 공매도·대차잔고 수집
- [ ] flow signal 엔진 (10개 시그널 레시피)
- [ ] `/stock/signals/*` 랜딩 페이지 10종
- [ ] `/stock/short-selling` 대시보드
- [ ] 수급 시그널 블로그 자동 생성

### Phase 4 (Week 7~8): DART 공시 파이프라인 + 실적 시즌

- [ ] DART API 연동 + 공시 수집 크론
- [ ] 공시 AI 분류·요약 파이프라인
- [ ] `/stock/disclosures` 허브
- [ ] 실적 발표 감지 + 5분 내 한국어 요약
- [ ] 애널리스트 컨센서스 수집
- [ ] `earnings-krx-realtime` 크론

### Phase 5 (Week 9~10): AI 네이티브 + 개인화

- [ ] 종목 Q&A 챗봇 (각 종목 페이지)
- [ ] "오늘 왜 올랐지?" 버튼
- [ ] 개인화 일일 브리핑 (카톡 + 이메일)
- [ ] IR 유튜브 자막 DB 시작 (MAG7)
- [ ] 컨퍼런스콜 한글 요약 파이프라인

### Phase 6 (Week 11~12): 노출면적 폭발 + 수익화

- [ ] OG design 7~12 전체 구현
- [ ] 동적 차트 이미지 API
- [ ] Remotion 쇼츠 영상 파이프라인
- [ ] YouTube Shorts + 네이버 클립 자동 업로드
- [ ] 프로그래매틱 SEO 1차 (배당 페이지 3,640개, 실적 페이지 14,560개)
- [ ] 사이트맵 분할
- [ ] Plus 티어 출시 준비 (유사투자자문업 등록 완료 시)

### Phase 7+ (Week 13 이후): 확장

- XBRL 재무제표 자체 DB 구축
- 옵션 플로우 (Polygon.io)
- 자체 지수 5종 출시
- 네이버 프리미엄콘텐츠 입점
- 모바일 네이티브 앱 기획

---

## 17. 즉시 착수 권장 우선순위 (Week 1 상세)

Node가 이 문서를 읽고 바로 착수할 수 있는 Top 5:

### 1순위: `sanitizeAiContent` 필터 + 표준 disclaimer 컴포넌트
- 모든 AI 크론에 즉시 적용 가능
- 법적 리스크 즉시 감소
- 공수: 2~4시간

### 2순위: Finnhub 구독 + 심야 크론 3종 (us-opening-bell, us-closing-recap, us-preview)
- 체감 가장 큼 (서학개미 야간 유입)
- 텔레그램 봇은 Phase 2에서
- 공수: 1~2일

### 3순위: DART Open API 연동 + 공시 수집 크론
- 한국 독점 데이터 자원 확보 시작
- Sonnet 요약은 Phase 2에서
- 공수: 1일

### 4순위: 히어로 캐러셀 (/stock 상단)
- 노출면적 즉각 확장
- 기존 OG 시스템 재활용
- 공수: 1일

### 5순위: `stock_hero_slides` 테이블 + 크론으로 일일 자동 갱신
- 4순위와 함께
- 공수: 0.5일

---

## 18. 끝내며 — 이 설계의 핵심 통찰

이 문서를 관통하는 핵심은 **"카더라만의 해자 4가지"** 다:

1. **한국어 독점 콘텐츠**: 해외주식 컨콜 한글화, 10-K 한글 파싱, IR 자막 DB
2. **AI × 개인화**: 포털이 영원히 못 하는 영역
3. **커뮤니티 해자**: 수급 인증 + 포트폴리오 공개 + 투자 일지
4. **자동화 규모**: 프로그래매틱 SEO 2만~5만 페이지 + 일 50+ 자동 블로그

그리고 이 모든 것의 **전제 조건**은:

- ⚖️ 자본시장법 컴플라이언스 (disclaimer + 필터)
- 💾 데이터 인프라 (KRX + DART + Finnhub + SEC EDGAR)
- 🤖 AI 안전장치 (환각 방지 + 권유 표현 차단)
- 📏 측정 가능한 지표 (WAU, 세션당 PV, 네이버 View 진입)

한 번에 다 할 수 없다. 하지만 위 **12주 로드맵**을 따라가면 3개월 뒤 카더라는 **네이버 주식 검색에서 3~5개 상위 키워드 장악 + 서학개미 야간 1번지**로 자리매김할 수 있다.

이 문서는 살아있는 문서다. `docs/STATUS.md`와 병행하여 매 세션마다 참조·업데이트한다.

---

**문서 히스토리**
- 2026-04-16: 초안 작성 (Claude × Node)
