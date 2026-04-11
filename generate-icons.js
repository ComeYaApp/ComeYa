const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const src = path.join(__dirname, 'client/assets/icon.png');
const bg = {r:254, g:21, b:25, alpha:1};

const configs = [
  { dpi: 'mdpi',    size: 48  },
  { dpi: 'hdpi',    size: 72  },
  { dpi: 'xhdpi',   size: 96  },
  { dpi: 'xxhdpi',  size: 144 },
  { dpi: 'xxxhdpi', size: 192 },
];

async function run() {
  for (const { dpi, size } of configs) {
    const dir = path.join(__dirname, 'android/app/src/main/res/mipmap-' + dpi);
    const fg = Math.round(size * 2.25);

    await sharp(src).resize(size, size).webp({ quality: 100 }).toFile(path.join(dir, 'ic_launcher.webp'));
    console.log(`✅ ${dpi} ic_launcher ${size}px`);

    await sharp(src).resize(size, size).webp({ quality: 100 }).toFile(path.join(dir, 'ic_launcher_round.webp'));
    console.log(`✅ ${dpi} ic_launcher_round ${size}px`);

    await sharp(src).resize(fg, fg, { fit: 'contain', background: bg }).webp({ quality: 100 }).toFile(path.join(dir, 'ic_launcher_foreground.webp'));
    console.log(`✅ ${dpi} ic_launcher_foreground ${fg}px`);
  }
  console.log('🎉 ALL ICONS REPLACED');
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
