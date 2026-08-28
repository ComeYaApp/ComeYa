# Migración del build iOS al proyecto de la organización EAS

> Objetivo: construir iOS AHORA usando la cuota Free intacta de la
> organización "Caskiuz's Organization", sin perder nada del proyecto
> actual (`cy-soria` de la cuenta personal @cazkiuz, cuya cuota Free se
> renueva el 1 de septiembre).

## Reglas de seguridad (no negociables)

1. **NO borrar** el proyecto `cy-soria` ni la cuenta personal @cazkiuz.
   Los tokens push de las apps YA instaladas pertenecen a ese proyecto y
   siguen funcionando mientras el proyecto exista. La transición es
   aditiva: tokens viejos + tokens nuevos conviven.
2. El Apple ID es SIEMPRE el mismo (rander.enterprise@hotmail.com):
   App Store Connect, TestFlight y el bundle id `com.comeya.app` no cambian.
3. El número de build NUNCA puede bajar: App Store Connect ya tiene el
   build **10**. Este repo quedó fijado en **11** (versionado local).

## Pasos en orden

### 1. Entrar con la cuenta owner de la organización

```bash
npx eas-cli logout
npx eas-cli login          # correo del OWNER de la organización
```

### 2. Vincular el repo a un proyecto NUEVO dentro de la organización

```bash
npx eas-cli init
```

- Elegir la **organización** como cuenta (no la personal).
- Nombre de proyecto NUEVO (p. ej. `comeya-prod`; "ComeYa" ya existe en la org).
- Esto escribe el `projectId` nuevo en `app.config.js` (el viejo queda en git).

### 3. Construir (mismo comando de siempre)

```bash
npx eas-cli build --platform ios --profile production
```

- Inicia sesión con el MISMO Apple ID. EAS genera certificado de
  distribución y perfil nuevos (Apple permite hasta 3 certificados por
  equipo; hay sitio de sobra).
- El build saldrá como **1.0.15 (11)**.

### 4. Subir credenciales push al proyecto NUEVO (crítico)

En expo.dev → organización → proyecto nuevo → **Credentials**:

- **Apple Push Key (APNs)**: el mismo archivo .p8 del proyecto viejo.
- **Google Service Account Key (FCM v1)**: el mismo JSON del proyecto viejo.

Sin este paso los push del build nuevo fallan EN SILENCIO.

### 5. Enviar a revisión en App Store Connect

1. Esperar a que el build 1.0.15 (11) termine de procesar.
2. Versión **1.0.15** → Compilación → Añadir compilación → seleccionar el 11.
3. Completar capturas de pantalla (obligatorias; 3 primeras se usan).
4. **Añadir a revisión**.

### 6. Prueba de push real

Pedido de prueba con Stripe → el dueño del negocio debe recibir
"💳 Pago recibido — nuevo pedido" en segundos (webhook ya registrado).

### 7. Dejar el plan B intacto

- El proyecto viejo (`cy-soria`) sigue existiendo: si algo falla con la
  organización, el 1 de septiembre su cuota se renueva y se puede volver.
- La cuota Free es POR CUENTA: la organización es otra cuenta con su
  propio cupo mensual. Alternar cuentas para esquivar cuotas puede
  terminar en bloqueo; para construir seguido, la vía limpia es el plan
  de pago (expo.dev → settings → billing).

## Notas técnicas

- `eas.json`: `appVersionSource` ahora es `"local"` (si fuera "remote",
  el contador del proyecto nuevo empezaría en 1 y Apple lo rechazaría).
- `app.config.js`: `ios.buildNumber: "11"` — incrementar A MANO en cada
  build nuevo (12, 13…). Android usa `versionCode: 15` (sin cambios).
- Variables `EXPO_PUBLIC_*` del build: vienen del perfil `production` de
  `eas.json`, no de la cuenta. Sentry (si estaba como env del proyecto
  viejo en EAS): re-añadir las variables en el proyecto nuevo (opcional).
