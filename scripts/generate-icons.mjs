import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');
const iconsDir = path.join(publicDir, 'icons');

// 카더라 로고 SVG (딥 네이비 + 파란 원 3개)
const generateIconSVG = (size) => {
  const rx = Math.round(size * 0.22); // 둥근 모서리 비율
  const circleR = Math.round(size * 0.09); // 원 반지름
  const cy = size / 2;
  const gap = size * 0.22; // 원 간격
  const cx1 = size / 2 - gap;
  const cx2 = size / 2;
  const cx3 = size / 2 + gap;
  
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0A1838"/>
      <stop offset="100%" stop-color="#1E3A6E"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#bg)"/>
  <circle cx="${cx1}" cy="${cy}" r="${circleR}" fill="#5B93FF" opacity="0.9"/>
  <circle cx="${cx2}" cy="${cy}" r="${circleR}" fill="#5B93FF" opacity="0.9"/>
  <circle cx="${cx3}" cy="${cy}" r="${circleR}" fill="#5B93FF" opacity="0.9"/>
</svg>`;
};

// Maskable 아이콘 (safe zone 고려 - 아이콘 76% 크기)
const generateMaskableSVG = (size) => {
  const innerSize = Math.round(size * 0.76);
  const offset = Math.round((size - innerSize) / 2);
  const rx = Math.round(innerSize * 0.22);
  const circleR = Math.round(innerSize * 0.09);
  const cy = size / 2;
  const gap = innerSize * 0.22;
  const cx1 = size / 2 - gap;
  const cx2 = size / 2;
  const cx3 = size / 2 + gap;
  
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0A1838"/>
      <stop offset="100%" stop-color="#1E3A6E"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="#08102A"/>
  <rect x="${offset}" y="${offset}" width="${innerSize}" height="${innerSize}" rx="${rx}" fill="url(#bg)"/>
  <circle cx="${cx1}" cy="${cy}" r="${circleR}" fill="#5B93FF" opacity="0.9"/>
  <circle cx="${cx2}" cy="${cy}" r="${circleR}" fill="#5B93FF" opacity="0.9"/>
  <circle cx="${cx3}" cy="${cy}" r="${circleR}" fill="#5B93FF" opacity="0.9"/>
</svg>`;
};

// Apple Touch Icon (배경 꽉 채움, RGB)
const generateAppleTouchSVG = (size) => {
  const circleR = Math.round(size * 0.09);
  const cy = size / 2;
  const gap = size * 0.22;
  const cx1 = size / 2 - gap;
  const cx2 = size / 2;
  const cx3 = size / 2 + gap;
  
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#0A1838"/>
  <circle cx="${cx1}" cy="${cy}" r="${circleR}" fill="#5B93FF"/>
  <circle cx="${cx2}" cy="${cy}" r="${circleR}" fill="#5B93FF"/>
  <circle cx="${cx3}" cy="${cy}" r="${circleR}" fill="#5B93FF"/>
</svg>`;
};

async function generatePNG(svg, outputPath, size) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(outputPath);
  console.log(`✓ Generated: ${path.basename(outputPath)} (${size}x${size})`);
}

async function main() {
  // 디렉토리 확인
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];
  
  console.log('🎨 카더라 로고 아이콘 생성 중...\n');
  
  // 일반 아이콘
  for (const size of sizes) {
    const svg = generateIconSVG(size);
    await generatePNG(svg, path.join(iconsDir, `icon-${size}.png`), size);
  }
  
  // Maskable 아이콘
  for (const size of [192, 512]) {
    const svg = generateMaskableSVG(size);
    await generatePNG(svg, path.join(iconsDir, `icon-${size}-maskable.png`), size);
  }
  
  // Apple Touch Icon (180px)
  const appleSvg = generateAppleTouchSVG(180);
  await generatePNG(appleSvg, path.join(iconsDir, 'apple-touch-icon.png'), 180);
  
  // Favicon (32px)
  const faviconSvg = generateIconSVG(32);
  await generatePNG(faviconSvg, path.join(publicDir, 'favicon.png'), 32);
  
  // favicon.ico (멀티사이즈) - Sharp는 ico 미지원, 32px PNG로 대체
  console.log('\n✅ 모든 아이콘 생성 완료!');
}

main().catch(console.error);
