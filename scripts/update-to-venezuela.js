const fs = require("fs");
const path = require("path");

const searchDirs = [
  path.join(__dirname, "../client"),
  path.join(__dirname, "../server"),
  path.join(__dirname, "../shared"),
];

const extensions = [".tsx", ".ts", ".jsx", ".js", ".json"];

// Replacement mappings for locations
const replacements = [
  // Cities
  { from: /Autlán de Navarro/gi, to: "San Cristóbal" },
  { from: /Autlán/gi, to: "San Cristóbal" },

  // States/Regions
  { from: /Jalisco/gi, to: "Táchira" },
  { from: /Tachira/gi, to: "Táchira" }, // Fix spelling

  // Countries
  { from: /México/gi, to: "Venezuela" },
  { from: /Mexico/gi, to: "Venezuela" },
  { from: /\bMX\b/g, to: "VE" },

  // Full addresses
  {
    from: /San Cristóbal, Venezuela/gi,
    to: "San Cristóbal, Táchira, Venezuela",
  },

  // Coordinates (Autlán coords to San Cristóbal coords)
  // Autlán: 19.7667, -104.3667
  // San Cristóbal: 7.7669, -72.2250
  { from: /19\.7667/g, to: "7.7669" },
  { from: /-104\.3667/g, to: "-72.2250" },
  { from: /19\.77/g, to: "7.77" },
  { from: /-104\.37/g, to: "-72.23" },

  // Phone codes
  { from: /\+52/g, to: "+58" }, // Mexico to Venezuela
  { from: /\(52\)/g, to: "(58)" },
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

console.log(
  "🇻🇪 Updating all locations to San Cristóbal, Táchira, Venezuela...\n",
);

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
console.log("\n✅ All locations updated to Venezuela!\n");
