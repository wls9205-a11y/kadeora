#!/usr/bin/env node
/**
 * PWABuilder API를 통한 iOS 패키지 생성
 * 사용법: node scripts/generate-ios-package.js
 */

const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🍎 카더라 iOS 패키지 생성 중...\n');

  const payload = {
    url: 'https://kadeora.app',
    name: '카더라',
    packageId: 'app.kadeora',
    imageUrl: 'https://kadeora.app/icons/icon-512.png',
    splashColor: '#0d1117',
    progressBarColor: '#FF4500',
    statusBarColor: '#FF4500',
    permitted_urls: [],
    manifestUrl: 'https://kadeora.app/manifest.json',
  };

  console.log('1. PWABuilder API 호출...');
  try {
    const res = await fetch('https://pwabuilder-ios.azurewebsites.net/packages/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`API 오류 (${res.status}): ${text}`);
      console.log('\n대안: https://www.pwabuilder.com 에서 직접 패키지 생성');
      process.exit(1);
    }

    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/zip') || contentType.includes('octet-stream')) {
      const buffer = Buffer.from(await res.arrayBuffer());
      const outPath = path.join(__dirname, '..', 'ios-build', 'kadeora-ios.zip');
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, buffer);
      console.log(`2. iOS 패키지 저장: ${outPath}`);
      console.log('\n다음 단계:');
      console.log('  1. zip 파일 압축 해제');
      console.log('  2. Mac에서 Xcode로 열기');
      console.log('  3. Team 설정 (Apple Developer 계정)');
      console.log('  4. Archive → App Store Connect 업로드');
    } else {
      const data = await res.json();
      console.log('API 응답:', JSON.stringify(data, null, 2));
      if (data.uri) {
        console.log(`\n다운로드: ${data.uri}`);
      }
    }
  } catch (err) {
    console.error('오류:', err.message);
    console.log('\n대안 방법:');
    console.log('  1. https://www.pwabuilder.com 접속');
    console.log('  2. URL: https://kadeora.app 입력');
    console.log('  3. Package for stores → iOS 선택');
    console.log('  4. ZIP 다운로드');
  }
}

main();
