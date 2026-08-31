# Notificaciones push — verificación y arreglo tras la migración EAS

## Por qué dejaron de llegar
La app se compila ahora contra el proyecto EAS de la **organización**
(`710ea450-6cea-4da8-8a78-891ceb00a611`). Los tokens de los builds nuevos
pertenecen a ese proyecto, y el servidor enviaba por el endpoint legacy de
Expo sin token de acceso. El servidor ahora usa la **API nueva**
(`https://api.expo.dev/v2/push/send`) con `EXPO_ACCESS_TOKEN` y, si falla,
reintenta por el endpoint legacy (así los tokens de builds antiguos del
proyecto personal siguen funcionando durante la transición).

Credenciales ya verificadas en el proyecto de la organización:
- Apple Push Key `W82GW59R8A` (Sandbox & Production — correcta para TestFlight).
- Google Service Account Key `comeya-894ce` (FCM v1).
- App Store Connect API Key `M68U4Z622J` (para submits).

## PASO OBLIGATORIO (lo haces tú una sola vez)

1. Entra en https://expo.dev → proyecto **cy-soria** de **Caskiuz's Organization**.
2. Ve a **Settings → Access Tokens**.
3. Crea un token con permiso **Push Notifications** (scope `push`).
4. Añade la variable de entorno en **Render** (servicio `comeya-backend`):
   `EXPO_ACCESS_TOKEN=<el token>`
5. Redeploy del backend.

## Verificación en producción (sin hacer un pedido)

Desde la carpeta `server/`:

```bash
# Listar usuarios con token registrado
npx tsx checkPushDelivery.ts --list

# Enviar una notificación de prueba a un usuario (id o email)
npx tsx checkPushDelivery.ts <userId | email>
```

El script imprime la respuesta EXACTA de la API nueva y del endpoint legacy.
Si la API nueva responde `status: "ok"`, los push del build nuevo funcionan.
Si responde `InvalidCredentials`, revisa la Apple Push Key / FCM v1 del
proyecto en expo.dev (paso de credenciales de EAS-MIGRACION.md).

## Notas
- Los tokens se registran en cada apertura de la app (`AuthContext`) y se
  re-registran al iniciar sesión por SMS/email.
- El endpoint `PUT /api/users/push-token` valida que el token empiece por
  `ExponentPushToken[`.
- `DeviceNotRegistered` (app desinstalada) limpia el token automáticamente.
