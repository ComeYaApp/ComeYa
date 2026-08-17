// Barrido de moneda: mueve el símbolo € al final del importe.
// Patrones:  JSX: €{expr} -> {expr} €   |  Template: `€${expr}` -> `${expr} €`
const fs = require("fs");
const path = require("path");

const root = "client";
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) {
      if (f === "node_modules") continue;
      walk(p);
    } else if (/\.(tsx?|jsx?)$/.test(f)) {
      files.push(p);
    }
  }
})(root);

let changed = 0;
let replacements = 0;
for (const p of files) {
  let src = fs.readFileSync(p, "utf8");
  const orig = src;
  // JSX: €{expr} -> {expr} €
  src = src.replace(/€\{([^}]*)\}/g, "{$1} €");
  // Template literals: `€${expr}` -> `${expr} €`
  src = src.replace(/€\$\{([^}]*)\}/g, "${$1} €");
  if (src !== orig) {
    src = src.replace(/\} € €/g, "} €");
    fs.writeFileSync(p, src);
    changed++;
    replacements +=
      (orig.match(/€\{[^}]*\}/g) || []).length +
      (orig.match(/€\$\{[^}]*\}/g) || []).length;
  }
}
console.log(`archivos cambiados: ${changed}`);
console.log(`reemplazos totales: ${replacements}`);
