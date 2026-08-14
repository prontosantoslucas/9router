const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const sourceImage = 'C:\\Users\\user\\.gemini\\antigravity-ide\\brain\\be722746-4c6c-499d-b949-ff7e1b71e9eb\\lucas_app_icon_1786737157620.jpg';
const mobileAssets = path.join(__dirname, '..', 'apps', 'mobile', 'assets');
const androidRes = path.join(__dirname, '..', 'apps', 'mobile', 'android', 'app', 'src', 'main', 'res');

async function generate() {
  console.log('Generating mobile icons from:', sourceImage);

  // 1. Expo Assets
  await sharp(sourceImage)
    .resize(1024, 1024)
    .png()
    .toFile(path.join(mobileAssets, 'icon.png'));
  console.log('Generated:', path.join(mobileAssets, 'icon.png'));

  await sharp(sourceImage)
    .resize(1024, 1024)
    .png()
    .toFile(path.join(mobileAssets, 'adaptive-icon.png'));
  console.log('Generated:', path.join(mobileAssets, 'adaptive-icon.png'));

  await sharp(sourceImage)
    .resize(1024, 1024)
    .png()
    .toFile(path.join(mobileAssets, 'splash-icon.png'));
  console.log('Generated:', path.join(mobileAssets, 'splash-icon.png'));

  // 2. Android Mipmaps
  const mipmaps = [
    { dir: 'mipmap-mdpi', size: 48 },
    { dir: 'mipmap-hdpi', size: 72 },
    { dir: 'mipmap-xhdpi', size: 96 },
    { dir: 'mipmap-xxhdpi', size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 },
  ];

  for (const m of mipmaps) {
    const targetDir = path.join(androidRes, m.dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    // ic_launcher.png
    await sharp(sourceImage)
      .resize(m.size, m.size)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher.png'));

    // ic_launcher_round.png
    await sharp(sourceImage)
      .resize(m.size, m.size)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_round.png'));

    // ic_launcher_foreground.png (used in adaptive-icon XML)
    await sharp(sourceImage)
      .resize(Math.round(m.size * 1.5), Math.round(m.size * 1.5))
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

    console.log(`Generated Android mipmap: ${m.dir} (${m.size}px)`);
  }

  console.log('ALL ICONS GENERATED SUCCESSFULLY!');
}

generate().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
