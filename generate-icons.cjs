const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIcoModule = require('png-to-ico');
const pngToIco = typeof pngToIcoModule === 'function' ? pngToIcoModule : (pngToIcoModule.default || pngToIcoModule);

const svgLogo = fs.readFileSync(path.join(__dirname, 'src', 'overdesk.svg'), 'utf8');

async function main() {
  const buildDir = path.join(__dirname, 'build');
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir);
  }

  console.log('Generating logo PNG from SVG...');
  
  // Render SVG to 512x512 PNG
  const png512Buffer = await sharp(Buffer.from(svgLogo))
    .resize(512, 512)
    .png()
    .toBuffer();
    
  // Export 512x512 icon for macOS/general use
  fs.writeFileSync(path.join(buildDir, 'icon.png'), png512Buffer);
  fs.writeFileSync(path.join(__dirname, 'electron', 'icon.png'), png512Buffer);
  console.log('✓ Created build/icon.png and electron/icon.png (512x512)');

  // Generate PNGs at all key Windows 11 Scaling resolutions (16, 24, 32, 36, 48, 64, 128, 256)
  const sizes = [16, 24, 32, 36, 48, 64, 128, 256];
  const filePaths = [];
  for (const size of sizes) {
    const buffer = await sharp(Buffer.from(svgLogo))
      .resize(size, size)
      .png()
      .toBuffer();
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
