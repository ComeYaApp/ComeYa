const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const svgPath = path.join(__dirname, "../assets/images/comeya-logo.svg");
const svgBuffer = fs.readFileSync(svgPath);

const sizes = [
  { name: "icon.png", size: 1024 },
  { name: "splash-icon.png", size: 512 },
  { name: "logo.png", size: 256 },
];

(async () => {
  for (const { name, size } of sizes) {
    const out = path.join(__dirname, "../assets/images", name);
    await sharp(svgBuffer).resize(size, size).png().toFile(out);
    console.log(`✅ ${name} (${size}x${size})`);
  }
})();
