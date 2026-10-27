const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const sourceDir = path.resolve('images');
const outputDir = path.resolve('public/images/display');
fs.mkdirSync(outputDir, { recursive: true });

async function main() {
  const files = fs.readdirSync(sourceDir).filter(file => /\.(jpe?g|png)$/i.test(file) && file !== 'فرم نظر سنجی .png');
  let totalOriginal = 0;
  let totalOutput = 0;
  let converted = 0;

  for (const file of files) {
    const input = path.join(sourceDir, file);
    const output = path.join(outputDir, file.replace(/\.(jpe?g|png)$/i, '.webp'));
    const originalBytes = fs.statSync(input).size;
    try {
      await sharp(input)
        .rotate()
        .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toFile(output);
      const outputBytes = fs.statSync(output).size;
      totalOriginal += originalBytes;
      totalOutput += outputBytes;
      converted++;
    } catch (error) {
      console.error('Could not optimize ' + file + ':', error.message);
      throw error;
    }
  }

  console.log(`Optimized ${converted} images: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB original -> ${(totalOutput / 1024 / 1024).toFixed(2)} MB WebP`);
}
main().catch(error => { console.error(error); process.exit(1); });
