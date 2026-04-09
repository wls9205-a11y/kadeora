-- ============================================================
-- 카더라 이슈 선점 자동화 — 통합 마이그레이션
-- Supabase SQL Editor에서 실행
-- ============================================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. issue_alerts 테이블
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS issue_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  category TEXT NOT NULL,
  sub_category TEXT,
  issue_type TEXT,
  lifecycle_stage TEXT DEFAULT 'detected',
  parent_issue_id UUID REFERENCES issue_alerts(id),
  source_type TEXT NOT NULL,
  source_urls TEXT[] DEFAULT '{}',
  detected_keywords TEXT[] DEFAULT '{}',
  related_entities TEXT[] DEFAULT '{}',
  raw_data JSONB DEFAULT '{}',
  base_score INTEGER DEFAULT 0,
  multiplier NUMERIC(3,2) DEFAULT 1.00,
  penalty_rate NUMERIC(3,2) DEFAULT 0.00,
  final_score INTEGER DEFAULT 0,
  score_breakdown JSONB DEFAULT '{}',
  competition_score INTEGER DEFAULT 0,
  is_processed BOOLEAN DEFAULT false,
  is_auto_publish BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT false,
  publish_decision TEXT,
  block_reason TEXT,
  fact_check_passed BOOLEAN,
  fact_check_details JSONB,
  blog_post_id UUID,
  feed_post_id UUID,
  draft_title TEXT,
  draft_content TEXT,
  draft_slug TEXT,
  draft_keywords TEXT[] DEFAULT '{}',
  draft_template TEXT,
  post_24h_views INTEGER DEFAULT 0,
  post_7d_views INTEGER DEFAULT 0,
  post_signup_count INTEGER DEFAULT 0,
  effectiveness_score NUMERIC(5,2),
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issue_score ON issue_alerts (final_score DESC);
CREATE INDEX IF NOT EXISTS idx_issue_unprocessed ON issue_alerts (is_processed, final_score DESC) WHERE is_processed = false;
CREATE INDEX IF NOT EXISTS idx_issue_category ON issue_alerts (category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_entities ON issue_alerts USING GIN (related_entities);
CREATE INDEX IF NOT EXISTS idx_issue_lifecycle ON issue_alerts (lifecycle_stage, related_entities) WHERE lifecycle_stage != 'closed';
CREATE INDEX IF NOT EXISTS idx_issue_parent ON issue_alerts (parent_issue_id) WHERE parent_issue_id IS NOT NULL;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. scheduled_feed_posts 테이블 (뻘글 예약 발행용)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS scheduled_feed_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID REFERENCES issue_alerts(id),
  persona_type TEXT NOT NULL,
  persona_user_id UUID,
  scheduled_at TIMESTAMPTZ NOT NULL,
  is_published BOOLEAN DEFAULT false,
  published_post_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_feed_pending ON scheduled_feed_posts (scheduled_at) WHERE is_published = false;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. blog_publish_config 킬스위치 컬럼 추가
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE blog_publish_config ADD COLUMN IF NOT EXISTS auto_publish_enabled BOOLEAN DEFAULT true;
ALTER TABLE blog_publish_config ADD COLUMN IF NOT EXISTS auto_publish_min_score INTEGER DEFAULT 60;
ALTER TABLE blog_publish_config ADD COLUMN IF NOT EXISTS auto_publish_blocked_categories TEXT[] DEFAULT '{}';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. 레이카운티 메인 기사 즉시 발행
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSERT INTO blog_posts (
  slug, title, content, excerpt, category, sub_category,
  tags, source_type, cron_type, source_ref,
  meta_description, meta_keywords,
  author_name, author_role,
  is_published, published_at, created_at
) VALUES (
  '레이카운티-무순위-청약-재분양-총정리-2026',
  '레이카운티 무순위 청약 재분양 총정리|3세대 분양가·자격조건·시세차익·일정 (2026)',
  E'부산 연제구 레이카운티에서 부정청약으로 계약 해지된 3세대가 **2020년 최초 분양가 그대로** 재분양됩니다. 현재 시세 대비 **최대 5억 원**의 차익이 기대되면서 부산 부동산 시장에서 가장 뜨거운 화제입니다.\n\n이 글에서는 재분양 배경부터 대상 세대 상세, 자격조건, 예상 일정, 자금조달 시나리오까지 빠짐없이 정리합니다.\n\n## 왜 3세대가 다시 나오는 건가요?\n\n2020년 9월 레이카운티 최초 분양 당시, **평균 경쟁률 120.6대 1**이라는 부산 역대 최대 기록을 세우며 **19만 개**의 청약통장이 몰렸습니다. 동시에 부정청약도 역대 최다인 390명이 적발되었는데, 이 중 소명 절차를 거쳐 최종 부정청약으로 확정된 3세대의 계약이 해지되었습니다.\n\n거제2구역 조합은 주택법에 따라 이 3세대를 **불법행위재공급(계약취소주택 재공급)** 방식으로 다시 분양합니다. 핵심은 2020년 최초 분양가가 그대로 적용된다는 점입니다.\n\n## 재분양 대상 3세대 상세\n\n| 구분 | 단지 | 타입 | 층수 | 분양가(옵션 포함) | 현재 추정 시세 | 예상 차익 |\n|------|------|------|------|-------------------|---------------|----------|\n| 1호 | 1단지 | 84㎡A | 4층 | 약 6.7억 | 약 11～12억 | **최대 약 5억** |\n| 2호 | 3단지 | 84㎡A | 13층 | 약 6.0～6.7억 | 약 9～10억 | **최대 약 3억** |\n| 3호 | 3단지 | 84㎡B | 6층 | 약 6.0～6.7억 | 약 9～10억 | **최대 약 3억** |\n\n정확한 분양가는 분양공고 시 확정됩니다. 위 금액은 부산일보 보도 기준 옵션 포함 6억 773만～6억 7,055만 원 범위입니다.\n\n## 불법행위재공급이란?\n\n흔히 줍줍 또는 무순위 청약이라 통칭하지만, 정확히는 3가지 종류가 있습니다.\n\n**무순위 사후접수**는 미계약이나 부적격으로 남은 잔여세대를 대상으로 하며, 전국 누구나 신청 가능하고 재당첨 제한이 없습니다.\n\n**임의공급**은 미분양 물량으로 조건이 가장 느슨합니다.\n\n**불법행위재공급(계약취소주택 재공급)**은 불법전매나 부정청약 등으로 강제 취소된 물량으로, 조건이 가장 까다롭습니다.\n\n이번 레이카운티는 부정청약 적발에 의한 계약 해지이므로 **불법행위재공급**에 해당합니다.\n\n## 자격조건 — 나도 신청할 수 있을까?\n\n불법행위재공급은 일반 무순위보다 조건이 엄격합니다.\n\n**필수 조건:**\n- 부산광역시 거주자 (주민등록 기준)\n- 무주택 세대주 (세대 구성원 전원 무주택)\n- 청약통장 필요 없음\n- 100% 추첨제 (가점 무관)\n\n**주의할 제한사항:**\n- 재당첨 제한 적용 (약 10년)\n- 과거 공급질서 교란행위로 청약 제한 중인 자 불가\n- 해외 체류 3개월 초과자 불가\n\n**자격 셀프 체크:**\n1. 현재 부산에 주민등록이 되어 있나요?\n2. 본인 명의 주택(분양권·입주권 포함)이 없나요?\n3. 세대원 전원이 무주택인가요?\n4. 세대주인가요?\n5. 향후 10년간 다른 청약 당첨 제한을 감수할 수 있나요?\n\n위 5가지가 모두 Yes라면 자격이 됩니다.\n\n## 예상 일정\n\n거제2구역 조합은 대행업체 선정을 완료했고, 한국부동산원 및 연제구청과 협의에 들어간 상태입니다.\n\n- **현재:** 대행업체 선정 완료, 관계기관 협의 중\n- **이르면 4월 중 / 늦으면 5월 중:** 분양공고\n- **공고 후 약 1주:** 청약 접수 (청약홈 온라인)\n- **접수 후 약 2～3일:** 당첨자 발표\n- **발표 후 약 1주:** 서류접수 및 계약 체결\n\n청약 접수는 한국부동산원 [청약홈](https://www.applyhome.co.kr)에서 진행되며, **불법행위재공급** 카테고리에서 확인할 수 있습니다.\n\n## 당첨되면 돈은 얼마나 필요한가?\n\n레이카운티는 이미 2023년 11월 입주가 완료된 단지입니다. 따라서 **중도금 없이 계약금 + 잔금** 구조입니다.\n\n**시나리오 (분양가 6.5억 기준):**\n- 계약금 (10%): 약 6,500만 원 — 계약 시 즉시 납부\n- 잔금 (90%): 약 5억 8,500만 원 — 입주지정기간 내 납부\n\n**대출 활용 시 (부산 = 비규제지역):**\n- LTV 70% 적용 가능: 약 4억 5,500만 원 대출 가능\n- 필요 자기자금: 약 1억 9,500만 원 + 계약금 6,500만 원 = 약 2억 6,000만 원\n\n**전세 레버리지 (입주 후):**\n- 현재 레이카운티 84㎡ 전세 시세 약 4～5억\n- 전세 세팅 후 실질 투자금 대폭 감소 가능\n\n실제 대출 조건은 개인 소득과 DSR에 따라 다릅니다. 반드시 사전에 은행 상담을 받으세요.\n\n## 영등포자이 디그니티 사례 — 이번엔 얼마나 몰릴까?\n\n지난 3월 서울 영등포구 영등포자이 디그니티도 불법행위재공급 2세대와 무순위 1세대를 진행했습니다. 59㎡ 1세대에 **13만 938명**이 몰리며 경쟁률 13만 대 1을 기록했고, 시세차익은 최대 8～9억이었습니다.\n\n레이카운티는 시세차익이 3～5억으로 영등포자이보다는 적지만, 부산 거주 무주택 세대주로 대상이 한정되므로 실제 경쟁률은 더 낮을 수 있습니다. 다만 부산 역대급 인기 단지인 만큼 **수만 명 이상의 신청**이 예상됩니다.\n\n## 레이카운티는 어떤 단지인가?\n\n부산 연제구 거제동에 위치한 4,470세대 부산 최대급 대단지입니다. 래미안(삼성물산), 이편한세상(대림), 아이파크(HDC현대산업개발) 3사가 시공했으며, 단지명 REI는 세 브랜드의 머릿글자를 조합한 것입니다.\n\n지하철 3호선 종합운동장역 도보 2분 역세권이며, 부산시청과 법조단지, 사직동 학원가가 인접해 학부모 선호도가 높은 지역입니다. 수영장, 골프장, 사우나, 도서관 등 커뮤니티 시설을 갖추고 있으며, 2023년 11월 입주 완료 후 현재 입주 2년차로 거제동 102개 단지 중 시가총액 1위를 기록하고 있습니다.\n\n최근 1년간 시세가 평균 4.61% 상승했고, 특히 22A평형은 연간 13.66% 올라 부산 내륙 대장 단지로 자리잡고 있습니다.\n\n## 자주 묻는 질문\n\n**Q. 청약통장이 없어도 되나요?**\n\nA. 네, 불법행위재공급은 청약통장이 필요 없습니다. 100% 추첨입니다.\n\n**Q. 부부가 각각 신청할 수 있나요?**\n\nA. 세대주만 신청 가능하므로, 한 세대에서 1명만 가능합니다. 단, 부부가 세대를 분리한 경우 각각 가능할 수 있으나 무주택 세대주 요건을 모두 충족해야 합니다.\n\n**Q. 1주택자도 기존 주택 처분 조건으로 가능한가요?**\n\nA. 아닙니다. 불법행위재공급은 세대원 전원 무주택이 필수입니다. 처분조건부 1주택자도 불가합니다.\n\n**Q. 당첨 후 바로 팔 수 있나요?**\n\nA. 전매제한이 적용됩니다. 불법행위재공급은 재공급 기준으로 전매제한 기간이 새로 시작됩니다. 부산은 비규제지역이므로 전매제한 기간이 짧을 수 있으나, 정확한 기간은 공고를 확인해야 합니다.\n\n**Q. 84㎡A와 84㎡B는 뭐가 다른가요?**\n\nA. A타입과 B타입은 내부 구조(방 배치, 주방 위치, 발코니 방향 등)가 다릅니다. 분양공고 시 평면도가 공개되면 상세 비교가 가능합니다.\n\n**Q. 공고는 어디서 확인하나요?**\n\nA. 한국부동산원 [청약홈](https://www.applyhome.co.kr) → 청약캘린더 → 부산 → 불법행위재공급 필터에서 확인하세요. 카더라에서도 공고 즉시 속보를 전해드립니다.\n\n**Q. 다른 지역 거주자는 절대 안 되나요?**\n\nA. 네, 불법행위재공급은 해당 주택건설지역(부산광역시) 거주자만 신청 가능합니다. 경남이나 울산 거주자도 불가합니다.',
  '부산 레이카운티 부정청약 취소분 3세대가 2020년 분양가로 재분양됩니다. 84㎡ 6억대에 최대 5억 시세차익 기대.',
  'apt', '청약',
  ARRAY['레이카운티','무순위청약','줍줍','부산청약','로또청약','불법행위재공급','연제구','거제동','부산부동산','재분양','시세차익','부산'],
  'manual', 'manual',
  'https://www.busan.com/view/busan/view.php?code=2026040918342996702',
  '부산 레이카운티 부정청약 취소분 3세대가 2020년 분양가로 재분양됩니다. 84㎡ 6억대에 최대 5억 시세차익, 자격조건·일정·신청방법 완벽 정리.',
  '레이카운티,무순위청약,줍줍,부산청약,로또청약,불법행위재공급,연제구,거제동,부산부동산,재분양',
  '카더라 부동산팀', '에디터',
  true, NOW(), NOW()
) ON CONFLICT (slug) DO UPDATE SET content = EXCLUDED.content, meta_description = EXCLUDED.meta_description, updated_at = NOW();

-- 클러스터 기사
INSERT INTO blog_posts (
  slug, title, content, excerpt, category, sub_category,
  tags, source_type, meta_description, meta_keywords,
  author_name, author_role, is_published, published_at, created_at
) VALUES (
  '불법행위재공급-무순위-차이-총정리',
  '불법행위재공급 vs 무순위 청약 차이 총정리|줍줍 3종류 완벽 비교 (2026)',
  E'줍줍 청약에 관심이 있다면, 무순위 사후접수와 불법행위재공급의 차이를 정확히 알아야 합니다. 같은 줍줍이라 불리지만 자격조건과 제한사항이 완전히 다르기 때문입니다.\n\n## 줍줍 청약의 3가지 종류\n\n무순위 청약은 잔여세대가 발생한 이유에 따라 크게 3가지로 구분됩니다.\n\n**무순위 사후접수**는 정식 청약 후 미계약, 부적격 등으로 남은 잔여세대를 모집하는 방식입니다. 가장 조건이 느슨하며, 무주택자면 전국 어디서나 신청 가능합니다.\n\n**임의공급**은 미분양 아파트를 대상으로 하며, 3가지 중 조건이 가장 약합니다.\n\n**불법행위재공급(계약취소주택 재공급)**은 불법전매, 위장전입, 부정청약 등 공급질서 교란행위로 계약이 강제 취소된 물량을 다시 공급하는 것입니다.\n\n## 핵심 차이 비교표\n\n| 항목 | 무순위 사후접수 | 불법행위재공급 |\n|------|---------------|---------------|\n| 발생 사유 | 미계약·부적격 잔여 | 부정청약·불법전매 적발 |\n| 신청 자격 | 무주택자 (전국) | 해당 지역 무주택 세대주 |\n| 청약통장 | 불필요 | 불필요 |\n| 선정 방식 | 추첨 | 추첨 |\n| 재당첨 제한 | 없음 | 있음 (약 10년) |\n| 전매제한 기준 | 최초 분양 기준 | 재공급 기준 (새로 시작) |\n| 청약홈 표시 | 회색 | 검정색 |\n\n## 왜 불법행위재공급이 더 까다로운가?\n\n불법행위재공급은 공급질서를 교란한 사람의 물량을 회수해서 다시 공급하는 것이므로, 제도적으로 더 엄격한 조건을 적용합니다.\n\n첫째, **해당 주택건설지역 거주자만** 신청할 수 있습니다. 예를 들어 부산 레이카운티라면 부산광역시 거주자만 가능하고, 경남이나 울산 거주자는 불가합니다.\n\n둘째, **무주택 세대주**여야 합니다. 세대원이 아닌 세대주만 신청 가능하며, 세대 구성원 전원이 무주택이어야 합니다.\n\n셋째, **재당첨 제한**이 적용됩니다. 당첨되면 약 10년간 다른 청약에 당첨될 수 없습니다. 무순위 사후접수는 재당첨 제한이 없는 것과 큰 차이입니다.\n\n## 그런데도 왜 몰리는가?\n\n조건이 까다로운데도 불법행위재공급에 수만～수십만 명이 몰리는 이유는 단 하나, **시세차익**입니다.\n\n최초 분양가 그대로 공급되기 때문에, 시세가 크게 오른 단지의 경우 당첨만 되면 수억 원의 차익을 얻을 수 있습니다. 최근 사례를 보면 영등포자이 디그니티는 최대 8～9억, [레이카운티는 최대 5억](/blog/레이카운티-무순위-청약-재분양-총정리-2026)의 시세차익이 기대됩니다.\n\n10년 재당첨 제한을 감수하더라도 수억 원의 차익이면 충분히 매력적이라는 판단인 것입니다.\n\n## 실전 팁\n\n**1. 청약홈 알림 설정:** 불법행위재공급은 일정이 불규칙합니다. 청약홈 앱에서 알림을 설정해두세요.\n\n**2. 자격 사전 확인:** 무주택 여부, 세대주 여부를 미리 확인하세요. 당첨 후 부적격 판정되면 불이익이 큽니다.\n\n**3. 자금 계획 필수:** 이미 입주가 완료된 단지는 중도금 없이 잔금을 즉시 납부해야 합니다. 대출 가능 금액을 사전에 확인하세요.\n\n**4. 무순위와 동시 진행 가능:** 불법행위재공급과 무순위 사후접수가 동시에 나오는 경우가 있습니다. 각각 다른 카테고리이므로 별도로 신청해야 합니다.\n\n> 🏠 [카더라 청약 일정 확인](/apt) | [레이카운티 재분양 총정리](/blog/레이카운티-무순위-청약-재분양-총정리-2026)',
  '줍줍 청약 3가지 종류(무순위·임의공급·불법행위재공급) 차이를 비교표로 정리합니다.',
  'apt', '청약',
  ARRAY['무순위청약','불법행위재공급','줍줍','계약취소주택','청약제도','부산'],
  'manual',
  '줍줍 청약 3가지 종류(무순위·임의공급·불법행위재공급) 차이를 비교표와 실전 팁으로 완벽 정리합니다.',
  '무순위청약,불법행위재공급,줍줍,계약취소주택,청약제도,청약비교',
  '카더라 부동산팀', '에디터',
  true, NOW(), NOW()
) ON CONFLICT (slug) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW();
