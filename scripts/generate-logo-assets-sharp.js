// Script to generate PNG assets from SVG logo using sharp
// Run: npm install --save-dev sharp && node scripts/generate-logo-assets-sharp.js

const fs = require("fs");
const path = require("path");

async function generateAssets() {
  try {
    const sharp = require("sharp");

    const svgPath = path.join(
      __dirname,
      "../assets/images/rabbit-food-logo.svg",
    );
    const outputDir = path.join(__dirname, "../assets/images");

    if (!fs.existsSync(svgPath)) {
      console.error("❌ SVG file not found:", svgPath);
      return;
    }

    console.log("🎨 Generating Rabbit Food logo assets...\n");

    const svgBuffer = fs.readFileSync(svgPath);

    // Generate icon.png (1024x1024)
    console.log("📱 Generating icon.png (1024x1024)...");
    await sharp(svgBuffer)
      .resize(1024, 1024)
      .png()
      .toFile(path.join(outputDir, "icon.png"));
    console.log("   ✓ icon.png created\n");

    // Generate splash-icon.png (512x512)
    console.log("💦 Generating splash-icon.png (512x512)...");
    await sharp(svgBuffer)
      .resize(512, 512)
      .png()
      .toFile(path.join(outputDir, "splash-icon.png"));
    console.log("   ✓ splash-icon.png created\n");

    // Generate favicon.png (48x48)
    console.log("🌐 Generating favicon.png (48x48)...");
    await sharp(svgBuffer)
      .resize(48, 48)
      .png()
      .toFile(path.join(outputDir, "favicon.png"));
    console.log("   ✓ favicon.png created\n");

    // Generate android-icon-foreground.png (432x432)
    console.log("🤖 Generating android-icon-foreground.png (432x432)...");
    await sharp(svgBuffer)
      .resize(432, 432)
      .png()
      .toFile(path.join(outputDir, "android-icon-foreground.png"));
    console.log("   ✓ android-icon-foreground.png created\n");

    // Generate android-icon-background.png (432x432 solid color)
    console.log("🎨 Generating android-icon-background.png (432x432)...");
    await sharp({
      create: {
        width: 432,
        height: 432,
        channels: 4,
        background: { r: 212, g: 165, b: 116, alpha: 1 }, // #D4A574
      },
    })
      .png()
      .toFile(path.join(outputDir, "android-icon-background.png"));
    console.log("   ✓ android-icon-background.png created\n");

    // Generate android-icon-monochrome.png (432x432 white on transparent)
    console.log("⚪ Generating android-icon-monochrome.png (432x432)...");
    await sharp(svgBuffer)
      .resize(432, 432)
      .greyscale()
      .png()
      .toFile(path.join(outputDir, "android-icon-monochrome.png"));
    console.log("   ✓ android-icon-monochrome.png created\n");

    console.log("✅ All assets generated successfully!");
    console.log("\n📋 Generated files:");
    console.log("   • icon.png (1024x1024)");
    console.log("   • splash-icon.png (512x512)");
    console.log("   • favicon.png (48x48)");
    console.log("   • android-icon-foreground.png (432x432)");
    console.log("   • android-icon-background.png (432x432)");
    console.log("   • android-icon-monochrome.png (432x432)");
    console.log(
      "\n🚀 Ready to build your app with the new Rabbit Food branding!",
    );
  } catch (error) {
    if (error.code === "MODULE_NOT_FOUND") {
      console.error("\n❌ Sharp package not found!");
      console.error("\n📦 Install it with:");
      console.error("   npm install --save-dev sharp\n");
      console.error("Then run this script again:");
      console.error("   node scripts/generate-logo-assets-sharp.js\n");
    } else {
      console.error("❌ Error generating assets:", error.message);
    }
  }
}

generateAssets();
