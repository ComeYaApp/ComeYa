const fs = require('fs');

const filePath = 'c:/CY/client/screens/ProfileScreen.tsx';

// Read as buffer (raw bytes) to handle the corrupted replacement characters
let buf = fs.readFileSync(filePath);

// Convert to string for pattern matching ( = U+FFFD)
let content = buf.toString('utf8');

// ===== Replace corrupted strings =====
// The replacement character  shows as actual replacement char in Node's utf8 decode
// sesin → sesión
// Ests → ¿Estás

let changed = 0;

// 1. "Cerrar sesin" → "Cerrar sesión" (lines 1607, 1636)
const oldLogout = /Cerrar sesi\uFFFDn/g;
const matches1 = content.match(oldLogout);
if (matches1) {
  content = content.replace(oldLogout, 'Cerrar sesión');
  changed += matches1.length;
  console.log(`Fixed ${matches1.length} occurrence(s) of "Cerrar sesin"`);
}

// 2. "Ests seguro que deseas cerrar sesin?" → "¿Estás seguro que deseas cerrar sesión?"
const oldConfirm = /\uFFFDEst\uFFFDs seguro que deseas cerrar sesi\uFFFDn\?/g;
const matches2 = content.match(oldConfirm);
if (matches2) {
  content = content.replace(oldConfirm, '¿Estás seguro que deseas cerrar sesión?');
  changed += matches2.length;
  console.log(`Fixed ${matches2.length} occurrence(s) of confirmation text`);
}

// 3. Also check for any remaining  characters in these specific contexts
// Sometimes the text might have different corruption patterns
// "Cerrar sesin" without tilde at all (line 1578 was already fixed)

if (changed > 0) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`\nTotal corrections: ${changed}. File saved.`);
} else {
  console.log('\nNo corrections made. File may already be fixed or have different corruption pattern.');
}

// Verify - re-read and check
const verify = fs.readFileSync(filePath, 'utf8');
const remaining = (verify.match(/\uFFFD/g) || []).length;
console.log(`Remaining  characters in file: ${remaining}`);

// Check for "sesión" to confirm it was written correctly
const correctCount = (verify.match(/sesión/g) || []).length;
console.log(`Correct "sesión" occurrences: ${correctCount}`);