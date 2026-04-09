# 푸시 알림 VAPID 키 설정 가이드

> push_subscriptions 0명 → VAPID 키 미설정이 원인

## 설정 방법

Vercel 대시보드 → Settings → Environment Variables에 추가:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BFKoabkIGvXRix4v3TGkcalfLRmvyPqVnwZIPmWZiNnC0AQwIDsppqEljVOSUiYKhlwlG3Llx-Fspknd8FjLNsM
VAPID_PRIVATE_KEY=2a-WFEwMB7JOUxPxeBNKi4ZNQV1nCxOAe5cn7yLbves
VAPID_SUBJECT=mailto:kadeora.app@gmail.com
```

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: 모든 환경 (Preview + Production)
- `VAPID_PRIVATE_KEY`: Production만
- `VAPID_SUBJECT`: Production만

설정 후 재배포 필요 (vercel.json 또는 코드 변경 커밋으로 트리거).

## 키 재생성

```bash
npx web-push generate-vapid-keys
```

## 확인 방법

1. 설정 후 kadeora.app 접속
2. 온보딩에서 "알림 허용" 클릭
3. Supabase: `SELECT COUNT(*) FROM push_subscriptions;` → 0보다 크면 성공

## 참고

- iOS Safari: PWA 설치 필수 (홈 화면 추가 후만 푸시 가능)
- Android Chrome: 별도 설치 없이 가능
- Desktop: 별도 설치 없이 가능
