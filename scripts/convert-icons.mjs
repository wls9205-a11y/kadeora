#!/usr/bin/env node
// SVG → PNG 변환 스크립트 (sharp 사용)
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const pub = (p) => resolve(root, 'public', p);

const conversions = [
  { src: 'og-image.svg',         dst: 'og-image.png',         w: 1200, h: 628 },
  { src: 'og-image-kakao.svg',   dst: 'og-image-kakao.png',   w: 800,  h: 400 },
  { src: 'icons/icon-192.svg',   dst: 'icons/icon-192.png',   w: 192,  h: 192 },
  { src: 'icons/icon-72.svg',    dst: 'icons/icon-72.png',    w: 72,   h: 72 },
  { src: 'favicon.svg',          dst: 'favicon.png',          w: 512,  h: 512 },
  { src: 'icons/icon-512.svg',   dst: 'icons/icon-512.png',   w: 512,  h: 512 },
  { src: 'icons/icon-512.svg',   dst: 'icons/icon-1024.png',  w: 1024, h: 1024 },
];

for (const { src, dst, w, h } of conversions) {
  try {
    const svgBuf = readFileSync(pub(src));
    // Resize the SVG to target dimensions, then convert to PNG
    await sharp(svgBuf, { density: 300 })
      .resize(w, h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(pub(dst));
    console.log(`✅ ${src} → ${dst} (${w}×${h})`);
  } catch (e) {
    console.error(`❌ ${src} → ${dst}: ${e.message}`);
  }
}

console.log('\n🎉 변환 완료');
