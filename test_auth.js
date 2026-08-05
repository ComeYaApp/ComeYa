// Prueba de endpoints auth en produccion (Render)
const https = require('https');
const PHONE = '+34620000123';
const API = 'https://comeya-backend.onrender.com/api/auth';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {}
    };
    const req = https.request(API + path, options, res => {
      let result = '';
      res.on('data', chunk => result += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, ...JSON.parse(result) }); }
        catch { resolve({ status: res.statusCode, raw: result }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function test() {
  console.log('=== TEST 1: Enviar codigo (send-code) ===');
  const r1 = await request('POST', '/send-code', { phone: PHONE });
  console.log('Resultado:', r1.requiresVerification ? '✅ OK - codigo enviado' : '❌', r1);

  console.log('\n=== TEST 2: Verificar con codigo correcto 123456 ===');
  const r2 = await request('POST', '/phone-login', { phone: PHONE, code: '123456' });
  if (r2.success && r2.token) {
    console.log('✅ LOGIN EXITOSO - token:', r2.token.substring(0, 20) + '...');
    console.log('   usuario:', r2.user.name, '- rol:', r2.user.role);
  } else {
    console.log('❌ FALLO:', r2.error || r2);
  }

  console.log('\n=== TEST 3: Verificar con codigo incorrecto 000000 ===');
  const r3 = await request('POST', '/phone-login', { phone: PHONE, code: '000000' });
  console.log('Status:', r3.status, '- Mensaje:', r3.error || 'sin error');
  console.log(r3.status === 400 ? '✅ Rechazado correctamente (codigo invalido)' : '⚠️ Comportamiento inesperado');

  console.log('\n=== TEST 4: Reintentar send-code ===');
  const r4 = await request('POST', '/send-code', { phone: PHONE });
  console.log(r4.requiresVerification ? '✅ OK - reenvio permitido' : '❌', r4);

  console.log('\n🎉 Todas las pruebas completadas.');
}

test().catch(e => console.error('Error:', e.message));