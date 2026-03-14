# 카더라 (KADEORA) 🐵

> 주식/부동산에 관심 있는 위치 기반 소리소문 커뮤니티

## 🚀 배포 정보

| 항목 | 정보 |
|------|------|
| **서비스 URL** | https://kadeora.vercel.app |
| **GitHub** | https://github.com/wls9205-a11y/kadeora |
| **Supabase** | tezftxakuwhsclarprlz (ap-northeast-2, 서울) |

## 🛠 기술 스택

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + CSS Variables
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth (Kakao, Google, Phone)
- **State**: Zustand + TanStack Query
- **Deployment**: Vercel

## 📦 설치 및 실행

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env.local
# .env.local 파일 편집하여 실제 값 입력

# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 프로덕션 실행
npm start
```

## 🔑 환경변수

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=https://kadeora.vercel.app
CRON_SECRET=your-cron-secret
```

## 📁 프로젝트 구조

```
kadeora/
├── public/
│   ├── manifest.json      # PWA 매니페스트
│   └── icon.svg           # 앱 아이콘
├── src/
│   ├── app/
│   │   ├── (auth)/        # 인증 관련 페이지
│   │   ├── (main)/        # 메인 앱 페이지
│   │   │   ├── feed/      # 홈 피드
│   │   │   ├── stocks/    # 주식
│   │   │   ├── housing/   # 부동산
│   │   │   ├── discuss/   # 토론방
│   │   │   ├── profile/   # 프로필
│   │   │   ├── shop/      # 상점
│   │   │   └── ...
│   │   ├── api/           # API 라우트
│   │   └── layout.tsx     # 루트 레이아웃
│   ├── components/
│   │   ├── features/      # 기능 컴포넌트
│   │   ├── layout/        # 레이아웃 컴포넌트
│   │   ├── providers/     # Context Providers
│   │   └── ui/            # UI 컴포넌트
│   ├── hooks/             # 커스텀 훅
│   ├── lib/               # 라이브러리, 유틸리티
│   ├── stores/            # Zustand 스토어
│   └── types/             # TypeScript 타입
├── package.json
├── tailwind.config.ts
└── next.config.ts
```

## ✨ 주요 기능

### 커뮤니티
- 📝 게시글 작성/수정/삭제
- 💬 댓글 및 대댓글
- ❤️ 좋아요 및 북마크
- 🔒 익명 글쓰기

### 주식/부동산
- 📈 실시간 주식 시세 (KOSPI/KOSDAQ)
- 🏠 청약 일정 정보
- 💬 종목별/단지별 실시간 토론방

### 소셜
- 👤 프로필 및 등급 시스템 (10단계)
- 👥 팔로우/팔로워
- 🔔 알림 시스템
- 📍 지역 기반 필터링

### 수익화
- 💎 포인트 시스템
- 📢 확성기 (게시글 홍보)
- 👑 프리미엄 멤버십
- 🛒 상점

## 🎨 디자인 시스템

### 색상
- **Brand**: `#FF4B36` (주황-빨강)
- **Bull**: `#E8341F` (상승)
- **Bear**: `#2563EB` (하락)
- **Background**: `#0A0A0A` (다크) / `#F2F2F7` (라이트)

### 등급 시스템
1. 🪨 씨앗 (0+)
2. 🌱 새싹 (100+)
3. 🌿 줄기 (300+)
4. 🌸 꽃봉오리 (700+)
5. 🌺 개화 (1,500+)
6. 🍊 열매 (3,000+)
7. 🔥 불꽃 (5,000+)
8. 💎 다이아 (8,000+)
9. 🌌 성좌 (12,000+)
10. 👑 전설 (20,000+)

## 📋 배포 체크리스트

### Vercel
- [x] 프로젝트 연결
- [x] 환경변수 설정
- [x] 자동 배포 설정

### Supabase
- [x] 프로젝트 생성 (서울 리전)
- [x] 데이터베이스 마이그레이션
- [ ] Storage 버킷 생성 (`images`)
- [ ] Auth URL 설정

### 추가 설정 필요
- [ ] 카카오 로그인 설정 (developers.kakao.com)
- [ ] Toss Payments 연동 (실결제)
- [ ] 커스텀 도메인 연결

## 📄 라이선스

MIT License

---

*카더라 - 동네 소문의 중심* 🐵
