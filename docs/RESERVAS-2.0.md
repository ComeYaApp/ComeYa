# Reservas de Mesa 2.0 — ComeYa

Extensión del módulo de reservas existente (MVP del commit `bee18b4b`) con
motor de disponibilidad por aforo, confirmación automática con código,
recordatorios, agenda para el negocio y tarifa de 0,99 € por comensal que
asiste. El cliente no paga nada por reservar.

## Modelo: aforo por franja (sin plano de mesas)

El restaurante NO configura mesas individuales. Configura:

| Campo | Significado | Defecto |
|---|---|---|
| `capacityPerSlot` | Comensales simultáneos por franja | — (sin config = flujo manual) |
| `turnMinutes` | Duración del turno de mesa | 90 |
| `slotMinutes` | Intervalo entre horas ofertadas | 30 |
| `maxPartySize` | Máx. comensales por reserva | 8 |
| `advanceDays` | Antelación máxima | 14 |
| `autoConfirm` | Confirmación automática si hay sitio | false |
| `maxCoversPerDay` | Límite diario total (opcional) | null |

Las franjas se generan desde el `openingHours` del negocio (soporta mañana y
tarde). La carga de una franja = suma de `partySize` de reservas activas
(`pending`/`confirmed`/`seated`) cuyo turno `[hora, hora+turno)` la solapa.

Estados por franja: **available** (libre), **last** (últimas mesas — solo si
la escasez viene de reservas reales; un local vacío nunca se pinta en ámbar),
**full** (completo).

**Retrocompatible**: negocio sin `reservation_config` → franjas por defecto
(13:00–16:00 y 20:00–23:30), sin límite de aforo y reserva manual pendiente de
confirmar, exactamente como el MVP.

## Ciclo de vida de la reserva

```
pending ──(negocio confirma)──► confirmed ──(¡Llegó! / arrive)──► seated ──(cerrar)──► completed
   │                              │
   ├──► rejected (negocio)        ├──► no_show (no vino, sin tarifa)
   └──► cancelled (cliente / negocio / admin, con cancelled_by)
```

- Con `autoConfirm` activo y aforo disponible la reserva nace `confirmed` con
  **código CY-XXXX** (único por negocio y día) que el cliente muestra al llegar.
- Si el negocio confirma a mano una reserva sin código, el código se genera en
  ese momento.

## Tarifa: 0,99 € por comensal que asiste

- Se cobra al NEGOCIO, nunca al cliente. Se materializa al marcar **¡Llegó!**
  (`action: arrive`): transacción `reservation_fee` negativa en la wallet del
  dueño (amount = −99 × partySize céntimos), con `businessId` y metadata de la
  reserva. Visible en Finanzas del negocio y en finanzas admin.
- **Idempotente y a prueba de carreras**: la primera escritura de
  `fee_charged_at` gana (UPDATE con `WHERE fee_charged_at IS NULL`); un segundo
  cobro concurrente no toca la wallet.
- Cancelaciones, rechazos y no-shows **no generan tarifa**.

### Cobro real del dinero (liquidación)

La deuda vive en la wallet; el dinero llega a ComeYa por dos vías:

1. **Tarjeta guardada → cobro automático off-session** (cron diario 04:15,
   `server/reservationFeeChargeCron.ts`). Se cobra la deuda acumulada cuando
   alcanza el umbral (defecto 5 €, `RESERVATION_FEE_AUTOCHARGE_MIN_CENTS`)
   — evita micro-cargos que se comería Stripe. Al pagar en la app, la tarjeta
   queda guardada en el Customer de Stripe (`setup_future_usage: off_session`),
   así el primer pago habilita todos los siguientes. Si el cobro falla
   (tarjeta caducada, requiere autenticación), el dueño recibe push para
   actualizar o pagar manualmente.
2. **Pago manual con comprobante** (Bizum/transferencia/PayPal): el negocio ve
   los datos de pago de ComeYa en "Reservas → Tarifas", transfiere el importe
   exacto y sube la foto del comprobante. Un admin lo verifica en
   **Finanzas → Cobros reservas** (web y móvil); al aprobar, la wallet se abona
   y la deuda queda saldada. Rechazo con motivo → la deuda sigue pendiente.

Ambas vías abonan la wallet con una transacción `reservation_fee_settlement`
positiva, **idempotente por clave** (id del PaymentIntent o del comprobante):
nunca se abona dos veces el mismo pago. El endpoint `/fees/pay/confirm`
**verifica el PaymentIntent en Stripe** antes de dar por pagado (no confía en
el cliente).

Pantallas: **BusinessFees** (negocio, desde "Reservas → Configurar → Ver deuda
y pagar tarifas") y **Cobros reservas** en el panel de finanzas admin (web:
Administración → Finanzas → Cobros reservas; móvil: Finanzas → tab
"Tarifas reservas"). Notificación en tiempo real al admin (campana + push)
cuando llega un comprobante.

> Nota técnica: los comprobantes de tarifas se guardan en `payment_proofs`
> con `purpose = 'reservation_fees'` y `order_id = NULL` (hay FK real de
> `order_id` a `orders`; los comprobantes de suscripciones `sub_*` tienen ese
> riesgo latente).

## API (`/api/reservations`)

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /availability?businessId&date&partySize` | público | Franjas del día con estado y config |
| `GET /search?date&time&partySize` | público | Negocios con reservas + disponibilidad (Home "Reservar") |
| `POST /` | cliente | Crear reserva (valida franja y aforo; auto-confirma si procede) |
| `GET /mine` | cliente | Mis reservas (con código) |
| `POST /:id/cancel` | cliente/admin | Cancelar pendiente/confirmada/sentada |
| `GET /business?date=` | owner/admin | Agenda del día + resumen por negocio (`summary`) |
| `GET /business/config?businessId=` | owner/admin | Leer configuración |
| `PUT /business/config` | owner/admin | Guardar configuración (aforo 0 = limpiar → manual) |
| `PUT /business/:id/status` | owner/admin | `confirmed` / `rejected` / `cancelled` (con nota) |
| `PUT /business/:id/action` | owner/admin | `arrive` (cobra tarifa) / `no_show` / `close` |

## Recordatorio

`server/reservationReminderCron.ts` (cada 10 min, zona Europe/Madrid): push
"⏰ Recuerda tu reserva" 2 h antes a reservas **confirmadas** con
`reminder_sent_at` nulo (guard en BD, sobrevive reinicios). Las reservas creadas
con menos de 2 h de antelación no se recuercan (el push de confirmación sigue
reciente).

## UI

**Cliente**
- Home: conmutador **Pedir / Reservar mesa** (`HomeReserveMode`): día, hora (o
  "Cualquiera"), comensales → tarjetas con badge Mesa disponible / Últimas
  mesas / Completo. Móvil y web.
- Ficha del negocio: modal de reserva con franjas reales coloreadas
  (verde/ámbar/desactivada) y éxito con el código CY grande. Gemelo web.
- Mis reservas: código (confirmadas/sentadas) y estados nuevos
  (`seated`/`completed`/`no_show`).

**Negocio**
- `BusinessReservationsSettingsScreen`: aforo, turnos, intervalo, máx. grupo,
  antelación, auto-confirmación, límite diario y aviso transparente de la
  tarifa. Acceso desde "Mis negocios → Servicios" y desde la agenda (⚙).
- Agenda `BusinessReservationsScreen`: strip de 15 días, resumen del día
  ("X comensales · aforo Y/franja · N franjas libres"), lista agrupada por
  hora con código y acciones por estado (Confirmar/Rechazar, ¡Llegó!/No vino/
  Cancelar, Cerrar mesa). Tiempo real vía websocket `business:{id}` con
  polling 30 s de respaldo. Web reutiliza la misma implementación.

**Push**: deep-links arreglados (`MyReservations`/`BusinessReservations`
añadidas a la whitelist de `App.tsx`; antes no navegaban al pulsar).

## Base de datos

Cambios aditivos (todo NULL/default): `businesses.reservation_config` (JSON) y
en `reservations`: `code`, `cancelled_by`, `reminder_sent_at`, `seated_at`,
`completed_at`, `no_show_at`, `fee_cents`, `fee_charged_at`. En
`payment_proofs`: `purpose` ('order' | 'subscription' | 'reservation_fees').
En `users` se declararon en el ORM (columnas que ya existían en MySQL):
`stripe_customer_id`, `stripe_payment_method_id`, `card_last4`, `card_brand`.

- Dev: `npm run db:push` (drizzle-kit).
- Prod: `migrations/reservations_2_0.sql` +
  `migrations/reservation_fees_payments.sql` (idempotencia también garantizada
  por las migraciones de arranque de `server/db.ts`).

## Tests

`tests/api/reservations.test.ts` (15 casos, autocontenidos): permisos de
config, disponibilidad, auto-confirmación con código, duplicados, aforo
completo, máximo de grupo, llegada con tarifa única (verifica la transacción
en wallet), no-show sin tarifa, cierre, cancelación por negocio, `/mine`,
agenda con resumen y buscador.

`tests/api/reservationFees.test.ts` (10 casos): deuda pendiente, permisos,
pago con tarjeta degradado sin Stripe, comprobante manual (duplicados y
pendiente único), lista admin, dueño no puede auto-aprobarse, aprobar salda
la deuda, rechazar no la salda, idempotencia de la liquidación.

## Fuera de esta iteración (futuras fases)

Avísame (lista de espera), Últimas mesas como oferta, Radar rellenar huecos,
Sorpréndeme, IA gastronómica, Rewards, reservas entre amigos, reserva+pedido
anticipado, pago de cuenta. El modelo por aforo hace innecesario el plano de
mesas y el "unir mesa 4+2".

## Notas técnicas

- La disponibilidad se recalcula al crear la reserva (protección de carrera
  razonable a escala Soria); no hay bloqueo transaccional de tabla.
- `GET /search` y el resumen de agenda hacen ~3 queries por negocio; con
  decenas de negocios es despreciable, optimizable si crece el catálogo.
- La tarifa se descuenta de la wallet del dueño; los payouts existentes ya la
  compensan (no hay cobro directo por Stripe en esta fase).
