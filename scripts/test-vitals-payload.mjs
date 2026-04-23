#!/usr/bin/env node
/**
 * 세션 151 — /api/web-vitals attribution 전송 테스트.
 * 배포 후 실행: node scripts/test-vitals-payload.mjs
 */
const payload = {
  page_path: '/test/vitals-session-151',
  metric_name: 'CLS',
  value: 0.123,
  rating: 'needs-improvement',
  device: 'desktop',
  cls_largest_shift_target: 'div.test-fixture',
  cls_largest_shift_value: 0.087,
};

const res = await fetch('https://kadeora.app/api/web-vitals', {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify(payload),
});
console.log('status:', res.status);
console.log('body:', await res.text());
console.log('\nSQL to verify:');
console.log(`  SELECT page_path, metric_name, value, cls_largest_shift_target, cls_largest_shift_value`);
console.log(`  FROM web_vitals`);
console.log(`  WHERE page_path = '/test/vitals-session-151'`);
console.log(`  ORDER BY created_at DESC LIMIT 1;`);
