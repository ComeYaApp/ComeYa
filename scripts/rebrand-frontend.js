const fs = require("fs");
const path = require("path");

// Directories to search
const searchDirs = [path.join(__dirname, "../client")];

// File extensions to process
const extensions = [".tsx", ".ts", ".jsx", ".js", ".json"];

// Replacement mappings
const replacements = [
  { from: /MOUZO/g, to: "Rabbit Food" },
  { from: /Mouzo/g, to: "Rabbit Food" },
  { from: /mouzo/g, to: "rabbitfood" },
  { from: /MouzoColors/g, to: "RabbitFoodColors" },
  { from: /@nemy_/g, to: "@rabbitfood_" },
  { from: /nemy-ca\.pem/g, to: "nemy-ca.pem" }, // Keep NEMY database references
  { from: /nemydb/g, to: "nemydb" }, // Keep NEMY database references
];

let filesProcessed = 0;
let filesChanged = 0;
let totalReplacements = 0;

function shouldProcessFile(filePath) {
  const ext = path.extname(filePath);
  return extensions.includes(ext);
}

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
    console.error(`✗ Error processing ${filePath}:`, error.message);
  }
}

function walkDirectory(dir) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and other build directories
      if (!["node_modules", "dist", "build", ".expo", ".git"].includes(file)) {
        walkDirectory(filePath);
      }
    } else if (shouldProcessFile(filePath)) {
      processFile(filePath);
    }
  });
}

console.log("🐰 Rabbit Food Rebranding Script\n");
console.log("Replacing MOUZO references in frontend...\n");

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
console.log("\n✅ Rebranding complete!\n");
