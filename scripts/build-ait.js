const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcDir = path.join(__dirname, '../appintoss');
const outFile = path.join(__dirname, '../kadeora-v1.0.0.ait');

// 기존 파일 삭제
if (fs.existsSync(outFile)) {
  fs.unlinkSync(outFile);
}

// zip으로 압축 후 .ait로 리네임 (PowerShell은 .zip만 지원)
if (process.platform === 'win32') {
  const tmpZip = outFile.replace(/\.ait$/, '.zip');
  if (fs.existsSync(tmpZip)) fs.unlinkSync(tmpZip);
  execSync(`powershell Compress-Archive -Path "${srcDir}\\*" -DestinationPath "${tmpZip}" -Force`);
  fs.renameSync(tmpZip, outFile);
} else {
  execSync(`cd "${srcDir}" && zip -r "${outFile}" .`);
}

console.log('번들 생성 완료:', outFile);
const stats = fs.statSync(outFile);
console.log('파일 크기:', (stats.size / 1024).toFixed(1), 'KB');
