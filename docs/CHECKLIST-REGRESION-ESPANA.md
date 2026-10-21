# Checklist de regresión España — correcciones de plataforma

Usar en staging antes de cada paso a producción. Marcar cada punto con la evidencia (captura, log o salida de test) y la fecha.

## 0. Preparación

- [ ] Backup completo de la BD de producción y clon en staging.
- [ ] Migraciones aplicadas en staging: `migrations/add_order_markup_amount.sql`, `migrations/add_document_request_fields.sql`, `migrations/add_subscription_business_id.sql`.
- [ ] `node scripts/audit-historical-orders.js` ejecutado en staging y en producción (solo lectura) con el informe guardado.
- [ ] Deploys congelados durante las migraciones.

## 1. Precios y comisiones

- [ ] Pedido de 10,00 € de base al 15 %: subtotal 10,50 € · comisión 1,58 € · servicio 0,49 € · envío 2,50 € → **total 15,07 €**.
- [ ] Ese mismo pedido: negocio 10,00 € · repartidor 2,50 € · ComeYa 2,57 € (los tres libros cuadran al céntimo).
- [ ] Pedido con plan Impulso (10 %): producto 11,55 € · comisión 1,05 € · total con envío 2,50 € y servicio 0,49 € → 14,54 €.
- [ ] Pedido con cupón: el total baja exactamente el descuento y el reparto sigue cuadrando.
- [ ] Pedido de recogida (pickup): envío 0 € y servicio 0,49 €.
- [ ] `GET /api/business/:id` mantiene `price` (base+5 %) y devuelve `customerPrice`/`basePrice`.
- [ ] Ficha y carrito muestran el mismo importe que cobra el servidor en pedidos de 1 y varios productos.
- [ ] Pedido antiguo (histórico) sigue liquidándose igual que antes (sin reescritura).

## 2. Pagos (intactos)

- [ ] Stripe tarjeta: PaymentSheet cobra el total autoritativo del pedido.
- [ ] Stripe Bizum: sesión con método `bizum` y total correcto.
- [ ] Bizum manual/transferencia: comprobante sube a Cloudinary, se aprueba y el pedido queda pagado.
- [ ] PayPal: sesión y acreditación correctas.
- [ ] Efectivo: deuda de caja y liquidación al negocio correctas.
- [ ] ComeYaCard: canje del saldo cubre el total con comisión.
- [ ] Importe manipulado desde el cliente: `POST /api/payments/create-session` cobra el total de BD (no el enviado).

## 3. Seguridad

- [ ] Registro público con `role=super_admin` → la cuenta queda como `customer`.
- [ ] Token de admin desactivado → 403 `admin_inactive`.
- [ ] Admin normal no puede promover ni desactivar administradores (403).
- [ ] Nadie puede cambiar su propio rol ni desactivarse.
- [ ] El último super admin activo no se puede degradar/desactivar (400 `last_super_admin`).
- [ ] `GET /api/admin/users` no devuelve `password`, `pushToken` ni campos `stripe*`.

## 4. Verificaciones

- [ ] Aprobar sin DNI/NIE → 400 `MISSING_DOCS` con la lista.
- [ ] Aprobación con excepción + motivo ≥5 caracteres → aprueba y deja auditoría.
- [ ] Solicitar documentos → push y banner en el perfil del usuario.
- [ ] "Volver a revisión" (reset) devuelve el estado a pendiente.
- [ ] Detalle de repartidor con vehículo sin documentos no rompe la pantalla.

## 5. Panel admin

- [ ] Panel nativo agrupado (OPERACIÓN/PERSONAS/FINANZAS/CRECIMIENTO/ATENCIÓN/SISTEMA) con badges correctos.
- [ ] Ctrl/Cmd+K abre el buscador; elegir un resultado abre su registro (usuario, negocio, pedido, repartidor).
- [ ] Estado del sistema muestra BD, socket, memoria y servicios sin secretos.
- [ ] Comprobantes: pestaña directa, badge de pendientes y aprobación desde el pedido.
- [ ] Web móvil <768 px usa el panel nativo (sin sidebar de escritorio) y las notificaciones abren la sección correcta.

## 6. App cliente

- [ ] Programar pedido en Android: se eligen fecha Y hora, sin crash, y valida ≥30 min.
- [ ] Chat IA: responde; con Gemini caído devuelve error controlado; timeout 30 s; widget web flotante funciona.
- [ ] Direcciones: la primera es predeterminada; cambiar predeterminada no da 404; el perfil muestra la dirección.
- [ ] Rating: un negocio con 4,7 se muestra como 4,7 (no 0,5) en inicio, lista y admin.
- [ ] Comprobante: rechaza archivos >8 MB o que no sean imagen.

## 7. Suscripciones y gift cards

- [ ] Alta de plan para un negocio propio; un negocio ajeno → 400.
- [ ] Plan Impulso aplica 10 % de comisión en pedidos nuevos de ese negocio.
- [ ] Gift card pendiente: activar deja saldo y caducidad; rechazar exige motivo y queda auditado.
- [ ] Importes de gift cards correctos (25 € se muestran como 25,00 €, no 0,25 €).

## 8. Localización y marca

- [ ] Importes en EUR con formato es-ES; textos de IVA correctos.
- [ ] Login con teléfonos +34 y cobertura de Soria.
- [ ] Zona horaria Europe/Madrid en fechas mostradas.
- [ ] Branding ComeYa en todas las pantallas (sin naranja ni textos de otra app).

## 9. Salida a producción

- [ ] Suites API/E2E en verde: pedido, confirmación de recibo, payout, verificación, suscripción, búsqueda y salud.
- [ ] `npm run check:types` sin errores nuevos respecto a la línea base.
- [ ] `npm run server:build` correcto.
- [ ] Staging → canary (10 %) → producción.
- [ ] Monitorización 24 h: comisión efectivamente recaudada, payouts de negocio/repartidor, 400 `MISSING_DOCS`, totales de pedido.

Firma: ____________________  Fecha: __________
