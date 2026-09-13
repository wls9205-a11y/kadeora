-- batch-rewrite-submit 제출 보류 가드의 스위치(2026-09-13, 세션 A 임시 조치 · Node 확정 대기).
-- 코드는 값이 «정확히 true» 일 때만 제출한다. 행이 없어도 보류지만, 스위치가 어디 있는지
-- 보이도록 false 로 명시해 둔다. 재개: value 를 'true'::jsonb 로(배포 불필요).
INSERT INTO app_config (namespace, key, value)
VALUES ('llm', 'rewrite_submit_enabled', 'false'::jsonb)
ON CONFLICT (namespace, key) DO NOTHING;
