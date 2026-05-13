const BACKEND = 'https://comeya-backend.onrender.com';
const APP_URL  = 'https://app.comeya.es';

const ROLE_ROUTES = {
  customer:        '/home',
  business_owner:  '/business-dashboard',
  delivery_driver: '/driver-dashboard',
  admin:           '/admin',
  super_admin:     '/admin',
};

// ── Estado UI ─────────────────────────────────────────────────────────────────
let authMode = 'sms'; // 'sms' | 'password'
let loading   = false;

function setMode(m) {
  authMode = m;
  document.getElementById('mode-sms').classList.toggle('active', m === 'sms');
  document.getElementById('mode-pass').classList.toggle('active', m === 'password');
  document.getElementById('field-sms').style.display      = m === 'sms'      ? 'block' : 'none';
  document.getElementById('field-password').style.display = m === 'password' ? 'block' : 'none';
  document.getElementById('submit-btn').textContent = m === 'sms' ? 'Enviar código' : 'Iniciar sesión';
}

function setLoading(v) {
  loading = v;
  const btn = document.getElementById('submit-btn');
  btn.disabled = v;
  btn.textContent = v ? '...' : (authMode === 'sms' ? 'Enviar código' : 'Iniciar sesión');
}

function showError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

function showSuccess(msg) {
  const el = document.getElementById('auth-success');
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

// ── Redirect tras login ───────────────────────────────────────────────────────
function redirectToApp(token, refreshToken, role, userData) {
  const params = new URLSearchParams({
    token,
    refresh: refreshToken || '',
    role,
    name: userData.name || '',
  });
  // Redirigir a la raíz con query params — Expo Web sirve todo desde /
  window.location.href = `${APP_URL}/?${params.toString()}`;
}

// ── Login por SMS ─────────────────────────────────────────────────────────────
async function handleSMS() {
  const raw = document.getElementById('input-phone').value.trim();
  if (!raw) { showError('Ingresa tu número de teléfono'); return; }

  const digits = raw.replace(/\D/g, '');
  const phone  = digits.startsWith('34') ? `+${digits}` : digits.length === 9 ? `+34${digits}` : `+${digits}`;

  setLoading(true); showError('');
  try {
    const res  = await fetch(`${BACKEND}/api/auth/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();

    if (data.userNotFound) {
      showError('Cuenta no encontrada. Regístrate primero.');
      setTimeout(() => { window.location.href = `${APP_URL}/signup?phone=${encodeURIComponent(phone)}`; }, 1500);
      return;
    }

    // Mostrar campo OTP
    document.getElementById('field-sms').style.display      = 'none';
    document.getElementById('field-otp').style.display      = 'block';
    document.getElementById('submit-btn').textContent       = 'Verificar código';
    document.getElementById('submit-btn').onclick           = () => handleOTP(phone);
    showSuccess(`Código enviado a ${phone}`);
  } catch (e) {
    showError('Error de conexión. Inténtalo de nuevo.');
  } finally { setLoading(false); }
}

// ── Verificar OTP ─────────────────────────────────────────────────────────────
async function handleOTP(phone) {
  const code = document.getElementById('input-otp').value.trim();
  if (!code || code.length < 4) { showError('Ingresa el código recibido'); return; }

  setLoading(true); showError(''); showSuccess('');
  try {
    const res  = await fetch(`${BACKEND}/api/auth/phone-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });
    const data = await res.json();
    if (!data.token) { showError(data.error || 'Código incorrecto'); return; }
    redirectToApp(data.token, data.refreshToken, data.user.role, data.user);
  } catch (e) {
    showError('Error de conexión. Inténtalo de nuevo.');
  } finally { setLoading(false); }
}

// ── Login por contraseña ──────────────────────────────────────────────────────
async function handlePassword() {
  const identifier = document.getElementById('input-identifier').value.trim();
  const password   = document.getElementById('input-password').value;
  if (!identifier || !password) { showError('Completa todos los campos'); return; }

  setLoading(true); showError('');
  try {
    const res  = await fetch(`${BACKEND}/api/auth/dev-email-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: identifier, password }),
    });
    const data = await res.json();
    if (!data.token) { showError(data.error || 'Credenciales incorrectas'); return; }
    redirectToApp(data.token, data.refreshToken, data.user.role, data.user);
  } catch (e) {
    showError('Error de conexión. Inténtalo de nuevo.');
  } finally { setLoading(false); }
}

// ── Submit handler ────────────────────────────────────────────────────────────
function handleSubmit() {
  if (loading) return;
  if (authMode === 'sms') handleSMS();
  else handlePassword();
}

// ── Toggle password visibility ────────────────────────────────────────────────
function togglePass() {
  const inp = document.getElementById('input-password');
  inp.type  = inp.type === 'password' ? 'text' : 'password';
}

// ── Enter key ─────────────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSubmit();
});

// ── Navbar scroll ─────────────────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  document.getElementById('nav').classList.toggle('scrolled', window.scrollY > 20);
});

// ── Mobile menu ───────────────────────────────────────────────────────────────
function toggleMenu() {
  const links = document.getElementById('nav-links');
  const open  = links.getAttribute('data-open') === '1';
  if (open) {
    links.removeAttribute('style');
    links.setAttribute('data-open', '0');
  } else {
    links.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:68px;left:0;right:0;background:#fff;padding:24px;gap:20px;border-bottom:1px solid #E0E0E0;z-index:99;box-shadow:0 8px 24px rgba(0,0,0,.1)';
    links.setAttribute('data-open', '1');
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setMode('sms');

  // Highlight store button by OS
  const ua = navigator.userAgent || '';
  const btns = document.querySelectorAll('.store-btn');
  if (/iPad|iPhone|iPod/.test(ua) && btns[0]) btns[0].style.background = '#DC2626';
  if (/Android/.test(ua)           && btns[1]) btns[1].style.background = '#DC2626';
});
