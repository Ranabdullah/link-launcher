const fs = require('node:fs');
const sharp = require('sharp');
fs.mkdirSync('icons', { recursive: true });
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#0b57d0"/><path d="M154 161h135v48h-85v143h-50z" fill="white"/><path d="M238 279h120v48H238z" fill="#c2e7ff"/><circle cx="334" cy="190" r="28" fill="#c2e7ff"/></svg>');
(async () => {
  await sharp(svg).resize(192, 192).png().toFile('icons/icon-192.png');
  await sharp(svg).png().toFile('icons/icon-512.png');
  await sharp(svg).resize(384, 384).extend({ top: 64, bottom: 64, left: 64, right: 64, background: '#0b57d0' }).png().toFile('icons/maskable-512.png');
})();
