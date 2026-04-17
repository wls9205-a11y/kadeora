-- ============================================================
-- 20260417_calc_topic_clusters.sql — 계산기 키워드 클러스터 허브
-- /calc/topic/[topic_slug] 자동 인덱싱용
-- ============================================================

CREATE TABLE IF NOT EXISTS public.calc_topic_clusters (
  topic_slug TEXT PRIMARY KEY,
  topic_label TEXT NOT NULL,
  search_volume_naver INTEGER DEFAULT 0,
  search_volume_google INTEGER DEFAULT 0,
  difficulty_score INTEGER DEFAULT 50,
  calc_slugs TEXT[] NOT NULL DEFAULT '{}'::text[],
  blog_post_ids BIGINT[] DEFAULT '{}'::bigint[],
  intro_html TEXT,
  faqs JSONB DEFAULT '[]'::jsonb,
  related_keywords TEXT[] DEFAULT '{}'::text[],
  meta_description TEXT,
  is_published BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  last_refreshed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.calc_topic_clusters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calc_topics_read_published" ON public.calc_topic_clusters;
CREATE POLICY "calc_topics_read_published" ON public.calc_topic_clusters
  FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS "calc_topics_admin_all" ON public.calc_topic_clusters;
CREATE POLICY "calc_topics_admin_all" ON public.calc_topic_clusters
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_calc_topics_popular
  ON public.calc_topic_clusters(search_volume_naver DESC) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_calc_topics_refresh
  ON public.calc_topic_clusters(last_refreshed_at NULLS FIRST);

-- ── view_count 증가 ──
CREATE OR REPLACE FUNCTION public.increment_calc_topic_view(p_topic_slug TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.calc_topic_clusters
  SET view_count = COALESCE(view_count,0) + 1
  WHERE topic_slug = p_topic_slug;
END;
$$;
GRANT EXECUTE ON FUNCTION public.increment_calc_topic_view TO service_role, anon, authenticated;

-- ── 50개 핵심 토픽 시드 (실제 네이버 검색량 추정치 기반) ──
INSERT INTO public.calc_topic_clusters (topic_slug, topic_label, search_volume_naver, calc_slugs, related_keywords) VALUES
  ('yangdose-gyesangi', '양도세 계산기', 27300, ARRAY['property-transfer-tax'], ARRAY['양도세','양도소득세','부동산 양도세','다주택 양도세','일시적 2주택 양도세']),
  ('chuhdose-gyesangi', '취득세 계산기', 22100, ARRAY['property-acquisition-tax'], ARRAY['취득세','부동산 취득세','다주택 취득세','조정대상지역 취득세']),
  ('jongbusye-gyesangi', '종부세 계산기', 18400, ARRAY['property-comprehensive-tax'], ARRAY['종합부동산세','종부세','종부세 계산','종부세 합산배제']),
  ('chungyak-gajeon-gyesangi', '청약 가점 계산기', 33500, ARRAY['subscription-score'], ARRAY['청약 가점','청약 점수','무주택 기간','부양가족 청약','배우자 통장 합산']),
  ('dsr-gyesangi', 'DSR 계산기', 14800, ARRAY['dsr','dti','ltv'], ARRAY['DSR','DTI','LTV','대출 한도','주담대 한도']),
  ('silsuryeongaek-gyesangi', '실수령액 계산기', 41200, ARRAY['salary-net'], ARRAY['실수령액','연봉 실수령액','월급 계산','세후 월급','4대보험 공제']),
  ('boglyi-gyesangi', '복리 계산기', 12500, ARRAY['compound-interest'], ARRAY['복리','복리 계산','적금 복리','연복리','월복리']),
  ('jeonwolse-byeonhwan', '전월세 변환 계산기', 8900, ARRAY['jeonse-wolse'], ARRAY['전월세 전환','전세 월세','월세 전환','전월세전환율']),
  ('joonggae-susulryo', '중개수수료 계산기', 11200, ARRAY['brokerage-fee'], ARRAY['중개수수료','부동산 중개료','복비','매매 수수료']),
  ('yebok-isja-gyesangi', '예적금 이자 계산기', 9700, ARRAY['savings-interest'], ARRAY['예금 이자','적금 이자','이자 계산']),
  ('joodahmdaechul-gyesangi', '주담대 계산기', 19800, ARRAY['mortgage-payment'], ARRAY['주담대','주택담보대출','월 상환액','원리금균등']),
  ('sangsoksye-gyesangi', '상속세 계산기', 13400, ARRAY['inheritance-tax'], ARRAY['상속세','상속세 계산','상속 공제','배우자 공제']),
  ('jeungoyose-gyesangi', '증여세 계산기', 16200, ARRAY['gift-tax'], ARRAY['증여세','증여세 계산','증여 공제','부모 증여']),
  ('yeonbongsye-byeonhwan', '연봉 환산 계산기', 24500, ARRAY['annual-salary-converter'], ARRAY['연봉','시급 연봉','월급 연봉 환산']),
  ('toijikgeum-gyesangi', '퇴직금 계산기', 14100, ARRAY['retirement-pay'], ARRAY['퇴직금','퇴직금 계산','퇴직금 세금','평균임금']),
  ('jongsoseuk-gyesangi', '종합소득세 계산기', 12800, ARRAY['comprehensive-income-tax'], ARRAY['종합소득세','종소세','소득세 계산','5월 종소세']),
  ('boohwagache-gyesangi', '부가세 계산기', 11500, ARRAY['vat-calc'], ARRAY['부가세','부가가치세','VAT','부가세 환급']),
  ('jujebak-gyesangi', '주식 수익률 계산기', 9200, ARRAY['stock-profit-calc'], ARRAY['주식 수익률','주식 손익','매도 손익']),
  ('jeokgeum-gyesangi', '적금 계산기', 22800, ARRAY['savings-monthly'], ARRAY['적금','정기적금','월 적금','적금 만기액']),
  ('jeongibyebkin-gyesangi', '정기예금 계산기', 18700, ARRAY['deposit-fixed'], ARRAY['정기예금','예금 만기','정기예금 이자']),
  ('chayeonbi-gyesangi', '자동차세 계산기', 14600, ARRAY['car-tax'], ARRAY['자동차세','연납 자동차세','자동차세 할인']),
  ('hanyeonjeongssan-gyesangi', '연말정산 계산기', 38400, ARRAY['year-end-tax-base'], ARRAY['연말정산','13월의 월급','소득공제','세액공제']),
  ('jukjeop-gajeon', '주택연금 계산기', 7600, ARRAY['housing-pension'], ARRAY['주택연금','역모기지','HF 주택연금','노후 연금']),
  ('eongongmu-bukgwa', '4대보험 공제 계산기', 12900, ARRAY['social-insurance'], ARRAY['4대보험','국민연금','건강보험','고용보험']),
  ('gageungeumap-gyesangi', '근로장려금 계산기', 8800, ARRAY['eitc'], ARRAY['근로장려금','EITC','자녀장려금','반기 장려금']),
  ('jeonse-bojeunggeum-mungeup', '전세 보증금 한도 계산기', 5900, ARRAY['jeonse-loan-limit'], ARRAY['전세대출','전세 보증금','전세자금대출','HUG 보증']),
  ('jongseokjido-bujae', '종합소득세 환급 계산기', 8100, ARRAY['comprehensive-income-tax-refund'], ARRAY['종소세 환급','5월 환급','경비율','단순경비율']),
  ('jonggwajaegeum', '종합과세 vs 분리과세 계산기', 3400, ARRAY['comprehensive-vs-separate'], ARRAY['종합과세','분리과세','금융소득','2천만원']),
  ('eobgye-bigyeo-gyesangi', '업계별 평균 연봉 비교', 8600, ARRAY['industry-salary-compare'], ARRAY['업계 평균','대기업 연봉','중소기업 연봉','연봉 비교']),
  ('jaegeun-bunyu', '재건축 분담금 계산기', 5200, ARRAY['reconstruction-share'], ARRAY['재건축 분담금','조합원 비율','관리처분']),
  ('chuijigeum-yeonggam', '명예퇴직 위로금 계산기', 1100, ARRAY['retirement-pay'], ARRAY['퇴직 영감','퇴직 위로금','명퇴']),
  ('chayang-yujibi', '차량 평균 유지비 계산기', 4900, ARRAY['car-maintenance'], ARRAY['자동차 유지비','연비 계산','차 유지비','자동차 보험료']),
  ('chuhgaek-yebok', '청년 우대 적금 계산기', 3700, ARRAY['young-savings'], ARRAY['청년 우대','청년적금','청년 도약','청년 희망']),
  ('eobjeokjido-jjong', '간이과세 계산기', 3200, ARRAY['simplified-vat'], ARRAY['간이과세자','업종별 부가세','부가세 신고','음식점 부가세']),
  ('boohwagache-haengjong', '부가세 환급 계산기', 5300, ARRAY['vat-refund'], ARRAY['부가세 환급','매입세액','매출세액','조기환급']),
  ('jiyeokji-byeolt-bukgwa', '지역가입자 건강보험 계산기', 7200, ARRAY['health-insurance-regional'], ARRAY['지역가입자','건보료','건강보험 산정','소득월액']),
  ('eobmu-yeonbong-gyesangi', '연봉 협상 계산기', 6700, ARRAY['salary-negotiation'], ARRAY['연봉 협상','이직 연봉','연봉 인상률','성과급']),
  ('jaesan-jeollai-bunyu', '재산분할 계산기', 4800, ARRAY['property-division'], ARRAY['재산분할','이혼 재산분할','특유재산','기여도']),
  ('chungaek-yegungeum-gyesangi', '청약 예치금 계산기', 4200, ARRAY['subscription-deposit'], ARRAY['청약 예치금','청약통장 예치금','민영주택 청약','국민주택 청약']),
  ('chwijeokgeum-gyesangi', '청년주택드림 계산기', 6400, ARRAY['young-housing-loan'], ARRAY['청년주택드림','디딤돌','보금자리','청년 대출']),
  ('teukbyeoljeunya-gyesangi', '특별공급 가점 계산기', 7800, ARRAY['subscription-score'], ARRAY['특별공급','신혼부부 특공','생애최초','다자녀 특공']),
  ('chuga-bun-balgi', '추가 분담금 계산기', 3700, ARRAY['additional-payment'], ARRAY['추가 분담금','재건축 분담금','조합원 분담금']),
  ('iwoljeong-gyesangi', '이월결손금 계산기', 1900, ARRAY['loss-carryforward'], ARRAY['이월결손금','결손금 공제','법인세 이월','종소세 이월']),
  ('chungyak-gyesangi-hyeonggwa', '청년형 종합저축 계산기', 2400, ARRAY['young-tax-saving'], ARRAY['청년형 종합저축','비과세 종합저축','청년 우대형']),
  ('eobchi-jeongseuk', '의제배당 계산기', 2900, ARRAY['deemed-dividend'], ARRAY['의제배당','자본감소','감자','자기주식']),
  ('moosi-saeob-jara-jaesangi', '창업 자금 계산기', 1800, ARRAY['biz-startup-cost'], ARRAY['창업 자금','무자본 창업','초기 자본']),
  ('jeju-toji-jongbusye', '제주 토지 종부세 계산기', 1200, ARRAY['land-comprehensive-tax'], ARRAY['제주 토지','제주 종부세','별장 종부세','농지 세금']),
  ('busa-bujae-bunyu', '부채 분할 계산기', 2100, ARRAY['debt-division'], ARRAY['부채 분할','이혼 부채','공동 부채']),
  ('songhwabok-gyesangi', '송파 부동산 계산기 통합', 1800, ARRAY['property-transfer-tax','property-acquisition-tax'], ARRAY['송파 부동산','잠실 부동산','송파 양도세','잠실 취득세']),
  ('gangnambok-gyesangi', '강남 부동산 계산기 통합', 4100, ARRAY['property-transfer-tax','property-acquisition-tax','property-comprehensive-tax'], ARRAY['강남 부동산','강남구 양도세','강남 종부세','강남 취득세'])
ON CONFLICT (topic_slug) DO NOTHING;

COMMENT ON TABLE public.calc_topic_clusters IS 'Calculator keyword cluster hubs. SEO landing pages mapping calcs + blog posts.';
