const fs = require("fs");
const path = require("path");

const searchDirs = [
  path.join(__dirname, "../client"),
  path.join(__dirname, "../public"),
  path.join(__dirname, "../web"),
];

const extensions = [".tsx", ".ts", ".jsx", ".js", ".html"];

// Replacement mappings
const replacements = [
  { from: /Autlán de Navarro/gi, to: "San Cristóbal" },
  { from: /Autlán, Jalisco/gi, to: "San Cristóbal, Venezuela" },
  { from: /Autlán/gi, to: "San Cristóbal" },
  {
    from: /Delivery en Autlán/gi,
    to: "Tu app de comida y delivery en Venezuela",
  },
  { from: /comunidad de Autlán/gi, to: "comunidad de San Cristóbal" },
  { from: /Jalisco/gi, to: "Venezuela" },
];

let filesProcessed = 0;
let filesChanged = 0;
let totalReplacements = 0;

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, "utf8");
    let originalContent = content;
    let fileReplacements = 0;

    replacements.forEach(({ from, to }) => {
      const matches = content.match(from);
      if (matches) {
        fileReplacements += matches.length;
        content = content.replace(from, to);
      }
    });

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, "utf8");
      filesChanged++;
      totalReplacements += fileReplacements;
      console.log(
        `✓ ${path.relative(process.cwd(), filePath)} (${fileReplacements} changes)`,
      );
    }

    filesProcessed++;
  } catch (error) {
    console.error(`✗ Error: ${filePath}:`, error.message);
  }
}

function walkDirectory(dir) {
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!["node_modules", "dist", "build", ".expo", ".git"].includes(file)) {
        walkDirectory(filePath);
      }
    } else if (extensions.includes(path.extname(filePath))) {
      processFile(filePath);
    }
  });
}

console.log("🇻🇪 Updating location to Venezuela...\n");

searchDirs.forEach((dir) => {
  if (fs.existsSync(dir)) {
    console.log(`📁 Processing: ${path.relative(process.cwd(), dir)}\n`);
    walkDirectory(dir);
  }
});

console.log("\n📊 Summary:");
console.log(`   Files processed: ${filesProcessed}`);
console.log(`   Files changed: ${filesChanged}`);
console.log(`   Total replacements: ${totalReplacements}`);
console.log("\n✅ Location updated to Venezuela!\n");
