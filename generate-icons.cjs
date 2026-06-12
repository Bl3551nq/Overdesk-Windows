const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIcoModule = require('png-to-ico');
const pngToIco = typeof pngToIcoModule === 'function' ? pngToIcoModule : (pngToIcoModule.default || pngToIcoModule);

const svgLogo = fs.readFileSync(path.join(__dirname, 'src', 'overdesk.svg'), 'utf8');

async function getIconBuffer(svgContent, targetSize) {
  // 1. Render raw SVG into a high-res 1024x1024 canvas first to ensure high-quality trimming
  const rawHighRes = await sharp(Buffer.from(svgContent))
    .resize(1024, 1024)
    .png()
    .toBuffer();

  // 2. Trim all excessive transparent margins around the emblem
  const trimmed = await sharp(rawHighRes)
    .trim()
    .toBuffer();

  // 3. Define target padded size. Polished apps use 94% of the icon border area.
  // This makes sure the icon is huge, prominent, and looks gorgeous on the taskbar/dock.
  const paddedSize = Math.max(1, Math.round(targetSize * 0.94));

  // 4. Resize our perfectly trimmed emblem to the padded size
  const resized = await sharp(trimmed)
    .resize(paddedSize, paddedSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toBuffer();

  // 5. Extend with transparent borders to make it precisely targetSize x targetSize
  const topPad = Math.round((targetSize - paddedSize) / 2);
  const leftPad = Math.round((targetSize - paddedSize) / 2);
  const bottomPad = targetSize - paddedSize - topPad;
  const rightPad = targetSize - paddedSize - leftPad;

  const finalBuffer = await sharp(resized)
    .extend({
      top: topPad,
      bottom: bottomPad,
      left: leftPad,
      right: rightPad,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();

  return finalBuffer;
}

async function main() {
  const buildDir = path.join(__dirname, 'build');
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir);
  }

  console.log('Generating logo PNG from SVG with smart auto-trimming...');
  
  // Render high fidelity 512x512 logo
  const png512Buffer = await getIconBuffer(svgLogo, 512);
    
  // Export 512x512 icon for macOS/general use
  fs.writeFileSync(path.join(buildDir, 'icon.png'), png512Buffer);
  fs.writeFileSync(path.join(__dirname, 'electron', 'icon.png'), png512Buffer);
  console.log('✓ Created build/icon.png and electron/icon.png (512x512 with smart ratio)');

  // Generate PNGs at all key Windows 11 Scaling resolutions (16, 24, 32, 36, 48, 64, 128, 256)
  const sizes = [16, 24, 32, 36, 48, 64, 128, 256];
  const filePaths = [];
  for (const size of sizes) {
    const buffer = await getIconBuffer(svgLogo, size);
    const filePath = path.join(buildDir, `temp-icon-${size}.png`);
    fs.writeFileSync(filePath, buffer);
    filePaths.push(filePath);
  }

  console.log('Converting multiple PNG layers to unified ICO...');
  try {
    const icoBuffer = await pngToIco(filePaths);
    fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer);
    fs.writeFileSync(path.join(__dirname, 'electron', 'icon.ico'), icoBuffer);
    console.log('✓ Created build/icon.ico and electron/icon.ico (8 resolutions inside)');
  } catch (err) {
    console.error('Failed to convert ICO:', err);
  }

  // Cleanup temp files
  for (const filePath of filePaths) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  
  console.log('Done generating asset resources!');
}

main().catch(console.error);
