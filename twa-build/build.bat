@echo off
echo === 카더라 TWA 빌드 스크립트 ===
echo.

echo [1/4] bubblewrap 초기화...
bubblewrap init --manifest https://kadeora.app/manifest.json
if %errorlevel% neq 0 (
    echo 초기화 실패. JDK 17이 설치되어 있는지 확인하세요.
    pause
    exit /b 1
)

echo.
echo [2/4] APK 빌드...
bubblewrap build
if %errorlevel% neq 0 (
    echo 빌드 실패.
    pause
    exit /b 1
)

echo.
echo [3/4] SHA256 지문 추출...
keytool -list -v -keystore ./android.keystore -alias kadeora | findstr "SHA256:"

echo.
echo [4/4] 빌드 완료!
echo app-release-signed.apk 파일을 Play Console에 업로드하세요.
echo android.keystore 파일은 반드시 안전하게 보관하세요!
echo.
pause
