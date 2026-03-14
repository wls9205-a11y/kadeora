# 카더라 (KADEORA)

> 동네 소문의 중심 — 주식·청약·부동산 커뮤니티 앱

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_17-green)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://typescriptlang.org)

---

## 🚀 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 15 (App Router, Turbopack) |
| 스타일링 | Tailwind CSS |
| 백엔드 | Supabase (PostgreSQL 17, Realtime, Storage, Auth) |
| 상태 관리 | Zustand + TanStack Query |
| 결제 | Toss Payments |
| 배포 | Vercel |

---

## 📦 시작하기

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.local.example .env.local
# .env.local 파일을 열어 값 입력

# 3. 개발 서버 실행
npm run dev
```

브라우저에서 http://localhost:3000 접속

---

## 🗂 프로젝트 구조

```
src/
├── app/
│   ├── (auth)/          # 로그인, 온보딩
│   ├── (main)/          # 메인 앱 (피드, 주식, 청약, 토론, 프로필, 상점)
│   ├── api/             # API 라우트 (결제, 주식/청약 동기화, OG이미지)
│   ├── payment/         # Toss Payments 결과 페이지
│   └── search/          # 검색
├── components/
│   ├── features/        # 기능 컴포넌트 (PostCard, CommentSection 등)
│   ├── layout/          # TopBar, BottomNav
│   ├── providers/       # AuthProvider, QueryProvider
│   └── ui/              # 공통 UI (Skeleton 등)
├── hooks/               # useAuth, useTossPayment, useKakaoShare
├── lib/
│   ├── supabase/        # client, server, middleware
│   └── utils.ts         # 공통 유틸
├── stores/              # Zustand (authStore)
└── types/
    └── database.ts      # Supabase 타입 (27개 테이블)
```

---

## 🗄 데이터베이스

- **프로젝트 ID**: `tezftxakuwhsclarprlz`
- **리전**: ap-northeast-2 (서울)
- **총 테이블**: 27개 (모두 RLS 활성화)
- **마이그레이션**: 40개 (v4_performance_rls_optimization 포함)

주요 테이블: `profiles`, `posts`, `comments`, `discussion_messages`, `stock_quotes`, `apt_subscriptions`, `megaphones`, `shop_products`, `purchases`

---

## 🔑 주요 기능

- **피드**: 지역·카테고리 필터, Reddit 스타일 핫 정렬
- **주식**: KOSPI/KOSDAQ 시세, 종목별 토론
- **청약**: 공공데이터 API 연동, D-Day 카운트
- **실시간 채팅**: Supabase Realtime (discussion_messages)
- **수익화**: 포인트 시스템, 확성기, 게시글 고정, 프리미엄
- **결제**: Toss Payments (카드)
- **소셜 공유**: 카카오 SDK
- **SEO**: 동적 OG 이미지, sitemap.xml, robots.txt
- **PWA**: manifest.json, 앱 아이콘

---

## 🌐 배포

자세한 배포 가이드는 [DEPLOYMENT.md](./DEPLOYMENT.md) 참조

```bash
# 빌드 확인
npm run build

# 타입 체크
npm run type-check

# Vercel 배포
vercel --prod
```

---

## 📋 Phase 완료 현황

| Phase | 내용 | 상태 |
|-------|------|------|
| Phase 1 | DB 설계 (27테이블, 38마이그레이션) | ✅ |
| Phase 2 | Next.js 초기화, 인증, 피드, 핵심 페이지 | ✅ |
| Phase 3 | 상점, PWA, OG API, 데이터 동기화 API | ✅ |
| Phase 4 | Toss Payments, 카카오 공유, SEO, 배포 가이드 | ✅ |
| Phase 5 | DB 성능 최적화, 에러 처리, 최종 점검 | ✅ |
