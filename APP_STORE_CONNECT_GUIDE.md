# Guía Completa: ComeYa en App Store Connect (iOS)

> **Estado actual**: Proyecto configurado. Build de Android en producción. iOS listo para compilar en EAS Build.

---

## Paso 1: Apple Developer Program ($99/año)

1. Ir a https://developer.apple.com/programs/
2. Click en **Enroll**
3. Seguir el proceso de registro (puede tardar 24-48h en verificarse)
4. Una vez aceptado, acceder a **App Store Connect**: https://appstoreconnect.apple.com

---

## Paso 2: Crear la App en App Store Connect

1. Entrar a https://appstoreconnect.apple.com
2. Click en **My Apps** → botón **+** → **New App**
3. Completar el formulario:

| Campo | Valor |
|---|---|
| Platforms | **iOS** |
| Name | **ComeYa** |
| Primary Language | **Spanish** |
| Bundle ID | **com.comeya.app** (elegir "com.comeya.app" si ya existe en tu cuenta, o crearlo nuevo) |
| SKU | **comeya-ios-001** (único, interno) |
| User Access | **Full Access** |

4. Click en **Create**

---

## Paso 3: Configurar EAS con credenciales Apple

EAS Build gestiona automáticamente los certificados. Para iOS solo necesitas una **App Store Connect API Key**:

### 3.1 Generar API Key en App Store Connect

1. Ir a https://appstoreconnect.apple.com/access/integrations/api
2. Click en **+** (Generate API Key)
3. Nombre: `EAS Build`
4. Access: **Developer**
5. Click **Generate**
6. Descargar el archivo `.p8` (solo se puede descargar UNA vez, guárdalo bien)
7. Anotar el **Issuer ID** (arriba en la página) y el **Key ID** (junto a la key)

### 3.2 Agregar la API Key a EAS

Ejecutar en la terminal (en `C:\CY`):

```bash
eas credentials --platform ios
```

Seguir las instrucciones:

- Elegir **"Set up App Store Connect API Key"**
- Ingresar:
  - **Apple ID** (email de tu cuenta Apple Developer)
  - **App Store Connect API Key** (descargada en paso 3.1)
  - **Key ID**
  - **Issuer ID**

Esto se guarda automáticamente en el servidor de Expo de forma segura.

---

## Paso 4: Build de iOS para App Store

### Opción 1: Script automatizado (recomendado)

```bash
build-ios-production.bat
```

### Opción 2: Comando manual

```bash
eas build --platform ios --profile production
```

**¿Qué hace el perfil `production`?**
- `image: "latest"` → usa la última imagen de macOS en EAS
- `distribution: "store"` → genera un IPA para App Store Connect
- `autoIncrement: "version"` → incrementa automáticamente el buildNumber

El build se ejecuta en servidores macOS de Expo. Tarda 20-40 minutos. Al terminar, EAS te da un link para descargar el IPA o lo sube automáticamente a App Store Connect si está configurado.

---

## Paso 5: Subir el IPA a App Store Connect

### Opción A: Submit automático con EAS (más fácil)

```bash
eas submit --platform ios --profile production
```

Esto sube el IPA directamente a App Store Connect.

### Opción B: Manual (si tienes Mac)

1. Descargar el IPA desde el dashboard de EAS
2. Abrir Transporter en macOS
3. Arrastrar el IPA a Transporter y darle Deliver

---

## Paso 6: Completar la ficha en App Store Connect

Una vez el build esté en App Store Connect, debes completar:

### 6.1 App Information
- **Name**: ComeYa
- **Privacy Policy URL**: https://comeya-backend.onrender.com/privacy-policy
- **Category**: Food & Drink
- **Subcategory**: Delivery

### 6.2 Screenshots
Necesitas capturas para TODOS los tamaños de iPhone:
- iPhone 6.7" (iPhone 14 Pro Max): 1290 x 2796 px
- iPhone 6.5" (iPhone 11 Pro Max): 1242 x 2688 px
- iPhone 5.5" (iPhone 8 Plus): 1242 x 2208 px

**Recomendación**: Usar la app corriendo en tu Android real, tomar screenshots con las medidas correctas, o usar herramientas como https://screenshots.pro o https://app-mockup.com

### 6.3 App Description
Escribe una descripción atractiva en español. Ejemplo:

> ComeYa es la app líder de delivery en Venezuela. Pide comida, mercado y más de los mejores restaurantes y tiendas cerca de ti. Con ComeYa, tu pedido llega rápido, fácil y seguro. ¡Descarga ComeYa y comprueba por qué todos están cambiando a ComeYa!

### 6.4 Keywords
`comida a domicilio, delivery, pedir comida, restaurantes, comida rápida, delivery Venezuela, mercado, domicilio`

### 6.5 Rating
Clasificación por edad: el cuestionario determina la calificación (probablemente 17+ por chat/web browsing).

### 6.6 App Review Information
- **Sign-in required**: YES
- **Credentials**: Proporciona un usuario y contraseña de prueba para que Apple pueda revisar la app
- **Contact Info**: Tu nombre y teléfono

---

## Paso 7: Submit para Review

1. Ir a **Prepare for Submission** en App Store Connect
2. Completar todos los campos obligatorios
3. Click en **Submit for Review**
4. Apple revisa la app (puede tardar 24-48h)
5. Si hay rechazo, Apple te indica qué corregir
6. Una vez aprobada, se publica en la App Store

---

## Configuración técnica ya realizada en el proyecto

| Archivo | Configuración |
|---|---|
| `app.config.js` | `bundleIdentifier: "com.comeya.app"`, permisos iOS, splash, icon |
| `app.config.js` | `newArchEnabled` dinámico: `true` Android, `false` iOS (compatibilidad expo-av) |
| `eas.json` | Perfil `production` con `distribution: "store"`, `autoIncrement: "version"` |
| `eas.json` | Variables de entorno configuradas (Google Maps API Key, URLs) |
| `.gitignore` | `package-lock.json` incluido (necesario para builds deterministas) |
| `build-ios-production.bat` | Script listo para ejecutar el build desde Windows |

---

## Flujo de trabajo diario (después del setup inicial)

```bash
# 1. Hacer cambios en el código
# 2. Commit y push
git add .
git commit -m "descripcion de cambios"
git push

# 3. Build iOS (solo cuando se necesita nueva versión)
eas build --platform ios --profile production

# 4. Submit a App Store Connect
eas submit --platform ios --profile production
```

---

## Troubleshooting

### "Authentication with Apple Developer Portal failed"
→ La API Key no está bien configurada. Revisa Key ID, Issuer ID y el archivo .p8.

### "Bundle ID com.comeya.app is not available"
→ Debes registrar el Bundle ID manualmente en https://developer.apple.com/account/resources/identifiers

### "Missing privacy policy"
→ Asegúrate que https://comeya-backend.onrender.com/privacy-policy esté accesible.

### "expo-av / EXEventEmitter.h not found"
→ Ya está resuelto: `newArchEnabled` se desactiva automáticamente para iOS en `app.config.js`.

### "App Store rejected: Guideline X.X"
→ Lee el motivo, corrige y re-submit. Los rechazos más comunes son falta de funcionalidad nativa, UI pobre, o falta de información de privacidad.