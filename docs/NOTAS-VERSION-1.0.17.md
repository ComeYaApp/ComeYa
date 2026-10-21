# ComeYa 1.0.17 — corrección del modelo de comisiones y mejoras de panel

**Versión**: 1.0.17
**Base**: correcciones de la plataforma aplicadas a ComeYa, sin tocar marca, pagos ni flujos de España

---

## 1. La comisión ahora se cobra de verdad

El modelo queda con una sola fórmula en todo el sistema:

```
subtotal        = base × 1,05                  (markup 5 %)
comisión        = subtotal × tasa del plan     (15 % general, 10 % Impulso, 8 % Escaparate)
total cliente   = subtotal + comisión + envío + 0,49 € − descuentos
negocio         = base      (100 % de su precio)
repartidor      = envío     (100 % de la tarifa)
ComeYa          = markup + comisión + servicio − descuentos
```

**Ejemplo de prueba (base 10,00 €, envío 2,50 €):**

| Concepto | Importe |
|---|---|
| Base negocio | 10,00 € |
| Markup 5 % | 0,50 € |
| Subtotal | 10,50 € |
| Comisión ComeYa 15 % | 1,58 € |
| Coste de servicio | 0,49 € |
| Envío | 2,50 € |
| **Total cliente** | **15,07 €** |

El **producto** que ve el cliente pasa a **12,08 €** (10,50 + 1,58) + envío + 0,49 €. Antes la comisión se calculaba pero no se cobraba ni se liquidaba: la plataforma regalaba su margen en cada pedido.

- Se guardan por separado `productos_base`, `markup_amount`, `nemy_commission`, `service_fee`, `platform_fee`, `business_earnings` y `delivery_earnings` desde la creación del pedido.
- La liquidación (confirmación de recibo, pickup, cron, backfill) usa el mismo cálculo: nunca más `businessEarnings ?? subtotal`.
- Las auditorías financieras comparten una única invariante (antes había seis fórmulas incompatibles).
- Los pedidos históricos **no se reescriben**: se auditan con `scripts/audit-historical-orders.js` (solo lectura).

## 2. Seguridad

- Registro público con whitelist de roles (solo cliente, negocio y repartidor).
- Los administradores desactivados reciben 403 también con tokens ya emitidos.
- `GET /admin/users` ya no devuelve hashes de contraseña, tokens push ni datos de Stripe.
- Cambios de rol/estado con reglas: solo Super Admin gestiona administradores, nadie cambia su propio rol, no se puede dejar la plataforma sin Super Admin activo y todo queda auditado.

## 3. Verificaciones de España

- Documentos: DNI/NIE anverso y reverso, certificado de autónomo/empresa, dirección del negocio, permiso de circulación, foto del vehículo, ITV, seguro y matrícula.
- Aprobar sin documentos devuelve la lista exacta (`MISSING_DOCS`); se puede aprobar con excepción y motivo (auditado).
- "Solicitar documentos" avisa por push y muestra un banner en el perfil; "Volver a revisión" resetea el estado.

## 4. Panel de administración

- Panel nativo agrupado por OPERACIÓN, PERSONAS, FINANZAS, CRECIMIENTO, ATENCIÓN y SISTEMA, con tareas pendientes y badges en tiempo real.
- Buscador global con Ctrl/Cmd+K que abre el registro exacto (usuario, negocio, pedido o repartidor).
- Estado del sistema (base de datos, socket, memoria, servicios) sin secretos.
- Pestaña directa de Comprobantes en la barra y aprobación desde el pedido.
- Web móvil (<768 px) usa el panel nativo y las notificaciones abren la sección correcta.

## 5. Correcciones de la app

- **Pedidos programados en Android**: selectores de fecha y hora separados (antes solo se podía elegir el día y la hora quedaba fija).
- **Direcciones**: la primera es predeterminada, cambiar la predeterminada ya no da 404 y el perfil muestra la dirección.
- **Valoraciones**: se muestran en escala 0–5 correcta (4,7 ya no aparece como 0,5).
- **Chat IA**: timeout de 30 s, códigos de error claros y widget flotante en la web.
- **Comprobantes**: límite de 8 MB y solo imágenes; OCR posterior a la subida para validar referencia e importe.
- **Suscripciones por negocio** con comisión del plan aplicada a pedidos nuevos; gift cards revisadas en el panel con activar/rechazar auditado.

## 6. Qué no cambia

Stripe (tarjeta y Bizum), PayPal, transferencia/SEPA, efectivo y ComeYaCard siguen igual. Precios de los planes, cobertura de Soria, formato de euros y textos legales de España se mantienen.
