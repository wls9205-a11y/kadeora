/**
 * .ait 파일 패키징 (zip 기반)
 * 구조:
 *   .granite/app.json
 *   web/index.html
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 1. 웹 빌드 먼저 실행
console.log('1. 웹 빌드...');
execSync('node build-web.js', { stdio: 'inherit' });

// 2. .ait 패키지 디렉토리 구성
const pkgDir = path.join(__dirname, '_ait_pkg');
if (fs.existsSync(pkgDir)) fs.rmSync(pkgDir, { recursive: true });
fs.mkdirSync(pkgDir, { recursive: true });

// .granite/app.json 복사
const graniteDir = path.join(pkgDir, '.granite');
fs.mkdirSync(graniteDir, { recursive: true });
fs.copyFileSync(
  path.join(__dirname, '.granite', 'app.json'),
  path.join(graniteDir, 'app.json')
);

// web/ 폴더 복사
const webSrc = path.join(__dirname, 'dist', 'web');
const webDst = path.join(pkgDir, 'web');
fs.mkdirSync(webDst, { recursive: true });
fs.readdirSync(webSrc).forEach(f => {
  fs.copyFileSync(path.join(webSrc, f), path.join(webDst, f));
});

// 3. zip으로 .ait 생성
const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
const version = `${today}-7`;
const outFile = path.join(__dirname, `kadeora-${version}.ait`);

console.log('2. .ait 패키징...');
execSync(`cd ${pkgDir} && zip -r ${outFile} .granite/ web/`, { stdio: 'inherit' });

// 정리
fs.rmSync(pkgDir, { recursive: true });

const stats = fs.statSync(outFile);
console.log(`\n✅ 빌드 완료: ${path.basename(outFile)}`);
console.log(`   크기: ${(stats.size / 1024).toFixed(1)} KB`);
console.log(`   버전: ${version}`);
console.log(`   SDK: 2.1.0`);
console.log(`\n📌 이 파일을 앱인토스 콘솔에 업로드하세요.`);
console.log(`   메모: "반려 3건 수정 + 5탭 확장 + 토스 피드 API v2"`);
