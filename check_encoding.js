const fs = require('fs');
const path = require('path');

function walkDir(dir, ext, files) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'android' && e.name !== 'server_dist') {
      walkDir(full, ext, files);
    } else if (e.isFile() && e.name.endsWith(ext)) {
      files.push(full);
    }
  }
}

// Collect all .tsx and .ts files (excluding server, just client + shared)
const allFiles = [];
walkDir('c:/CY/client', '.tsx', allFiles);
walkDir('c:/CY/client', '.ts', allFiles);
walkDir('c:/CY/shared', '.ts', allFiles);

const issueFiles = [];

for (const f of allFiles) {
  const buf = fs.readFileSync(f);
  const content = buf.toString('utf8');
  
  // Check for "Cerrar sesi" substring (part of "Cerrar sesión")
  if (content.includes('Cerrar sesi') || content.includes('sesión') || content.includes('seguro')) {
    // Look for replacement character (U+FFFD) which means encoding corruption
    if (content.includes('\uFFFD')) {
      issueFiles.push({ file: f, issue: 'Contains replacement character U+FFFD' });
    }
    
    // Check if bytes contain invalid UTF-8 sequences
    try {
      decodeURIComponent(escape(content));
    } catch {
      issueFiles.push({ file: f, issue: 'Invalid UTF-8 sequence' });
    }
  }
}

// Also check all files that might have Spanish text (even without "Cerrar sesión")
console.log('=== Files with "Cerrar sesi" or "sesión" or "seguro" ===');
for (const f of allFiles) {
  const buf = fs.readFileSync(f);
  const content = buf.toString('utf8');
  if (content.includes('Cerrar sesi') || content.includes('sesión') || content.includes('seguro')) {
    console.log(f);
  }
}

console.log('\n=== Files with encoding corruption (U+FFFD) among relevant files ===');
if (issueFiles.length === 0) {
  console.log('No files found with encoding corruption (replacement character).');
  console.log('The issue may be in the Metro bundler, not in source files.');
} else {
  issueFiles.forEach(x => console.log(`${x.file} — ${x.issue}`));
}

// Now check for the actual text patterns in logout-related ProfileScreens
console.log('\n=== Checking ProfileScreen files specifically ===');
const profileFiles = [
  'c:/CY/client/screens/CustomerProfileScreen.tsx',
  'c:/CY/client/screens/BusinessProfileScreen.tsx',
  'c:/CY/client/screens/DeliveryProfileScreen.tsx',
  'c:/CY/client/screens/AdminProfileScreen.tsx',
  'c:/CY/client/screens/GuestProfileScreen.tsx',
  'c:/CY/client/screens/ProfileScreen.tsx',
  'c:/CY/client/screens/ProfileScreen.web.tsx',
];

for (const f of profileFiles) {
  try {
    const buf = fs.readFileSync(f);
    const content = buf.toString('utf8');
    
    // Search for "Cerrar" lines
    const lines = content.split('\n');
    const cerrarLines = lines
      .map((l, i) => ({ line: i + 1, text: l }))
      .filter(x => x.text.includes('Cerrar') || x.text.includes('cerrar'));
    
    if (cerrarLines.length > 0) {
      console.log(`\n${f}:`);
      cerrarLines.forEach(x => {
        // Show raw bytes of the line
        const lineBuf = Buffer.from(x.text, 'utf8');
        const hexBytes = Array.from(lineBuf.slice(0, 80)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`  Line ${x.line}: "${x.text.trim()}"`);
        console.log(`    Hex: ${hexBytes}`);
      });
    }
  } catch(e) {
    // file may not exist
  }
}