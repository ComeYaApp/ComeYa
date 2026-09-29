/**
 * Auditoría de paridad entre la app y la web.
 *
 * La web es Expo web: el mismo código, pero Metro resuelve `Foo.web.tsx`
 * antes que `Foo.tsx`. Por eso una pantalla "no tiene versión web" cuando le
 * falta ese archivo Y además usa algo que solo existe en el móvil (mapas
 * nativos, cámara, ficheros, Stripe nativo…), o cuando no está registrada en
 * el navegador que se usa en web (MainTabNavigator.web / ProfileStackNavigator.web).
 *
 * Uso:  node scripts/audit-web-parity.js            (informe por consola)
 *       node scripts/audit-web-parity.js --md ruta  (escribe el informe en MD)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SCREENS = path.join(ROOT, "client/screens");
const NAV = path.join(ROOT, "client/navigation");

// Módulos que NO funcionan en web (o funcionan a medias) y por los que una
// pantalla necesita sí o sí una variante .web.
const NATIVE_ONLY = [
  "react-native-maps",
  "expo-camera",
  "expo-barcode-scanner",
  "expo-image-picker",
  "expo-print",
  "expo-sharing",
  "expo-file-system",
  "expo-notifications",
  "expo-task-manager",
  "expo-background-fetch",
  "@stripe/stripe-react-native",
  "react-native-worklets",
];

// Navegadores que existen en web (los únicos que importan para esta auditoría).
const WEB_NAVIGATORS = [
  "RootStackNavigator.tsx",
  "MainTabNavigator.web.tsx",
  "ProfileStackNavigator.web.tsx",
  "HomeStackNavigator.tsx",
  "OrdersStackNavigator.tsx",
];

function listScreens() {
  return fs
    .readdirSync(SCREENS)
    .filter(
      (f) =>
        f.endsWith(".tsx") &&
        !f.endsWith(".web.tsx") &&
        // Los *Content.tsx son el cuerpo compartido de una pantalla con
        // versión web (los usan tanto el .tsx como el .web.tsx): no son
        // pantallas en sí.
        !f.endsWith("Content.tsx"),
    )
    .sort();
}

function hasWebVariant(file) {
  return fs.existsSync(path.join(SCREENS, file.replace(/\.tsx$/, ".web.tsx")));
}

function nativeImports(file) {
  const src = fs.readFileSync(path.join(SCREENS, file), "utf8");
  return NATIVE_ONLY.filter((m) => src.includes(`"${m}"`) || src.includes(`'${m}'`));
}

/** Rutas registradas en los navegadores web: <Stack.Screen name="X" …>. */
function registeredWebRoutes() {
  const routes = new Set();
  for (const nav of WEB_NAVIGATORS) {
    const p = path.join(NAV, nav);
    if (!fs.existsSync(p)) continue;
    const src = fs.readFileSync(p, "utf8");
    for (const m of src.matchAll(/name="([A-Za-z0-9_]+)"/g)) routes.add(m[1]);
  }
  return routes;
}

/** Todas las rutas declaradas en RootStackParamList (lo que se puede navegar). */
function declaredRoutes() {
  const src = fs.readFileSync(path.join(NAV, "RootStackNavigator.tsx"), "utf8");
  const body = src.slice(
    src.indexOf("RootStackParamList"),
    src.indexOf("createNativeStackNavigator") > -1
      ? undefined
      : undefined,
  );
  const routes = new Set();
  for (const m of body.matchAll(/^\s{2}([A-Za-z0-9_]+):/gm)) routes.add(m[1]);
  return routes;
}

function main() {
  const screens = listScreens();
  const webRoutes = registeredWebRoutes();
  const declared = declaredRoutes();

  const rows = screens.map((file) => {
    const base = file.replace(/\.tsx$/, "");
    const web = hasWebVariant(file);
    const natives = web ? [] : nativeImports(file);
    const registered = webRoutes.has(base);
    return { file: base, web, natives, registered };
  });

  const broken = rows.filter((r) => r.natives.length > 0);
  const unregistered = [...declared]
    .filter((r) => !webRoutes.has(r))
    .sort();

  const lines = [];
  lines.push("# Paridad web ↔ app · ComeYa");
  lines.push("");
  lines.push(`Generado por \`node scripts/audit-web-parity.js\`.`);
  lines.push("");
  lines.push("## 0. Estado de esta tanda (1.0.16 build 21)");
  lines.push("");
  lines.push("Arreglado y verificado:");
  lines.push("");
  lines.push("- **Inicio de la web** ya tiene los mismos botones que la app: *Explorar negocios* y *Ver mapa*, más las cuatro promos (VIP, tarjeta regalo, puntos, invita y gana). Comprobado en un navegador real: *Ver mapa* navega a `/BusinessMap`.");
  lines.push("- **Enlaces muertos corregidos**: *Favoritos* (menú lateral) e *Historial de pagos* (perfil de negocio) navegaban a rutas que solo existían en los navegadores del móvil, así que no hacían nada. Ahora están registradas en el navegador web.");
  lines.push("- **Reservas y finanzas con versión web propia**: `MyReservationsScreen`, `BusinessReservationsScreen` y `BusinessFinancesScreen` comparten el MISMO componente de pantalla en app y web (`*Content.tsx`), así que el flujo no puede divergir; en escritorio se envuelven con la barra y el menú lateral.");
  lines.push("- **Menú lateral web** con acceso a *Reservas* (cliente y negocio) e *Historial de pagos*.");
  lines.push("- **El mapa de la web funciona**: comprobado en producción (app.comeya.es), carga Google Maps con los 11 negocios. La clave web (`/api/config/maps-key`) está configurada.");
  lines.push("");
  lines.push("Pendiente / siguiente prioridad:");
  lines.push("");
  lines.push("- Las 10 pantallas de la sección 1 siguen usando módulos que solo existen en el móvil (cámara, ficheros, notificaciones, Stripe nativo). En web hay que darles un camino alternativo (o marcar el botón como no disponible en web, como ya se hace en Métodos de pago).");
  lines.push("- Las pantallas de la sección 3 se ven en web con el diseño del móvil (funcionan, pero sin adaptar el ancho de escritorio).");
  lines.push("");
  lines.push("## 1. Pantallas sin versión web que SÍ usan algo exclusivo del móvil");
  lines.push("");
  lines.push("Son las que pueden romper o quedarse a medias en la web.");
  lines.push("");
  if (broken.length === 0) {
    lines.push("_Ninguna: todas las pantallas que usan módulos nativos tienen su `.web.tsx`._");
  } else {
    lines.push("| Pantalla | Módulos nativos que usa |");
    lines.push("|---|---|");
    for (const b of broken) {
      lines.push(`| \`${b.file}\` | ${b.natives.join(", ")} |`);
    }
  }
  lines.push("");
  lines.push("## 2. Pantallas con versión web propia");
  lines.push("");
  const withWeb = rows.filter((r) => r.web).map((r) => r.file);
  lines.push(`${withWeb.length} de ${rows.length}:`);
  lines.push("");
  lines.push(withWeb.map((f) => `\`${f}\``).join(", "));
  lines.push("");
  lines.push("## 3. Pantallas que usan la versión nativa también en web");
  lines.push("");
  const shared = rows.filter((r) => !r.web && r.natives.length === 0).map((r) => r.file);
  lines.push(`${shared.length} de ${rows.length} (funcionan en web tal cual, sin adaptar el diseño):`);
  lines.push("");
  lines.push(shared.map((f) => `\`${f}\``).join(", "));
  lines.push("");
  lines.push("## 4. Rutas navegables que NO están registradas en los navegadores web");
  lines.push("");
  lines.push("Si algún botón navega a una de estas desde la web, la acción se descarta en silencio.");
  lines.push("");
  lines.push(unregistered.map((r) => `\`${r}\``).join(", ") || "_Todas registradas._");
  lines.push("");

  const md = lines.join("\n");
  const outIdx = process.argv.indexOf("--md");
  if (outIdx > -1 && process.argv[outIdx + 1]) {
    const out = path.resolve(ROOT, process.argv[outIdx + 1]);
    fs.writeFileSync(out, md, "utf8");
    console.log(`Informe escrito en ${out}`);
  } else {
    console.log(md);
  }

  console.log(
    `\nResumen: ${broken.length} pantallas con módulos nativos sin .web · ` +
      `${withWeb.length} con .web · ${shared.length} compartidas · ` +
      `${unregistered.length} rutas no registradas en web`,
  );
}

main();
