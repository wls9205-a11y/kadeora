/**
 * .ait 파일 패키징 — Windows/Linux/Mac 호환 (순수 Node.js zip)
 * 
 * SDK 2.1.0 번들 구조:
 *   app.json          ← 루트에 반드시 필요
 *   .granite/app.json ← 호환성
 *   web/index.html    ← WebView 엔트리포인트
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── 1. 웹 빌드 ──
console.log('1. 웹 빌드...');
execSync('node build-web.js', { stdio: 'inherit' });

// ── 2. 순수 Node.js ZIP 생성 (외부 의존성 없음) ──
console.log('2. .ait 패키징...');

// 파일 목록 수집
const files = [];

// app.json → 루트 (SDK 2.1.0 필수)
const appJson = fs.readFileSync(path.join(__dirname, '.granite', 'app.json'));
files.push({ name: 'app.json', data: appJson });

// .granite/app.json → 호환성
files.push({ name: '.granite/app.json', data: appJson });

// web/index.html
const indexHtml = fs.readFileSync(path.join(__dirname, 'dist', 'web', 'index.html'));
files.push({ name: 'web/index.html', data: indexHtml });

// ZIP 생성 (순수 Node.js — 외부 도구 불필요)
function createZip(entries) {
  const parts = [];
  const centralDir = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, 'utf8');
    const data = entry.data;

    // CRC32
    const crc = crc32(data);

    // Local file header (30 + name + data)
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4);         // version needed
    local.writeUInt16LE(0, 6);          // flags
    local.writeUInt16LE(0, 8);          // compression (store)
    local.writeUInt16LE(0, 10);         // mod time
    local.writeUInt16LE(0, 12);         // mod date
    local.writeUInt32LE(crc, 14);       // crc32
    local.writeUInt32LE(data.length, 18); // compressed size
    local.writeUInt32LE(data.length, 22); // uncompressed size
    local.writeUInt16LE(nameBuffer.length, 26); // name length
    local.writeUInt16LE(0, 28);         // extra length

    parts.push(local, nameBuffer, data);

    // Central directory entry (46 + name)
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // signature
    central.writeUInt16LE(20, 4);          // version made by
    central.writeUInt16LE(20, 6);          // version needed
    central.writeUInt16LE(0, 8);           // flags
    central.writeUInt16LE(0, 10);          // compression
    central.writeUInt16LE(0, 12);          // mod time
    central.writeUInt16LE(0, 14);          // mod date
    central.writeUInt32LE(crc, 16);        // crc32
    central.writeUInt32LE(data.length, 20); // compressed size
    central.writeUInt32LE(data.length, 24); // uncompressed size
    central.writeUInt16LE(nameBuffer.length, 28); // name length
    central.writeUInt16LE(0, 30);          // extra length
    central.writeUInt16LE(0, 32);          // comment length
    central.writeUInt16LE(0, 34);          // disk start
    central.writeUInt16LE(0, 36);          // internal attrs
    central.writeUInt32LE(0, 38);          // external attrs
    central.writeUInt32LE(offset, 42);     // local header offset

    centralDir.push(central, nameBuffer);

    offset += 30 + nameBuffer.length + data.length;
  }

  // End of central directory
  const centralDirData = Buffer.concat(centralDir);
  const eocdr = Buffer.alloc(22);
  eocdr.writeUInt32LE(0x06054b50, 0);   // signature
  eocdr.writeUInt16LE(0, 4);             // disk
  eocdr.writeUInt16LE(0, 6);             // disk start
  eocdr.writeUInt16LE(entries.length, 8); // entries on disk
  eocdr.writeUInt16LE(entries.length, 10); // total entries
  eocdr.writeUInt32LE(centralDirData.length, 12); // central dir size
  eocdr.writeUInt32LE(offset, 16);       // central dir offset
  eocdr.writeUInt16LE(0, 20);            // comment length

  return Buffer.concat([...parts, centralDirData, eocdr]);
}

// CRC32 구현
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// 3. 파일 출력
const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
const version = `${today}-8`;
const outFile = path.join(__dirname, `kadeora-${version}.ait`);

const zipBuffer = createZip(files);
fs.writeFileSync(outFile, zipBuffer);

const stats = fs.statSync(outFile);
console.log(`\n✅ 빌드 완료: ${path.basename(outFile)}`);
console.log(`   크기: ${(stats.size / 1024).toFixed(1)} KB`);
console.log(`   버전: ${version}`);
console.log(`   SDK: 2.1.0`);
console.log(`   구조: app.json + .granite/app.json + web/index.html`);
console.log(`\n📌 앱인토스 콘솔에 이 파일을 업로드하세요.`);
console.log(`   → console.apps-in-toss.toss.im`);
