# 카더라 배포 가이드

## 1. 사전 준비

### 1.1 필요한 계정
- [Vercel](https://vercel.com) 계정
- [Supabase](https://supabase.com) 프로젝트 (✅ 완료)
- [Kakao Developers](https://developers.kakao.com) 앱
- [Toss Payments](https://developers.tosspayments.com) 계정 (결제 기능 사용 시)
- [공공데이터포털](https://www.data.go.kr) API 키 (청약 데이터)

---

## 2. Supabase 설정

### 2.1 OAuth 공급자 설정
Supabase 대시보드 → Authentication → Providers

**카카오**
1. Kakao Developers에서 앱 생성
2. 플랫폼 → Web → 사이트 도메인 등록: `https://your-domain.vercel.app`
3. Redirect URI: `https://tezftxakuwhsclarprlz.supabase.co/auth/v1/callback`
4. REST API 키를 Supabase Kakao Provider에 입력

**구글**
1. Google Cloud Console → OAuth 2.0 클라이언트
2. 승인된 리디렉션 URI: `https://tezftxakuwhsclarprlz.supabase.co/auth/v1/callback`

### 2.2 Storage 버킷 생성
Supabase 대시보드 → Storage → New Bucket
```
버킷명: images
Public: ✅ 체크
```

RLS 정책 추가 (SQL Editor):
```sql
-- 누구나 읽기 가능
CREATE POLICY "public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'images');

-- 로그인 유저만 업로드
CREATE POLICY "auth upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'images' AND auth.role() = 'authenticated'
  );

-- 본인 파일만 삭제
CREATE POLICY "owner delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[2]
  );
```

### 2.3 Leaked Password Protection 활성화
대시보드 → Authentication → Settings → Password Security
→ "Enable HaveIBeenPwned integration" 체크

---

## 3. Vercel 배포

### 3.1 GitHub 연결
```bash
git init
git add .
git commit -m "feat: Phase 1-4 complete"
git remote add origin https://github.com/your-username/kadeora.git
git push -u origin main
```

Vercel 대시보드 → New Project → GitHub 연결

### 3.2 환경변수 설정
Vercel 대시보드 → Settings → Environment Variables

```env
# Supabase (필수)
NEXT_PUBLIC_SUPABASE_URL=https://tezftxakuwhsclarprlz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# Site URL (프로덕션 도메인으로 변경)
NEXT_PUBLIC_SITE_URL=https://kadeora.com

# Cron 인증 (랜덤 문자열로 변경)
CRON_SECRET=your-very-secret-random-string-here

# 청약 API (공공데이터포털)
APT_API_KEY=your_apt_api_key

# 카카오 (선택)
NEXT_PUBLIC_KAKAO_JS_KEY=your_kakao_js_key

# Toss Payments (결제 사용 시)
NEXT_PUBLIC_TOSS_CLIENT_KEY=live_ck_...
TOSS_SECRET_KEY=live_sk_...
```

### 3.3 Vercel Cron 설정 확인
`vercel.json`에 이미 포함됨:
```json
{
  "crons": [
    { "path": "/api/stocks", "schedule": "0 9,12,15 * * 1-5" },
    { "path": "/api/housing", "schedule": "0 6 * * *" }
  ]
}
```

Cron 호출 시 헤더에 자동으로 `Authorization: Bearer CRON_SECRET` 포함됨
(Vercel Cron은 자체 `x-vercel-signature` 헤더도 사용 — 필요 시 검증 추가)

---

## 4. 도메인 연결

Vercel → Settings → Domains → Add Domain
`kadeora.com` 또는 원하는 도메인 추가 후 DNS 설정

---

## 5. Supabase Auth URL 업데이트

배포 후 Supabase 대시보드 → Authentication → URL Configuration
```
Site URL: https://kadeora.com
Redirect URLs:
  https://kadeora.com/auth/callback
  https://*.vercel.app/auth/callback  (프리뷰 배포용)
```

---

## 6. 배포 후 체크리스트

| 항목 | 확인 |
|------|------|
| 카카오 로그인 정상 작동 | □ |
| 구글 로그인 정상 작동 | □ |
| 게시글 작성 및 조회 | □ |
| 이미지 업로드 | □ |
| 실시간 채팅 (discussion_messages) | □ |
| 주식 시세 Cron 작동 | □ |
| 청약 데이터 Cron 작동 | □ |
| OG 이미지 생성 확인 (`/api/og?title=테스트`) | □ |
| sitemap.xml 접근 확인 | □ |

---

## 7. 성능 최적화 팁

```bash
# 번들 분석
npm install @next/bundle-analyzer
ANALYZE=true npm run build
```

- Supabase Realtime은 연결 수 제한 있음 (Free: 200 동시 연결)
- 이미지 최적화: `next/image` 사용 (이미 적용됨)
- 정적 페이지 캐싱: `revalidate` 옵션 활용
  ```ts
  export const revalidate = 60 // 1분 캐시
  ```
