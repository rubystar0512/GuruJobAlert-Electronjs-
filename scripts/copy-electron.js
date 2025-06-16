const fs = require('fs');
const path = require('path');

// Ensure build directory exists
const buildDir = path.join(__dirname, '..', 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Copy electron.js
const electronSrc = path.join(__dirname, '..', 'public', 'electron.js');
const electronDest = path.join(buildDir, 'electron.js');
fs.copyFileSync(electronSrc, electronDest);
console.log('✅ Copied electron.js to build directory');

// Copy icon.png
const iconSrc = path.join(__dirname, '..', 'public', 'icon.png');
const iconDest = path.join(buildDir, 'icon.png');
fs.copyFileSync(iconSrc, iconDest);
console.log('✅ Copied icon.png to build directory');

console.log('🎉 All files copied successfully!'); 