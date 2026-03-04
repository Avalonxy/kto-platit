/**
 * Приводит скриншоты к формату VK для экрана запуска:
 * 1200 × 600 px, альбомная, JPG/PNG.
 * Исходники: docs/screenshots/*.png (или .jpg, .gif)
 * Результат: docs/screenshots/vk-1200x600/ — готовые файлы для загрузки.
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const W = 1200;
const H = 600;
const srcDir = path.join(__dirname, '..', 'docs', 'screenshots');
const outDir = path.join(srcDir, 'vk-1200x600');

const exts = ['.png', '.jpg', '.jpeg', '.gif'];

async function run() {
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
    console.log('Создана папка docs/screenshots. Положите туда скриншоты (PNG/JPG) и запустите снова.');
    return;
  }

  const files = fs.readdirSync(srcDir)
    .filter((f) => exts.includes(path.extname(f).toLowerCase()) && !f.startsWith('vk-'));

  if (files.length === 0) {
    console.log('В docs/screenshots нет картинок (PNG/JPG/GIF). Добавьте скриншоты и запустите снова.');
    return;
  }

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (let i = 0; i < files.length; i++) {
    const name = files[i];
    const base = path.basename(name, path.extname(name));
    const outName = `${String(i + 1).padStart(2, '0')}-${base}.png`;
    const srcPath = path.join(srcDir, name);
    const outPath = path.join(outDir, outName);

    await sharp(srcPath)
      .resize(W, H, { fit: 'cover', position: 'center' })
      .png()
      .toFile(outPath);
    console.log(`OK: vk-1200x600/${outName} (1200×600)`);
  }

  console.log(`\nГотово: ${files.length} файл(ов) в docs/screenshots/vk-1200x600/ — загружайте в VK.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
