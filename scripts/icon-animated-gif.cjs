/**
 * Анимированная иконка 576×576: знак «?» покачивается влево-вправо.
 * Результат: public/icon-576.gif
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const GifEncoder = require('gif-encoder');

const SIZE = 576;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const NUM_FRAMES = 16;
const DELAY_MS = 80;
const SWAY_DEGREES = 12;

function svgWithRotation(angleDeg) {
  const t = `rotate(${angleDeg.toFixed(1)} 64 88)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0077FF"/>
      <stop offset="100%" style="stop-color:#0055CC"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#bg)"/>
  <text x="64" y="88" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="white" text-anchor="middle" transform="${t}">?</text>
</svg>`;
}

async function main() {
  const gif = new GifEncoder(SIZE, SIZE);
  gif.setDelay(DELAY_MS);
  gif.setRepeat(0); // бесконечный цикл
  gif.setQuality(10);

  const outPath = path.join(PUBLIC_DIR, 'icon-576.gif');
  const out = fs.createWriteStream(outPath);
  gif.pipe(out);

  gif.writeHeader();

  for (let i = 0; i < NUM_FRAMES; i++) {
    const angle = SWAY_DEGREES * Math.sin((i / NUM_FRAMES) * 2 * Math.PI);
    const svg = svgWithRotation(angle);
    const { data } = await sharp(Buffer.from(svg))
      .resize(SIZE, SIZE)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    gif.addFrame(data);
  }

  gif.finish();
  await new Promise((resolve, reject) => {
    out.on('finish', resolve);
    out.on('error', reject);
  });

  console.log('OK: public/icon-576.gif (576×576, анимация — покачивание «?»)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
