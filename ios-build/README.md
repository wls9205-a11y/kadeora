# 카더라 iOS App Store 제출 가이드

## 방법 1: PWABuilder (추천 — Xcode 최소 사용)

### 사전 준비
- Apple Developer 계정 ($99/년): https://developer.apple.com/programs/
- macOS + Xcode 15+ (Mac 필요)

### 단계

1. **PWABuilder 접속**: https://www.pwabuilder.com
2. URL 입력: `https://kadeora.app`
3. "Package for stores" 클릭
4. **iOS** 선택 → 아래 정보 입력:
   - Bundle ID: `app.kadeora`
   - App Name: `카더라`
   - URL: `https://kadeora.app/feed`
5. ZIP 다운로드 → Mac에서 압축 해제
6. Xcode에서 프로젝트 열기
7. Team 설정 (Apple Developer 계정 연결)
8. Archive → App Store Connect 업로드

### App Store 메타데이터
- 앱 이름: 카더라 - 소리소문 커뮤니티
- 부제: 동네/주식/부동산 소식을 가장 빠르게
- 카테고리: 뉴스 (primary), 금융 (secondary)
- 연령 등급: 12+ (사용자 콘텐츠)
- 가격: 무료
- 설명: 아래 참고

### App Store 설명
```
카더라 - 대한민국 소리소문 정보 커뮤니티

아는 사람만 아는 그 정보, 카더라에서 가장 빠르게 확인하세요.

주요 기능:
- 피드: 주식, 부동산, 자유 주제 글을 읽고 공유
- 우리동네: 내 지역 소식만 모아보기 (17개 시/도)
- 주식 시세: 국내외 150개 종목 실시간 시세
- 부동산: 아파트 청약 일정 및 정보
- 토론방: 종목별/지역별 실시간 채팅
- HOT 랭킹: 이번 주 인기 글 TOP 5
- 등급 시스템: 활동으로 10단계 등급 달성
- 출석 체크: 매일 출석으로 포인트 획득

카더라, 소리소문의 시작.
```

### 스크린샷 필요 사이즈
- iPhone 6.7": 1290 x 2796 (필수)
- iPhone 6.5": 1284 x 2778
- iPhone 5.5": 1242 x 2208
- iPad 12.9": 2048 x 2732 (iPad 지원시)

## 방법 2: Capacitor (네이티브 기능 필요시)

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "카더라" "app.kadeora" --web-dir=out
npx cap add ios
npm run build && npx next export
npx cap sync ios
npx cap open ios  # Xcode에서 열림
```

## 중요 참고
- iOS PWA는 Push Notification이 iOS 16.4+에서만 지원됨
- Safari WebView 기반이라 일부 Web API 제한 있음
- App Review 심사 시 "웹뷰 래퍼" 거절 가능성 있음
  → 최소 1개 네이티브 기능 추가 권장 (예: 위젯, 알림 등)
