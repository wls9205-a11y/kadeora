# 카더라 TWA (Trusted Web Activity) 빌드 가이드

## 사전 준비
- JDK 17+ 설치 (https://adoptium.net/)
- Node.js 18+

## 1. bubblewrap 설치
```bash
npm install -g @bubblewrap/cli
```

## 2. TWA 초기화
```bash
cd twa-build
bubblewrap init --manifest https://kadeora.app/manifest.json
```

### 초기화 중 입력 값:
| 항목 | 값 |
|------|-----|
| Package ID | app.kadeora.twa |
| App name | 카더라 |
| Launcher name | 카더라 |
| Display mode | standalone |
| Orientation | portrait |
| Theme color | #FF4500 |
| Background color | #0d1117 |
| Start URL | /feed |
| Icon URL | https://kadeora.app/icons/icon-512.png |
| Maskable icon | https://kadeora.app/icons/icon-512.png |
| App version | 1 |
| App version name | 1.0.0 |
| Key store path | ./android.keystore |
| Key store password | (본인 설정) |
| Key alias | kadeora |
| Key password | (본인 설정) |

## 3. APK 빌드
```bash
bubblewrap build
```

## 4. SHA256 지문 추출
```bash
keytool -list -v -keystore ./android.keystore -alias kadeora | grep "SHA256:"
```

## 5. assetlinks.json 업데이트
추출된 SHA256 값으로 `public/.well-known/assetlinks.json`의
`PLACEHOLDER_SHA256_REPLACE_AFTER_KEYSTORE_GENERATION` 부분 교체.

```bash
git add -A
git commit -m "fix: assetlinks.json SHA256 실제 키스토어 지문으로 교체"
git push
```

## 6. Play Console 업로드
1. play.google.com/console 접속
2. 앱 만들기 → "카더라" → 앱 유형: 앱 → 무료
3. 내부 테스트 트랙에 `app-release-signed.apk` 업로드
4. Play Console > 앱 서명에서 SHA256 지문 확인
5. assetlinks.json에 Play Console SHA256도 추가 (2개 필요할 수 있음)

## 중요 파일 보관
- `android.keystore` — **절대 분실 금지!** 앱 업데이트 시 반드시 필요
- `twa-manifest.json` — TWA 설정 파일
