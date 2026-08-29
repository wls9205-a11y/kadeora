# 게이트 기준선

## `token-baseline.txt` — 토큰 계산값 기준선 (6폭 × 5모드)

```
npx tsx scripts/token-snapshot.ts https://kadeora.app \
  | grep -v -- "--tw-" \
  | grep -E "\|--(sp|fs|radius|card-p|btn-h|touch-min|brand|text|bg|surface|border|kd|accent|stock|ink|c-)" \
  > docs/gates/token-baseline.txt
git diff --stat docs/gates/token-baseline.txt   # 토큰 무변경 커밋이면 «빈 diff»
```

## ⚠️ 왜 파일로 두는가 — 2026-08-30 실측

「배포 전 스냅샷 · 배포 후 스냅샷 · 둘을 diff」로 쓰고 있었는데, **배포 전 상태를
다시 뜰 방법이 없었다**. 이전 배포 URL 로 재현하려다 33,692줄짜리 diff 를 받았고,
그 정체는 **Vercel 로그인 화면의 CSS** 였다 — 프리뷰 URL 이 SSO 로 막혀 있어
자가 «다른 페이지» 를 재고 있었다.

> ⛔ **프리뷰 배포 URL 에 게이트를 걸지 않는다.** 보호 화면을 재고도 숫자는 나온다.
> 기준선은 저장소가 들고 있어야 커밋 사이에서 «되짚을» 수 있다.

## ⚠️ `--tw-*` 를 뺀 이유
Tailwind 런타임 변수는 유틸리티가 쓰이는 자리마다 값이 달라 «화면 구성» 을 따라
흔들린다. 토큰 회귀와 무관한 잡음이라 기준선에서 제외한다. DS 소유 토큰만 남긴다.
