const fs = require('fs');

const filePath = 'c:/CY/client/screens/ProfileScreen.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Map of corrupted patterns → corrected text
// The replacement character  = U+FFFD
const R = '\uFFFD';

const replacements = [
  // ñ patterns
  [new RegExp(`contras${R}na`, 'g'), 'contraseña'],
  [new RegExp(`n${R}mero`, 'g'), 'número'],
  [new RegExp(`telef${R}no`, 'g'), 'teléfono'],  // won't match, it's telfono
  [new RegExp(`Espe${R}ol`, 'g'), 'Español'],
  [new RegExp(`verificaci${R}n`, 'g'), 'verificación'],
  [new RegExp(`conexi${R}n`, 'g'), 'conexión'],
  [new RegExp(`funci${R}n`, 'g'), 'función'],
  [new RegExp(`suscripci${R}n`, 'g'), 'suscripción'],
  [new RegExp(`notificaci${R}n`, 'g'), 'notificación'],
  [new RegExp(`proximamente`, 'g'), 'próximamente'], // special case
  [new RegExp(`revisi${R}n`, 'g'), 'revisión'],
  [new RegExp(`informaci${R}n`, 'g'), 'información'],
  [new RegExp(`atenci${R}n`, 'g'), 'atención'],
  [new RegExp(`cancelaci${R}n`, 'g'), 'cancelación'],
  [new RegExp(`opci${R}n`, 'g'), 'opción'],
  [new RegExp(`aplicaci${R}n`, 'g'), 'aplicación'],
  [new RegExp(`expiraci${R}n`, 'g'), 'expiración'],
  [new RegExp(`aceptaci${R}n`, 'g'), 'aceptación'],
  [new RegExp(`preparaci${R}n`, 'g'), 'preparación'],
  [new RegExp(`obligaci${R}n`, 'g'), 'obligación'],
  [new RegExp(`eliminaci${R}n`, 'g'), 'eliminación'],
  [new RegExp(`reclamaci${R}n`, 'g'), 'reclamación'],
  [new RegExp(`retenci${R}n`, 'g'), 'retención'],
  [new RegExp(`ubicaci${R}n`, 'g'), 'ubicación'],
  [new RegExp(`autorizaci${R}n`, 'g'), 'autorización'],
  [new RegExp(`penalizaci${R}n`, 'g'), 'penalización'],
  [new RegExp(`actualizaci${R}n`, 'g'), 'actualización'],
  [new RegExp(`confidencialidad`, 'g'), 'confidencialidad'], // no accent but check
  [new RegExp(`configuraci${R}n`, 'g'), 'configuración'],
  [new RegExp(`identificaci${R}n`, 'g'), 'identificación'],
  [new RegExp(`suspensi${R}n`, 'g'), 'suspensión'],
  [new RegExp(`profesi${R}n`, 'g'), 'profesión'],
  
  // ó patterns
  [new RegExp(`tel${R}fono`, 'g'), 'teléfono'],
  
  // á patterns
  [new RegExp(`m${R}s`, 'g'), 'más'],
  [new RegExp(`est${R}`, 'g'), 'está'],
  [new RegExp(`pr${R}ximamente`, 'g'), 'próximamente'],
  [new RegExp(`c${R}dula`, 'g'), 'cédula'],
  
  // í patterns
  [new RegExp(`m${R}nimo`, 'g'), 'mínimo'],
  
  // ú patterns
  [new RegExp(`n${R}mero`, 'g'), 'número'],
  
  // é patterns
  [new RegExp(`tel${R}fono`, 'g'), 'teléfono'],
  
  // Other specific patterns
  [new RegExp(`Due${R}o`, 'g'), 'Dueño'],
  [new RegExp(`Espa${R}a`, 'g'), 'España'],
  [new RegExp(`espa${R}ol`, 'g'), 'español'],
  [new RegExp(`veh${R}culo`, 'g'), 'vehículo'],
  [new RegExp(`matr${R}cula`, 'g'), 'matrícula'],
  [new RegExp(`M${R}s`, 'g'), 'Más'],
  [new RegExp(`pr${R}ximos`, 'g'), 'próximos'], // not in file but safe
];

let totalChanges = 0;
for (const [pattern, replacement] of replacements) {
  const matches = content.match(pattern);
  if (matches) {
    content = content.replace(pattern, replacement);
    totalChanges += matches.length;
    console.log(`  ${matches.length}x "${pattern.source.replace(/\\uFFFD/g,'')}" → "${replacement}"`);
  }
}

if (totalChanges > 0) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`\nTotal replacements: ${totalChanges}. File saved.`);
} else {
  console.log('\nNo additional corrections needed.');
}

// Final verification
const verify = fs.readFileSync(filePath, 'utf8');
const remaining = (verify.match(/\uFFFD/g) || []).length;
console.log(`Remaining  characters: ${remaining}`);