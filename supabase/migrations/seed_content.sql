-- 시드 유저 게시글 soft delete
UPDATE posts SET is_deleted = true
WHERE author_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
);

-- 2026년 3월 핫이슈 컨텐츠 (실제 유저 ID 사용)
INSERT INTO posts (author_id, category, title, content, likes_count, view_count, created_at, is_deleted, hashtags) VALUES
('265d8c3b-bd40-40c1-b7d2-bdde16a88204', 'stock', '삼성전자 HBM4 수율 개선 내부 소식 카더라', '카더라로 들어온 소식인데 삼성전자 HBM4 수율이 최근 급격히 개선됐다고 함. 기존 60%대에서 80%대로 올라갔다는 얘기. 엔비디아 H200 납품 일정도 앞당겨질 수 있다는 소문.', 47, 3200, NOW() - interval '2 hours', false, ARRAY['삼성전자','HBM4','반도체']),
('6e215791-e908-4651-a951-3d1fd90fa0d1', 'stock', 'SK하이닉스 HBM3E 올해 물량 다 팔렸다는 얘기', 'AI 반도체 수요로 HBM 공급이 극도로 타이트. SK하이닉스 HBM3E 올해 물량이 거의 다 팔렸다고 함. 엔비디아 H200 수요도 예상 초과래.', 88, 5700, NOW() - interval '8 hours', false, ARRAY['SK하이닉스','HBM','AI반도체']),
('f761ff84-7a69-4a13-b52e-5192a2bbe1a3', 'stock', '코스피 3000 돌파 가능성 — 개인적 분석', '외국인 순매수 5거래일 연속. 환율도 1350원대 안정. 반도체 업종이 실적 개선되면서 지수 견인하는 그림.', 124, 8100, NOW() - interval '8 hours', false, ARRAY['코스피','증시전망','외국인매수']),
('a01c798d-2883-49c7-b3c2-660b3c7ec356', 'stock', '엔비디아 실적발표 전 내부 소문 정리', '다음 주 실적발표 앞두고 정리. 1) 데이터센터 매출 서프라이즈 예상 2) 블랙웰 GPU 공급 차질 해소 중 3) 중국 규제 우회 칩 개발 불투명.', 394, 11200, NOW() - interval '1 day', false, ARRAY['엔비디아','NVDA','실적발표']),
('f761ff84-7a69-4a13-b52e-5192a2bbe1a3', 'apt', '강동구 둔촌주공 재건축 근황', '현장 직접 방문. 외벽 마감 거의 완료, 조경 진행 중. 입주 일정 계획대로. 분양가 대비 프리미엄 붙어있는 상황.', 183, 4800, NOW() - interval '2 hours', false, ARRAY['둔촌주공','강동구','재건축']),
('265d8c3b-bd40-40c1-b7d2-bdde16a88204', 'apt', '서울 청약 가점 40점대 어떤 아파트 노려야?', '무주택 7년, 부양가족 3명, 청약통장 10년. 47점인데 노원, 도봉, 중랑 정도 가능성 있을까요?', 121, 3500, NOW() - interval '12 hours', false, ARRAY['청약가점','서울청약']),
('b9dca4b5-c280-4c5f-8af8-84648723fe23', 'apt', '해운대 신축 아파트 시세 정리', '부산 해운대구 신축 3.3당 4500~5200만원. 센텀2지구 분양 앞두고 기대감에 주변 시세 소폭 상승 중.', 78, 3200, NOW() - interval '13 hours', false, ARRAY['해운대','부산아파트']),
('265d8c3b-bd40-40c1-b7d2-bdde16a88204', 'free', 'ETF 새내기인데 KODEX vs TIGER 뭐가 나은가요', '국내 대표 ETF인 KODEX와 TIGER 중 뭐 사야 할지. 미국 ETF도 SPY vs VOO vs QQQ 의견 구함.', 78, 4200, NOW() - interval '18 hours', false, ARRAY['ETF','투자초보']),
('6e215791-e908-4651-a951-3d1fd90fa0d1', 'free', '카더라에서 처음 종목 분석 — 한미반도체', 'TC본더 글로벌 1위. HBM 패키징 핵심 장비. 최근 실적 사상 최대. 엔비디아 직납 가능성 소문도.', 112, 6800, NOW() - interval '1 day', false, ARRAY['한미반도체','반도체장비']),
('a01c798d-2883-49c7-b3c2-660b3c7ec356', 'free', '월급날 주식 정액 매수 6개월 결과', '매달 코스피200 ETF 50만원씩 6개월. 수익률 +8.3%. 타이밍 스트레스 없어서 편함. 10년 가져갈 생각.', 87, 4700, NOW() - interval '3 days', false, ARRAY['적립식투자','ETF'])
ON CONFLICT DO NOTHING;
