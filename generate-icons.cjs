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

  // Render SVG to 256x256 PNG for ICO conversion
  const png256Buffer = await sharp(Buffer.from(svgLogo))
    .resize(256, 256)
    .png()
    .toBuffer();

  const temp256Path = path.join(buildDir, 'temp-icon-256.png');
  fs.writeFileSync(temp256Path, png256Buffer);

  console.log('Converting PNG to ICO...');
  try {
    const icoBuffer = await pngToIco(temp256Path);
    fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer);
    fs.writeFileSync(path.join(__dirname, 'electron', 'icon.ico'), icoBuffer);
    console.log('✓ Created build/icon.ico and electron/icon.ico (256x256)');
  } catch (err) {
    console.error('Failed to convert ICO:', err);
  }

  // Cleanup temp file
  if (fs.existsSync(temp256Path)) {
    fs.unlinkSync(temp256Path);
  }
  
  console.log('Done generating asset resources!');
}

main().catch(console.error);
