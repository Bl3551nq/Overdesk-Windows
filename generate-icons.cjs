const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIcoModule = require('png-to-ico');
const pngToIco = typeof pngToIcoModule === 'function' ? pngToIcoModule : (pngToIcoModule.default || pngToIcoModule);

const svgLogo = `
<svg width="512" height="512" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sphereGrad" x1="0.15" y1="0.15" x2="0.85" y2="0.85">
      <stop offset="0%" stopColor="#00C0FF" />
      <stop offset="50%" stopColor="#005BFF" />
      <stop offset="100%" stopColor="#001B93" />
    </linearGradient>
    <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#2E2F37" />
      <stop offset="100%" stopColor="#131317" />
    </linearGradient>
  </defs>

  <!-- 1. Back part of the ring (behind the sphere) -->
  <g transform="rotate(-15 50 50)">
    <path
      d="M 6 50 A 44 14 0 0 1 94 50 L 84 50 A 34 10 0 0 0 16 50 Z"
      fill="url(#ringGrad)"
    />
  </g>

  <!-- 2. Blue Planet Sphere -->
  <circle
    cx="50"
    cy="50"
    r="28"
    fill="url(#sphereGrad)"
  />

  <!-- 3. Front part of the ring (in front of the sphere) -->
  <g transform="rotate(-15 50 50)">
    <path
      d="M 94 50 A 44 14 0 0 1 6 50 L 16 50 A 34 10 0 0 0 84 50 Z"
      fill="url(#ringGrad)"
    />
  </g>
</svg>
`;

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
