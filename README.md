# 🐰 ComeYa - Plataforma de Delivery

> Conectando negocios locales con la comunidad de Soria, España

[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![MySQL](https://img.shields.io/badge/mysql-8.0%2B-blue.svg)](https://www.mysql.com/)
[![React Native](https://img.shields.io/badge/React%20Native-0.76-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK%2054-000020.svg)](https://expo.dev/)

## 📖 Tabla de Contenidos

- [Acerca del Proyecto](#-acerca-del-proyecto)
- [Características Principales](#-características-principales)
- [Stack Tecnológico](#-stack-tecnológico)
- [Arquitectura](#-arquitectura)
- [Instalación](#️-instalación)
- [Funcionalidades](#-funcionalidades)
- [Sistema de Pagos](#-sistema-de-pagos)
- [Seguridad](#-seguridad)
- [Deployment](#-deployment)
- [Licencia](#-licencia)

## 🎯 Acerca del Proyecto

ComeYa es una plataforma de delivery moderna diseñada específicamente para Soria, España. La aplicación conecta restaurantes y negocios locales, repartidores y clientes en un ecosistema completo de pedidos en línea.

### ¿Por qué ComeYa?

- **🇪🇸 Hecho para Soria**: Pensado para el comercio local soriano, apoyando la economía de proximidad
- **🚀 Tecnología Moderna**: React Native + Expo para experiencia nativa en iOS y Android
- **💰 Transparente**: Comisiones claras y sistema de payouts automatizado
- **🔒 Seguro**: Anti-fraude con IA, verificación de comprobantes con OCR
- **📊 Inteligente**: Analytics en tiempo real, gamificación y recomendaciones con IA

### 📊 Números del Proyecto

- **28 Tablas** en base de datos MySQL
- **80+ Endpoints** API REST
- **12 Servicios** backend especializados
- **45+ Pantallas** frontend
- **10 Features** principales implementadas
- **0% Mock Data** - 100% datos reales

## ✨ Características Principales

### Para Clientes
- 📍 **Tracking en Tiempo Real**: Seguimiento GPS del repartidor con ETA dinámico actualizado cada 30s
- 📸 **Reseñas Mejoradas**: Calificaciones separadas (comida, entrega, empaque, repartidor) con hasta 3 fotos
- 🎁 **Gift Cards**: Compra y envía tarjetas regalo personalizadas con múltiples diseños
- 👥 **Pedidos Grupales**: Organiza pedidos con amigos, divide el costo y comparte link único
- 🎮 **Gamificación**: Gana puntos, desbloquea logros y canjea recompensas (4 tiers: Bronze → Platinum)
- 📱 **Modo Offline**: Navega y prepara pedidos sin conexión con caché inteligente
- 🔔 **Notificaciones Inteligentes**: Alertas personalizadas según tu comportamiento
- ⭐ **Favoritos y Recomendaciones**: IA que aprende tus preferencias
- 📅 **Pedidos Programados**: Agenda pedidos para después
- 💬 **Chat en Vivo**: Comunícate con tu repartidor
- 🎯 **Propinas**: Agradece a tu repartidor

### Para Negocios
- 📊 **Analytics Avanzado**: Dashboard con métricas en tiempo real
- 📈 **Gráficos de Ventas**: Visualiza tendencias diarias, semanales y mensuales
- 🏆 **Sistema de Niveles**: Bronze, Silver, Gold, Platinum con beneficios progresivos
- 🚫 **Modo Saturado**: Control automático de capacidad cuando hay muchos pedidos
- 📝 **Menú 86**: Marca productos agotados temporalmente
- 💸 **Payouts Automáticos**: Sistema de pagos transparente
- 🔝 **Top Productos**: Identifica tus productos más vendidos
- ⏰ **Horas Pico**: Analiza cuándo tienes más demanda
- 💬 **Responder Reseñas**: Interactúa con tus clientes
- 📊 **Comparativa Semanal**: Compara tu rendimiento semana a semana

### Para Repartidores
- 📍 **Navegación Integrada**: Rutas optimizadas con Google Maps
- 💰 **Ganancias en Tiempo Real**: Visualiza tus ingresos al instante
- 📸 **Prueba de Entrega**: Foto y GPS para validar entregas
- 📅 **Historial Completo**: Todas tus entregas y estadísticas
- 🎯 **Asignación Inteligente**: Pedidos asignados según tu ubicación
- 🔔 **Alertas de Proximidad**: Notificaciones automáticas al acercarte

### Para Administradores
- 🔍 **Panel de Control**: Gestión completa de la plataforma
- ✅ **Verificación de Pagos**: OCR automático con Google Gemini
- 🚨 **Anti-Fraude**: Detección automática de comprobantes duplicados
- 📊 **Métricas Globales**: KPIs de toda la plataforma
- 📝 **Audit Logs**: Registro de todas las acciones críticas
- 💸 **Gestión de Payouts**: Aprueba y marca pagos como completados
- 👥 **Gestión de Usuarios**: Bloquea, desbloquea y gestiona usuarios

## 🚀 Stack Tecnológico

### Frontend
- **Framework**: React Native 0.76 + Expo SDK 54
- **Lenguaje**: TypeScript
- **Estado**: React Query (TanStack Query) para cache y sincronización
- **Navegación**: React Navigation 6
- **UI/UX**: 
  - Expo Image (imágenes optimizadas)
  - React Native Reanimated (animaciones fluidas)
  - Expo Haptics (feedback táctil)
  - LinearGradient (gradientes)
- **Mapas**: react-native-maps + Google Maps API
- **Gráficos**: react-native-chart-kit (LineChart, BarChart)
- **Offline**: AsyncStorage + NetInfo
- **Notificaciones**: Expo Notifications
- **Compartir**: Share API + Linking API

### Backend
- **Framework**: Express.js + TypeScript
- **Runtime**: Node.js 18+
- **Base de Datos**: MySQL 8.0+ (Aiven Cloud)
- **ORM**: Drizzle ORM
- **Autenticación**: JWT + Refresh Tokens
- **Validación**: Zod

### Servicios Externos
- **SMS/OTP**: Twilio Verify
- **IA/OCR**: Google Gemini 1.5 Flash (extracción de datos de comprobantes)
- **Emails**: Resend
- **Mapas**: Google Maps Platform
- **Push**: Expo Push Notifications

### DevOps
- **Hosting Backend**: Render
- **Base de Datos**: Aiven MySQL (Cloud)
- **Control de Versiones**: Git + GitHub
- **Build**: esbuild (backend), Expo EAS (mobile)

## 🎨 Diseño

- **Colores**: Paleta crema cálida (#E8B4A8, #D4A89C, #F5F1EB)
- **Modo Oscuro**: Automático con soporte completo
- **Tema**: Cálido y acogedor, inspirado en la gastronomía tradicional soriana
- **Iconos**: Feather Icons
- **Fuentes**: Sistema nativo optimizado

## 📋 Requisitos

- Node.js 18+
- MySQL 8.0+ (o cuenta Aiven)
- npm o yarn
- Android Studio + SDK (para builds Android)
- Xcode (para builds iOS, solo macOS)

## 🛠️ Instalación

```bash
# Clonar repositorio
git clone https://github.com/ComeYaApp/ComeYa.git
cd ComeYa

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# Aplicar schema a la base de datos
npm run db:push

# Ejecutar migraciones (opcional)
mysql --host=<host> --port=<port> --user=avnadmin --password=<pass> --ssl-mode=REQUIRED defaultdb < migrations/complete_features.sql
```

## 🔧 Variables de Entorno

```env
# Base de Datos (Aiven)
DATABASE_URL=mysql://user:password@host:port/defaultdb?ssl-mode=REQUIRED
DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_NAME=defaultdb

# JWT
JWT_SECRET=tu_secret_super_seguro
REFRESH_SECRET=tu_refresh_secret

# App
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:8081
BACKEND_URL=http://localhost:5000
EXPO_PUBLIC_BACKEND_URL=https://tu-backend.onrender.com

# Google Maps + Gemini
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=tu_google_maps_key
GEMINI_API_KEY=tu_gemini_key

# Twilio
TWILIO_ACCOUNT_SID=tu_account_sid
TWILIO_AUTH_TOKEN=tu_auth_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_VERIFY_SERVICE_SID=tu_verify_service_sid

# Cuenta receptora ComeYa
COMEYA_BIZUM_PHONE=600000000
COMEYA_IBAN=ES00 0000 0000 0000 0000 0000

# Comisiones (%)
COMEYA_COMMISSION=15
BUSINESS_COMMISSION=100
DRIVER_COMMISSION=100

# Resend (Opcional)
RESEND_API_KEY=tu_resend_key
```

## 🚀 Desarrollo

```bash
# Backend (puerto 5000)
npm run server:dev

# Frontend (puerto 8081)
npm run expo:dev

# Build backend
npm run server:build

# Linting
npm run lint

# Type checking
npm run check:types
```

## 📊 Base de Datos

El schema completo está en `shared/schema-mysql.ts` usando Drizzle ORM.

```bash
# Aplicar cambios al schema
npm run db:push

# Backup de la base de datos
mysqldump -u root -p defaultdb > backup.sql

# Restaurar backup
mysql -u root -p defaultdb < backup.sql
```

### Migraciones Manuales

```bash
# Ejecutar contra Aiven MySQL
mysql --host=comeya-comeya.d.aivencloud.com \
      --port=28942 \
      --user=avnadmin \
      --password=<password> \
      --ssl-mode=REQUIRED \
      defaultdb < migrations/complete_features.sql
```

## 🏗️ Estructura del Proyecto

```
ComeYa/
├── client/                        # Frontend React Native
│   ├── components/                # Componentes reutilizables
│   │   ├── CollapsibleMap.tsx     # Mapa con tracking
│   │   ├── OrderProgressBar.tsx   # Barra de progreso
│   │   ├── OfflineIndicator.tsx   # Indicador de conexión
│   │   └── ...
│   ├── screens/                   # Pantallas de la app (45+)
│   │   ├── OrderTrackingScreen.tsx
│   │   ├── ReviewScreenEnhanced.tsx
│   │   ├── BusinessAnalyticsScreen.tsx
│   │   ├── GroupOrderScreen.tsx
│   │   ├── GamificationScreen.tsx
│   │   ├── GiftCardsScreen.tsx
│   │   └── ...
│   ├── services/                  # Servicios cliente
│   │   ├── SocialIntegrationService.ts
│   │   ├── OfflineCacheService.ts
│   │   └── OfflineAPI.ts
│   ├── hooks/                     # Custom hooks
│   │   ├── useOffline.ts
│   │   └── useTheme.ts
│   ├── contexts/                  # Context API
│   │   ├── AuthContext.tsx
│   │   └── ToastContext.tsx
│   ├── navigation/                # RootStackNavigator
│   ├── constants/theme.ts         # Design system
│   └── lib/query-client.ts        # API client
├── server/                        # Backend Express
│   ├── routes/                    # Rutas API organizadas
│   │   ├── enhancedTracking.ts
│   │   ├── enhancedReviews.ts
│   │   ├── businessAnalytics.ts
│   │   ├── groupOrders.ts
│   │   ├── gamification.ts
│   │   ├── giftCards.ts
│   │   └── ...
│   ├── enhancedTrackingService.ts
│   ├── enhancedReviewService.ts
│   ├── businessAnalyticsService.ts
│   ├── groupOrderService.ts
│   ├── gamificationService.ts
│   ├── giftCardService.ts
│   ├── smartNotificationService.ts
│   ├── digitalPaymentService.ts
│   ├── autoVerificationService.ts
│   ├── payoutService.ts
│   ├── fundReleaseService.ts
│   ├── partnerLevelService.ts
│   └── server.ts
├── shared/
│   └── schema-mysql.ts            # Schema Drizzle ORM (28 tablas)
└── migrations/                    # SQL migrations manuales
    └── complete_features.sql
```

## 🏛️ Arquitectura

### Base de Datos (28 Tablas)

**Core:**
- `users` - Usuarios del sistema (clientes, negocios, repartidores, admins)
- `businesses` - Negocios registrados con ubicación y configuración
- `products` - Catálogo de productos con precios y disponibilidad
- `orders` - Pedidos con estado y tracking completo
- `addresses` - Direcciones de entrega de usuarios

**Pagos y Finanzas:**
- `wallets` - Billeteras con balance disponible y pendiente
- `transactions` - Historial contable de todas las transacciones
- `payments` - Registro de pagos procesados
- `payouts` - Pagos pendientes a negocios/drivers
- `payment_accounts` - Cuentas de pago configuradas por usuarios
- `payment_methods` - Métodos de pago disponibles (Pago Móvil, Binance, etc)
- `payment_proofs` - Comprobantes de pago subidos
- `pago_movil_verifications` - Verificaciones de Pago Móvil con OCR

**Delivery:**
- `delivery_drivers` - Repartidores con ubicación y estadísticas
- `delivery_zones` - Zonas de entrega con tarifas
- `delivery_proofs` - Pruebas de entrega con foto y GPS
- `proximity_alerts` - Alertas de proximidad (500m, 200m, 50m)
- `delivery_heatmap` - Mapa de calor de entregas

**Features Avanzadas:**
- `reviews` - Reseñas con ratings separados
- `review_responses` - Respuestas de negocios a reseñas
- `review_tags` - Tags predefinidos (Delicioso, Rápido, etc)
- `group_orders` - Pedidos grupales con share token
- `group_order_participants` - Participantes con items y pagos
- `group_order_invitations` - Invitaciones a grupos
- `subscriptions` - Suscripciones premium (Free, Premium, Business)
- `subscription_benefits` - Beneficios por plan
- `gift_cards` - Tarjetas regalo con código único
- `gift_card_transactions` - Transacciones de gift cards
- `gift_card_designs` - Diseños disponibles (cumpleaños, navidad, etc)

**Gamificación:**
- `loyalty_points` - Puntos de lealtad por usuario
- `loyalty_transactions` - Historial de puntos ganados/gastados
- `loyalty_rewards` - Recompensas canjeables
- `loyalty_redemptions` - Canjes realizados
- `loyalty_challenges` - Desafíos activos
- `loyalty_challenge_progress` - Progreso en desafíos
- `achievements` - Logros disponibles
- `user_achievements` - Logros desbloqueados por usuarios

**IA y Soporte:**
- `user_favorites` - Favoritos de usuarios (negocios y productos)
- `user_preferences` - Preferencias para recomendaciones IA
- `ai_recommendations` - Recomendaciones generadas por IA
- `scheduled_orders` - Pedidos programados con recurrencia
- `support_tickets` - Tickets de soporte
- `support_chats` - Chats de soporte con IA
- `support_messages` - Mensajes de chat

**Sistema:**
- `refresh_tokens` - Tokens de autenticación
- `audit_logs` - Logs de auditoría de acciones críticas
- `system_settings` - Configuración global de la plataforma
- `coupons` - Cupones de descuento
- `coupon_usage` - Uso de cupones por usuario
- `call_logs` - Logs de llamadas automáticas a negocios

### Servicios Backend (12)

1. **enhancedTrackingService.ts**
   - Cálculo de distancia con fórmula Haversine
   - ETA dinámico basado en velocidad promedio (30 km/h)
   - Alertas de proximidad automáticas (500m, 200m, 50m)
   - Alertas de tiempo (5 min, 2 min)

2. **enhancedReviewService.ts**
   - Ratings separados (food, delivery, packaging, driver)
   - Subida de hasta 3 fotos
   - Tags predefinidos con categorías
   - Respuestas de negocios a reseñas

3. **businessAnalyticsService.ts**
   - Dashboard con métricas en tiempo real
   - Top productos más vendidos
   - Análisis de horas pico
   - Gráficos de ventas diarias
   - Comparativa semanal

4. **groupOrderService.ts**
   - Crear grupos con share token único
   - Agregar participantes
   - Split de pago automático
   - Cerrar grupo y crear pedido unificado

5. **gamificationService.ts**
   - Sistema de puntos con 4 tiers
   - Leaderboard con top 50 usuarios
   - Achievements desbloqueables
   - Recompensas canjeables

6. **giftCardService.ts**
   - Generación de códigos únicos
   - Compra y validación
   - Redención en checkout
   - Historial de transacciones

7. **smartNotificationService.ts**
   - Segmentación por comportamiento
   - Notificaciones de reactivación
   - Recordatorios de hora de comida
   - Promociones personalizadas

8. **digitalPaymentService.ts**
   - OCR con Google Gemini
   - Extracción automática de datos
   - Validación de comprobantes

9. **autoVerificationService.ts**
   - Detección de comprobantes duplicados
   - Bloqueo automático por fraude
   - Logs de auditoría

10. **payoutService.ts**
    - Creación automática de payouts
    - Cálculo de comisiones
    - Gestión de pagos pendientes

11. **fundReleaseService.ts**
    - Liberación de fondos al confirmar entrega
    - Creación de payouts para negocio y driver

12. **partnerLevelService.ts**
    - Actualización automática de niveles
    - Beneficios por tier
    - Tracking de métricas

### API Endpoints (80+)

**Tracking (3):**
- `GET /api/tracking/eta/:orderId` - ETA dinámico actualizado cada 30s
- `GET /api/tracking/proximity/:orderId` - Alertas de proximidad
- `GET /api/delivery/location/:orderId` - Ubicación GPS del repartidor

**Reviews (5):**
- `GET /api/reviews/tags` - Tags predefinidos con iconos
- `POST /api/reviews` - Crear reseña con ratings separados
- `POST /api/reviews/:reviewId/response` - Responder reseña (negocio)
- `GET /api/reviews/business/:businessId` - Reseñas de un negocio
- `GET /api/reviews/order/:orderId` - Reseña de un pedido

**Analytics (6):**
- `GET /api/analytics/dashboard/:businessId?period=week` - Dashboard principal
- `GET /api/analytics/top-products/:businessId?limit=10` - Productos más vendidos
- `GET /api/analytics/peak-hours/:businessId` - Horas pico con gráfico
- `GET /api/analytics/sales-chart/:businessId?days=7` - Gráfico de ventas
- `GET /api/analytics/weekly-comparison/:businessId` - Comparativa semanal
- `GET /api/analytics/review-stats/:businessId` - Estadísticas de reseñas

**Group Orders (4):**
- `POST /api/group-orders/create` - Crear pedido grupal
- `GET /api/group-orders/:groupOrderId` - Detalles del grupo
- `POST /api/group-orders/:groupOrderId/join` - Unirse al grupo
- `POST /api/group-orders/:groupOrderId/lock` - Cerrar y crear pedido

**Gamification (5):**
- `GET /api/gamification/points` - Puntos y tier del usuario
- `GET /api/gamification/rewards` - Recompensas disponibles
- `GET /api/gamification/achievements` - Logros (unlocked + locked)
- `GET /api/gamification/leaderboard?limit=50` - Ranking global
- `POST /api/gamification/redeem/:rewardId` - Canjear recompensa

**Gift Cards (4):**
- `GET /api/gift-cards/designs` - Diseños disponibles
- `POST /api/gift-cards/purchase` - Comprar gift card
- `GET /api/gift-cards/my-cards` - Tarjetas compradas/recibidas
- `POST /api/gift-cards/validate` - Validar código en checkout

**Subscriptions (4):**
- `GET /api/subscriptions/plans` - Planes disponibles
- `POST /api/subscriptions/subscribe` - Suscribirse a un plan
- `POST /api/subscriptions/cancel` - Cancelar suscripción
- `GET /api/subscriptions/my-subscription` - Suscripción actual

**Notifications (5):**
- `POST /api/notifications/register-token` - Registrar token push
- `POST /api/notifications/send-campaign` - Enviar campaña (admin)
- `GET /api/notifications/segments` - Segmentos disponibles
- `POST /api/notifications/test` - Enviar notificación de prueba
- `GET /api/notifications/history` - Historial de notificaciones

**Favorites (3):**
- `GET /api/favorites` - Favoritos del usuario
- `POST /api/favorites` - Agregar a favoritos
- `DELETE /api/favorites/:favoriteId` - Quitar de favoritos

**Scheduled Orders (3):**
- `GET /api/scheduled-orders` - Pedidos programados
- `POST /api/scheduled-orders` - Crear pedido programado
- `DELETE /api/scheduled-orders/:id` - Cancelar pedido programado

**Support (4):**
- `GET /api/support/tickets` - Tickets del usuario
- `POST /api/support/tickets` - Crear ticket
- `GET /api/support/tickets/:ticketId/messages` - Mensajes del ticket
- `POST /api/support/tickets/:ticketId/messages` - Enviar mensaje

**Y más:** Auth, Orders, Business, Delivery, Payments, Wallet, Admin, etc.

## 💳 Sistema de Pagos

ComeYa opera en España con los métodos de pago habituales del mercado español.

### Métodos Soportados
- **Bizum** (método principal) - Pagos instantáneos entre móviles
- **Transferencia bancaria** - SEPA / IBAN
- **Tarjeta** - Crédito y débito (Stripe)
- **Efectivo** - Pago contra entrega

### Comisiones
- **ComeYa**: 15% de markup sobre precio base de productos
- **Negocio**: 100% del precio base de sus productos
- **Repartidor**: 100% de la tarifa de entrega

### Flujo de Pago Completo

1. **Cliente realiza pedido**
   - Selecciona productos y método de pago
   - Realiza transferencia a cuenta de ComeYa
   
2. **Cliente sube comprobante**
   - Toma foto del comprobante
   - OCR con Google Gemini extrae datos automáticamente
   - Sistema valida referencia, monto, banco

3. **Admin verifica comprobante**
   - Anti-fraude detecta duplicados automáticamente
   - Admin aprueba o rechaza manualmente
   - Sistema bloquea usuarios tras 3 intentos fraudulentos

4. **Negocio prepara pedido**
   - Recibe notificación del pedido confirmado
   - Prepara los productos
   - Marca como listo para recoger

5. **Repartidor recoge y entrega**
   - Recibe asignación automática
   - Navega con Google Maps
   - Marca como entregado con foto y GPS

6. **Cliente confirma recepción**
   - Confirma que recibió el pedido
   - Sistema libera fondos automáticamente
   - Se crean **payouts** para negocio y repartidor

7. **Admin transfiere pagos**
   - Ve lista de payouts pendientes
   - Transfiere manualmente a cuentas registradas
   - Marca payout como pagado

### Cuentas de Pago (`payment_accounts`)

Cada usuario (negocio/repartidor) registra sus cuentas destino en `PaymentWalletSetupScreen`:
- Bizum: número de teléfono
- Transferencia: IBAN y titular
- Tarjeta: gestionado vía Stripe Connect

El admin usa estas cuentas para saber a dónde transferir los payouts.

### Anti-fraude Automático

- **Deduplicación**: Detecta comprobantes con misma referencia
- **Bloqueo automático**: 3 intentos fraudulentos en 7 días = cuenta bloqueada
- **Audit logs**: Todas las acciones quedan registradas
- **OCR inteligente**: Google Gemini valida datos del comprobante

## 📱 Funcionalidades Detalladas

### 🎯 Para Clientes

#### Exploración y Pedidos
- Explorar negocios por categoría (restaurantes, mercados)
- Filtrar por rating, tiempo de entrega, precio
- Ver menú completo con fotos y descripciones
- Agregar productos al carrito
- Aplicar cupones de descuento
- Seleccionar dirección de entrega
- Elegir método de pago

#### Tracking en Tiempo Real
- Mapa con ubicación del repartidor (actualización cada 10s)
- ETA dinámico actualizado cada 30s
- Alertas de proximidad (500m, 200m, 50m)
- Alertas de tiempo (5 min, 2 min)
- Foto del repartidor en pantalla de tracking
- Botón para llamar o chatear con repartidor

#### Reseñas Mejoradas
- Calificar 4 aspectos separados (comida, entrega, empaque, repartidor)
- Subir hasta 3 fotos de tu pedido
- Seleccionar tags predefinidos (Delicioso, Rápido, Bien empacado, etc)
- Escribir comentario opcional
- Ver respuestas de negocios

#### Pedidos Grupales
- Crear grupo y compartir link único
- Invitar amigos por WhatsApp/redes sociales
- Cada participante elige sus productos
- Split automático del costo de envío
- Cerrar grupo y crear pedido unificado

#### Gamificación
- Ganar puntos por cada pedido
- 4 tiers: Bronze → Silver → Gold → Platinum
- Desbloquear achievements (Primera orden, 10 pedidos, etc)
- Ver leaderboard con top 50 usuarios
- Canjear puntos por recompensas (descuentos, envío gratis, etc)

#### Gift Cards
- Comprar tarjetas regalo con montos personalizados
- Elegir diseño (cumpleaños, navidad, general, etc)
- Enviar a amigos con mensaje personalizado
- Canjear en checkout con código único
- Ver historial de transacciones

#### Modo Offline
- Navegar negocios y productos sin conexión
- Preparar pedidos offline
- Cola de sincronización automática
- Caché inteligente con TTL configurable
- Indicador de conexión animado

#### Otras Features
- Favoritos con sincronización en la nube
- Pedidos programados (una vez o recurrentes)
- Recomendaciones IA basadas en historial
- Chat de soporte con IA
- Compartir pedidos en redes sociales
- Sistema de propinas para repartidores

### 🏪 Para Negocios

#### Gestión de Pedidos
- Panel en tiempo real de pedidos activos
- Aceptar/rechazar pedidos
- Marcar como preparando/listo
- Modo saturado cuando hay muchos pedidos
- Menú 86 para productos agotados

#### Analytics Avanzado
- Dashboard con métricas del período seleccionado
- Total de pedidos con % de cambio
- Ingresos totales con % de cambio
- Ticket promedio
- Rating promedio con total de reseñas
- Gráfico de ventas diarias (LineChart)
- Top 10 productos más vendidos
- Horas pico con gráfico de barras
- Comparativa semanal (esta semana vs anterior)

#### Sistema de Niveles
- **Bronze**: Nivel inicial
- **Silver**: 50+ pedidos completados
- **Gold**: 200+ pedidos + €5,000 generados
- **Platinum**: 500+ pedidos + €20,000 generados

Beneficios por nivel:
- Comisión reducida
- Prioridad en búsquedas
- Badge especial
- Soporte prioritario

#### Gestión de Productos
- Agregar/editar/eliminar productos
- Subir fotos de productos
- Organizar por categorías
- Marcar como no disponible (Menú 86)
- Control de stock

#### Responder Reseñas
- Ver todas las reseñas recibidas
- Responder públicamente a clientes
- Mejorar rating y reputación

### 🚗 Para Repartidores

#### Gestión de Entregas
- Ver pedidos disponibles cerca de ti
- Aceptar pedidos manualmente
- Navegación integrada con Google Maps
- Marcar como recogido/entregado
- Subir foto de entrega con GPS

#### Ganancias
- Ver ganancias en tiempo real
- Historial completo de entregas
- Estadísticas de rendimiento
- Payouts pendientes y pagados

#### Tracking GPS
- Ubicación actualizada automáticamente
- Alertas de proximidad para cliente
- Ruta completa registrada
- Validación de ubicación en entrega

### 👨‍💼 Para Administradores

#### Panel de Control
- Métricas globales de la plataforma
- Total de usuarios, negocios, repartidores
- Pedidos activos en tiempo real
- Ingresos del día/semana/mes

#### Verificación de Pagos
- Lista de comprobantes pendientes
- OCR automático con Google Gemini
- Aprobar/rechazar con un click
- Ver historial de verificaciones

#### Gestión de Payouts
- Lista de payouts pendientes
- Filtrar por negocio/repartidor
- Marcar como pagado con notas
- Historial de pagos realizados

#### Anti-fraude
- Detección automática de duplicados
- Bloqueo automático de usuarios fraudulentos
- Audit logs de todas las acciones
- Estadísticas de fraude

#### Gestión de Usuarios
- Ver todos los usuarios
- Bloquear/desbloquear cuentas
- Cambiar roles
- Ver historial de actividad

## 🔐 Seguridad

### Autenticación
- **Twilio Verify OTP**: Verificación por SMS
- **JWT**: Tokens de acceso con expiración
- **Refresh Tokens**: Renovación automática de sesión
- **Biométrica**: Soporte para huella/Face ID (opcional)

### Autorización
- **RBAC**: 5 roles (customer, business_owner, delivery_driver, admin, super_admin)
- **Middleware**: Validación de permisos en cada endpoint
- **Ownership**: Validación de propiedad de recursos

### Anti-fraude
- **OCR con IA**: Google Gemini valida comprobantes
- **Deduplicación**: Detecta referencias duplicadas
- **Bloqueo automático**: 3 intentos = cuenta bloqueada por 7 días
- **Audit logs**: Registro de todas las acciones críticas

### Protección de Datos
- **Encriptación**: Contraseñas con bcrypt
- **SSL/TLS**: Conexiones seguras a base de datos
- **Rate limiting**: Protección contra ataques
- **Validación**: Zod en todos los inputs

## 🚀 Deployment

### Backend (Render)

1. **Conectar repositorio GitHub**
2. **Configurar build command:**
   ```bash
   npm install && npm run server:build
   ```
3. **Configurar start command:**
   ```bash
   node server_dist/server.js
   ```
4. **Agregar variables de entorno** (ver sección Variables de Entorno)
5. **Deploy automático** en cada push a main

### Frontend (Expo)

#### Development
```bash
# Iniciar servidor de desarrollo
npm run expo:dev

# Escanear QR con Expo Go app
```

#### Production Build

```bash
# Instalar EAS CLI
npm install -g eas-cli

# Login
eas login

# Configurar proyecto
eas build:configure

# Build Android
eas build --platform android --profile production

# Build iOS
eas build --platform ios --profile production

# Submit a stores
eas submit --platform android
eas submit --platform ios
```

### Base de Datos (Aiven MySQL)

1. **Crear cluster MySQL** en Aiven
2. **Configurar SSL** (requerido)
3. **Ejecutar migraciones:**
   ```bash
   mysql --host=<host> --port=<port> --user=avnadmin --password=<pass> --ssl-mode=REQUIRED defaultdb < migrations/complete_features.sql
   ```
4. **Configurar backups automáticos** en Aiven

## 📦 Build Android Local

```bash
# Prebuild (regenera carpeta android/)
npx expo prebuild --platform android --clean

# Compilar APK release
cd android
gradlew assembleRelease

# APK generado en:
# android/app/build/outputs/apk/release/app-release.apk
```

> **Nota Windows**: `gradle.properties` tiene `reactNativeArchitectures=arm64-v8a` para evitar el error de rutas >260 caracteres.

## 🧪 Testing

```bash
# Linting
npm run lint

# Type checking
npm run check:types

# Build backend (verifica que compila)
npm run server:build
```

## 📈 Roadmap

### ✅ Completado (v1.0)
- [x] Sistema de autenticación con OTP
- [x] Pedidos con múltiples métodos de pago
- [x] Tracking GPS en tiempo real
- [x] Sistema de pagos manual con OCR
- [x] Anti-fraude automático
- [x] Payouts para negocios y repartidores
- [x] Reseñas mejoradas con fotos
- [x] Analytics para negocios
- [x] Pedidos grupales
- [x] Gamificación con puntos y logros
- [x] Gift cards
- [x] Modo offline
- [x] Integración social

### 🔜 Próximamente (v1.1)
- [ ] Pagos automáticos con Stripe
- [ ] Chat en vivo con soporte humano
- [ ] Programa de referidos con recompensas
- [ ] Suscripciones premium activas
- [ ] Precios dinámicos por demanda
- [ ] Predicción de demanda con ML
- [ ] App para negocios (tablet)

### 🎯 Futuro (v2.0)
- [ ] Marketplace de productos
- [ ] Integración con POS de negocios
- [ ] API pública para terceros
- [ ] Programa de afiliados
- [ ] Expansión a otras provincias de Castilla y León

## 🤝 Contribuir

Este es un proyecto propietario. Para contribuir:

1. Contacta al equipo de desarrollo
2. Firma NDA si es necesario
3. Fork el repositorio (privado)
4. Crea una rama: `git checkout -b feature/nueva-feature`
5. Commit: `git commit -m 'feat: Nueva feature'`
6. Push: `git push origin feature/nueva-feature`
7. Abre un Pull Request

### Convenciones de Commits

```
feat: Nueva funcionalidad
fix: Corrección de bug
docs: Documentación
style: Formato de código
refactor: Refactorización
test: Tests
chore: Mantenimiento
```

## 📞 Soporte

- **Email**: support@comeya.es
- **Teléfono**: +34 900 XXX XXX
- **Documentación**: [docs.comeya.es](https://docs.comeya.es)
- **Issues**: GitHub Issues (privado)

## 👥 Equipo

- **Founder & CEO**: Alexandra Goicoechea
- **Lead Developer**: [Tu nombre]
- **Backend**: Express.js + MySQL
- **Frontend**: React Native + Expo
- **DevOps**: Render + Aiven

## 📄 Licencia

Propietario — ComeYa © 2026

Todos los derechos reservados. Este software es propiedad de ComeYa y está protegido por leyes de derechos de autor. No se permite la reproducción, distribución o uso comercial sin autorización expresa.

---

## 🌟 Agradecimientos

- **Twilio** - SMS y verificación OTP
- **Google** - Maps API y Gemini AI
- **Aiven** - Hosting de base de datos
- **Render** - Hosting de backend
- **Expo** - Framework de desarrollo móvil
- **Comunidad Open Source** - Por las increíbles herramientas

---

**Hecho con ❤️ en Soria, España**

*ComeYa - Conectando sabores, apoyando el comercio local* 🐰🍔
