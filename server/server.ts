import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from 'dotenv';
import { validateEnv } from './env';
import { createServer } from 'http';
import { initializeWebSocket } from './websocket';

// Cargar variables de entorno antes de todo
config({ path: '.env.local', override: true });
config({ path: '.env', override: false });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

validateEnv();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
const ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:3000',
  'https://comeya.es',
  'https://www.comeya.es',
  'https://app.comeya.es',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Permitir requests sin origin (mobile, Postman, etc)
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS bloqueado: ${origin}`));
  },
  credentials: true,
}));

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 500 : 10000,
  message: 'Too many requests from this IP',
  skip: (req) => {
    // No aplicar rate limit a endpoints de polling frecuente con auth
    const skipPaths = ['/api/orders', '/api/delivery/location', '/api/tracking'];
    return skipPaths.some(p => req.path.startsWith(p.replace('/api', '')));
  },
}));

app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// Stripe webhook necesita raw body para verificar firma
app.use('/api/connect/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Forzar charset UTF-8 en todas las respuestas JSON
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return originalJson(body);
  };
  next();
});

// Serve uploaded files
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Serve public folder (privacy-policy, logos, etc.) — disponible en todos los entornos
app.use(express.static(path.join(process.cwd(), 'public'), { index: false }));
app.get('/privacy-policy', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'privacy-policy.html'));
});

// Serve client assets (logo, splash, etc.)
app.use('/assets', express.static(path.join(process.cwd(), 'client/assets')));

// ─── API ROUTES (modular) ─────────────────────────────────────────────────────
import apiRouter from './routes';
app.use('/api', apiRouter);

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── STATIC / SPA ─────────────────────────────────────────────────────────────
if (isProduction) {
  app.use(express.static(path.join(process.cwd(), 'dist')));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') return next();
    res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({ message: 'MOUZO API Server', frontend: process.env.FRONTEND_URL || 'http://localhost:8081' });
  });
}

// ─── ERROR HANDLING ───────────────────────────────────────────────────────────
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ─── START ────────────────────────────────────────────────────────────────────
const server = httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Inicializar WebSocket
  initializeWebSocket(httpServer);
  console.log('🔌 WebSocket initialized');

  if (!process.env.TWILIO_ACCOUNT_SID) console.warn('⚠️  Twilio not configured');
  if (!process.env.MOUZO_PAGO_MOVIL_PHONE) console.warn('⚠️  Pago Móvil no configurado - agrega MOUZO_PAGO_MOVIL_PHONE en .env');

  import('./businessHoursCron').then(({ startBusinessHoursCron }) => startBusinessHoursCron()).catch(console.error);
  import('./weeklySettlementCron').then(({ WeeklySettlementCron }) => WeeklySettlementCron.start()).catch(console.error);
  import('./autoConfirmDeliveryCron').then(({ startAutoConfirmCron }) => startAutoConfirmCron()).catch(console.error);
  import('./pickupNotificationCron').then(({ startPickupNotificationCron }) => startPickupNotificationCron()).catch(console.error);
});
