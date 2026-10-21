# PLAN-BACKPORT-COMEYA.md

Backport de correcciones PideFast → ComeYa (España). Plan validado contra el código real de `C:\CY` (ComeYa, 1.0.16, rama `main`) y `C:\PideFast` (app Venezuela, rama `main` @ `264ac52`; la rama `fix/comprobante-camara-importes-mapas` ya está fusionada en main).

## Estado de ejecución

Rama `backport/pidefast-fixes` (local, sin push). Un commit por fase:

| Fase | Commit | Contenido |
|---|---|---|
| 0 | `0ab0e110` | Documento del plan |
| 1 | `655ebe1e` | Seguridad: whitelist de roles, admins inactivos, /users sin secretos, reglas de super admin y auditoría |
| 2 | `f0c34eca` | Comisiones: fórmula compuesta, earnings al crear, liquidación unificada, auditorías, customerPrice/basePrice, CSV |
| 3 | `7deb8f16` | Verificaciones España: DNI/NIE, autónomo, dirección, vehículo, matrícula, excepción, request-documents, banner |
| 4 | `dc137130` | Panel admin: grupos y badges, buscador Ctrl+K con foco, salud, comprobantes nativos, AdminTab web móvil |
| 5 | `448eaf00` | App: calendario Android, direcciones, rating, chat IA + widget, OCR post-subida, límites de archivo |
| 6 | `e3605137` | Suscripciones por negocio, gift cards en céntimos y pestañas nativas |
| 7 | `ef5cc4f2` | Auditoría histórica read-only, checklist de regresión, notas 1.0.17 |
| — | `818e8b62` | Bundle `server_dist` reconstruido con los cambios |

Comprobaciones: aritmética 10 € al 15 % → 15,07 € (negocio 10,00 €, repartidor 2,50 €, ComeYa 2,57 €) y plan 10 % → producto 11,55 € / comisión 1,05 €; `npm run server:build` correcto; typecheck sin errores nuevos en los archivos tocados (el repo mantiene errores preexistentes). No se ha copiado marca, catálogo documental ni flujos de la app de referencia; los pagos de España quedan intactos.

Pendiente antes de producción: aplicar las migraciones en staging, ejecutar `node scripts/audit-historical-orders.js` (solo lectura), completar `docs/CHECKLIST-REGRESION-ESPANA.md`, push de la rama y PR.

## Estado verificado

- **C:\CY** = ComeYa España (1.0.16 build 23, 1022 commits, remoto ComeYaApp/ComeYa + backup gitsafe).
- **C:\PideFast** = app de Venezuela creada a partir de ComeYa 1.0.16 (commit base `7d6315a`), con todo el trabajo en `main`. Historiales separados → **aplicar manual por diff, nunca cherry-pick**.
- Bugs verificados con línea exacta durante la exploración (ver anexo de evidencia).

## Qué NO se porta (protegido)

Marca PideFast (nombre, naranja #FF6A00, logo, assets, com.pidefast.app), prefijos #PF, claves @PideFast_*, pidefast_pass. Moneda USDT/Bs, tasa de cambio, columnas currency='USDT', exchange_rate_usdt, total_bs. Pago Móvil/Binance y la eliminación de Stripe, Bizum, SEPA, PayPal y efectivo (ComeYa los conserva intactos). Catálogo documental venezolano (shared/venezuelaDocs.ts), cobertura San Cristóbal, teléfonos +58, zona horaria America/Caracas, textos legales VE/IVA 16%. Prompt IA de PideFast (San Cristóbal/Pago Móvil). Datos demo y semillas VE. Reconciliación histórica automática (en ComeYa solo pedidos nuevos). Modelo PideFast sin markup (ComeYa conserva 5% markup + comisión por plan).

## Modelo objetivo de precios (compuesto, según NOTAS 1.0.16 b18)

subtotal = round(base×1,05) · comisión = round(subtotal×tasa del plan) · total = subtotal + comisión + envío + 0,49 € servicio − descuentos · negocio = base · repartidor = envío · plataforma = resto.

Ejemplo base 10 €, tasa 15 %: subtotal 10,50 € · comisión 1,58 € · servicio 0,49 € · envío 2,50 € → **total 15,07 €** · negocio 10,00 € · repartidor 2,50 € · ComeYa 2,57 €.

Invariantes (una sola fórmula en todo el sistema): subtotal = base + markup + comisión · total = subtotal + envío + servicio − descuentos · platformFee + businessEarnings + deliveryEarnings = total · businessEarnings = base · deliveryEarnings = envío. Markup y comisión se guardan por separado (columna nueva `markup_amount` + `nemyCommission` existente). Importes en céntimos con aritmética entera. Tasas por plan: mantener las actuales (15 % general, 10 % Impulso, 8 % Escaparate, Top/Premium según lo configurado). Históricos: solo auditoría read-only, no se reescriben.

## Fases

- **Fase 0 — Preparación.** Este documento, rama `backport/pidefast-fixes`, backup de BD de producción, clonado de staging, congelar deploys durante migraciones.
- **Fase 1 — Seguridad.** Whitelist de roles en registro público (solo customer/business_owner/delivery_driver), no reactivar admins inactivos en login, bloquear re-registro de cuentas admin, `dev-email-login` solo en desarrollo, 403 `admin_inactive` por request, `requireSuperAdmin`, `isVerifiedStatus`, GET /users sin datos sensibles, PUT /users/:id con whitelist de roles + sin auto-cambio de rol/estado + protección del último super_admin activo + auditoría before/after. UI UsersTab con las mismas reglas.
- **Fase 2 — Comisiones y liquidación.** `server/utils/orderSettlement.ts` (fórmula compuesta única), pricingService sobre él, persistir todos los campos (incluido `markup_amount`) desde la creación en los 4 creadores de pedidos, eliminar los fallbacks `?? subtotal` (fundReleaseService, adminFinanceRoutes backfill, substitutionService, orders legacy), unificar confirm-receipt (÷1.15 incoherente), montar o eliminar el middleware financiero muerto, reescribir las auditorías financieras a las invariantes (hoy hay ≥6 fórmulas incompatibles). API sin romper: `price` (base+5 %) se mantiene, se añaden `customerPrice` y `basePrice`. Finanzas/CSV admin: Base, Markup, Comisión, Servicio, Envío, Total. Solo pedidos nuevos.
- **Fase 3 — Verificaciones España.** Crear `shared/verification.ts` (estados canónicos, approved→verified) y `server/utils/verificationRequirements.ts` con docs España (DNI/NIE anverso+reverso, autónomo/empresa, dirección, permiso de circulación, foto vehículo, matrícula). PUT /verifications/:userId con approve/reject/reset + `overrideMissingDocs` auditado (motivo ≥5) + error estructurado MISSING_DOCS; POST /verifications/:userId/request-documents con push y banner. VerificationsTab nativa/.web con filtros, detalle, selector de negocio y "Volver a revisión". Migraciones `document_requested_*` y normalización de estados.
- **Fase 4 — Panel admin.** Agrupación del panel nativo AdminScreenNew (OPERACIÓN/PERSONAS/FINANZAS/CRECIMIENTO/ATENCIÓN/SISTEMA, hero, tareas, badges, useAdminMetrics 30 s) mapeando las pestañas actuales (la web ya está agrupada: no rehacer). Buscador global (adminSearch.ts + AdminGlobalSearch + Ctrl/Cmd+K + índices). Salud del sistema (adminSystem.ts + SystemHealthTab, sin secretos). PaymentProofsTab nativo + pestaña directa + paymentProof en GET /admin/orders (adaptado a Bizum/SEPA/tarjeta). Registrar AdminTab en MainTabNavigator.web.tsx. No regresionar Centro de Operaciones ni mapas internos.
- **Fase 5 — Bugs app/UX.** Calendario Android (sustituir mode="datetime" por pickers separados). Chat IA (timeout 30 s, códigos AI_NOT_CONFIGURED/AI_TIMEOUT/AI_UNAVAILABLE, widget web flotante cableado a chat-public; prompt ComeYa intacto). Direcciones (corregir cableado: SavedAddressesScreen llama a una ruta inexistente → usar PATCH /api/addresses/:id/default; sincronizar users.address). Refresh token ya corregido (solo verificar). Rating (÷10 en 4 pantallas; unificar escritores de escala 0-50). Límites de tamaño en subida de comprobantes + OCR post-subida. ApiError/getApiErrorMessage. Web responsive 320 px.
- **Fase 6 — Suscripciones y gift cards.** Subscriptions.business_id con validación de propiedad y estados pending_payment/cancelled/expired con comprobante. PremiumSubsTab y GiftCardsAdminTab nativas/.web (céntimos, comprobante, activar/rechazar con motivo y auditoría). Planes y pago de ComeYa intactos. Tarjetas 3D opcionales.
- **Fase 7 — QA y despliegue España.** Regresión completa (Stripe tarjeta y Bizum, PayPal, SEPA de negocios, efectivo/caja, ComeYaCard, EUR es-ES, IVA, +34, Soria, Europe/Madrid, branding). Suites API/E2E. Staging → canary → producción. Monitorización (comisión recaudada, payouts, MISSING_DOCS, totales). Actualizar NOTAS: total de prueba 10 € → 12,08 € de producto + envío + 0,49 €.

## Entregables

1. Este documento + anexo commits→archivos.
2. Rama `backport/pidefast-fixes` con un commit/PR por fase.
3. Script read-only de auditoría de pedidos históricos.
4. Checklist de regresión España firmado.

## Anexo: commits de PideFast → acción en ComeYa

| Commit | Contenido | Acción |
|---|---|---|
| 9bf4441 | admin: verificaciones con excepción, panel app, buscador, salud | Portar seguridad, verificaciones (adaptando docs a España), buscador, salud, panel. NO: catálogo VE ni precios USDT |
| 1c72128 | comprobantes visibles en pedidos y acceso directo a pagos | Portar adaptado a Bizum/SEPA/tarjeta |
| 5debc11 | pricing: comisión del negocio incluida y liquidación unificada | Portar motor con fórmula compuesta de ComeYa; migración solo pedidos nuevos |
| c667d5d | selector global, suscripciones, docs VE, multimoneda | Portar selector/suscripciones; NO docs VE/multimoneda |
| 60908c0 | soporte IA, programados, suscripciones 3D, direcciones | Portar mecánica; prompt y precios España |
| a8950ce | crash comprobante, importes responsive, mapas | Portar |
| a1304ae, 79d8c57, e807d4f, c312ba7, c5b537e, 9503a49, 27d97b2, 29cff31, ca20999, 33a1908, 73d6062, 927c2d1, 70daede, 8bae53d, 9790165, 635d6bf, a8950ce, 27d97b2, 9503a49, c5b537e, c312ba7, e807d4f, f4d24f3, ca20999 | robustez, migraciones idempotentes, CORS, UI/responsive, mapas, rating | Portar la mecánica (sin marca VE) |

## Anexo: evidencia de bugs en ComeYa (ruta:línea)

- `server/fundReleaseService.ts:180-181` — `businessEarnings ?? subtotal` (comisión no recaudada).
- `server/routes/orders.ts:232` — legacy asigna subtotal completo al negocio.
- `server/routes/adminFinanceRoutes.ts:559,570` — backfill con el mismo fallback.
- `server/substitutionService.ts:309-310,380` — mismo fallback.
- `server/routes/orderRoutes.ts:370-405` y `server/scheduledOrdersService.ts:149-175` — no persisten earnings al crear.
- `server/routes/orderRoutes.ts:1372` — ÷1.15 incoherente con markup 5 % de `server/pricingService.ts:83-90`.
- `server/financialIntegrity.ts`, `server/financialAuditService.ts` (F4/F7), `server/financialSecurityAudit.ts` (F9/F10/F11) — ≥6 fórmulas de "total esperado" incompatibles.
- `server/routes/auth.ts:176,290,314` — registro acepta cualquier rol (escalada a super_admin). `:238-245` — login reactiva inactivos. `:398-452` — dev-email-login sin gate de producción.
- `server/authMiddleware.ts:47-94,197-210` — sin bloqueo de admin inactivo; sin requireSuperAdmin/isVerifiedStatus; `:127` sin normalizar rol.
- `server/routes/adminRoutes.ts:445-447` — GET /users expone password/tokens/Stripe. `:466-476` — PUT sin whitelist, sin protección de auto-rol ni último super_admin, sin auditoría. `:1449-1487` — catálogo de documentos inline sin dirección/matrícula.
- `client/screens/CheckoutScreen.tsx:1782-1795` — mode="datetime" (en Android no permite elegir hora).
- `client/screens/SavedAddressesScreen.tsx:78-83` — PUT a ruta inexistente (404).
- `client/screens/HomeScreen.tsx:190`, `client/screens/BusinessListScreen.tsx:82`, `client/screens/MarketsScreen.web.tsx:47`, `client/components/admin/tabs/BusinessesTab.web.tsx:347` — rating ÷100 (4,7 → 0,5); `server/reviewService.ts:138` y `server/enhancedReviewService.ts:209` escriben escalas distintas.
- `server/routes/support.ts:74-77,103,107-115` — sin timeout ni códigos AI_*.
- `server/routes/payments.ts:66` — subida sin límite de tamaño; `server/autoVerificationService.ts:256` — OCR post-subida TODO.

## Ya corregido en ComeYa (no portar, solo verificar)

- Refresh token: `client/lib/query-client.ts:72-108,158-167`.
- push_tokens multi-dispositivo (tabla + upsert por token + enhancedPushService).
- admin_notifications / admin_alert_mutes.
- Validación ≥30 min e historial de programados.
- Estructura tabs web (AdminShell + TabErrorBoundary + MobileTabNavigator <768px).
- PATCH /api/addresses/:id/default (el bug es qué pantalla está cableada).
- blackboxai/parity-fixes ya fusionada en main; replit-agent no aporta.
