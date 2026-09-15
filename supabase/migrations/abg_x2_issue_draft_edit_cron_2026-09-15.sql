-- ABG X-2 — issue-draft 편집 회차(?mode=edit). 생성 회차(vercel.json */10, :00·:10…)와 5분 어긋나게.
-- ⚠️ Vercel cron 슬롯 한도(100/100)라 pg_cron + _call_vercel_cron 경로(쿼리스트링 가능·290초).
select cron.schedule('issue-draft-edit', '5-59/10 * * * *', $$SELECT public._call_vercel_cron('/api/cron/issue-draft?mode=edit')$$);
