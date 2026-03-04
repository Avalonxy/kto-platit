/**
 * Конвертация SVG иконок в PNG для каталога VK.
 * Универсальная иконка: 576×576 px (каталог, лента, сообщения, рекомендации).
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const publicDir = path.join(__dirname, '..', 'public');

async function run() {
  // Универсальная иконка для VK: 576×576
  await sharp(path.join(publicDir, 'icon.svg'))
    .resize(576, 576)
    .png()
    .toFile(path.join(publicDir, 'icon-576.png'));
  console.log('OK: public/icon-576.png (576×576)');

  // Маленькая иконка: 48×48 (общая иконка)
  await sharp(path.join(publicDir, 'icon-small.svg'))
    .resize(48, 48)
    .png()
    .toFile(path.join(publicDir, 'icon-small.png'));
  console.log('OK: public/icon-small.png (48×48)');

  // Иконка 96×96 для LottieFiles / анимации загрузки
  await sharp(path.join(publicDir, 'icon.svg'))
    .resize(96, 96)
    .png()
    .toFile(path.join(publicDir, 'icon-96.png'));
  console.log('OK: public/icon-96.png (96×96)');

  // Фавикон для VK: 32×32 (<= 50 КБ)
  await sharp(path.join(publicDir, 'icon-small.svg'))
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'icon-32.png'));
  console.log('OK: public/icon-32.png (32×32)');

  // Дополнительно: 128×128 из основной иконки
  await sharp(path.join(publicDir, 'icon.svg'))
    .resize(128, 128)
    .png()
    .toFile(path.join(publicDir, 'icon-128.png'));
  console.log('OK: public/icon-128.png (128×128)');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
