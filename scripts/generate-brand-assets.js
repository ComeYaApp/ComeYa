/**
 * Genera los assets de marca de ComeYa (icono, splash, favicon y recursos
 * nativos de Android) a partir del LOGO OFICIAL del cliente:
 * `assets/images/comeya-logo-nuevo.svg` — cuadrado rojo #EB0000 con el
 * emblema circular (anillo blanco, COMEYA, repartidor y "EL DELIVERY DE
 * SORIA").
 *
 * Antes este script rasterizaba `comeya-badge.png`, un círculo ANTIGUO que
 * no era el logo del cliente (de ahí la queja). Ahora la única fuente de
 * verdad es el SVG.
 *
 * El logo se usa TAL CUAL (cuadrado, sin reinterpretarlo):
 *  - A sangre en el icono de iOS (el sistema ya lo redondea) y en el splash,
 *    donde el rojo del cuadrado coincide con el fondo #EB0000 y por tanto el
 *    borde es invisible.
 *  - Al 78% en la capa frontal del icono adaptativo de Android, para que el
 *    emblema (que ocupa el 82,5% del cuadrado) quepa dentro del círculo
 *    seguro del 66% que recorta el lanzador: 82,5% × 78% ≈ 64,4%.
 *
 * Además de los assets de Expo escribe los recursos NATIVOS de Android
 * (`android/app/src/main/res/`). Es imprescindible: un build local con Gradle
 * (scripts/build-apk-comeya.bat) NO ejecuta `expo prebuild`, así que si solo
 * se cambian los assets de client/assets el icono y el splash de la APK
 * seguirían siendo los viejos.
 *
 * Uso:  node scripts/generate-brand-assets.js
 */
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const LOGO_SVG = path.join(ROOT, "assets/images/comeya-logo-nuevo.svg");

// Rojo del propio logo. Los fondos que tocan el cuadrado usan ESTE rojo (no
// el #DC2626 de la interfaz) para que el borde del cuadrado desaparezca.
const LOGO_RED = "#EB0000";

// librsvg (vía sharp) interpreta el ancho físico del SVG (200mm) y aplica la
// densidad dos veces, así que 200 dpi dan 4374 px de lado. Se reduce luego a
// cada tamaño con filtro de calidad.
const RENDER_DENSITY = 200;

const ICON_SIZE = 1024; // icono iOS / icono heredado
const ADAPTIVE_SIZE = 1024; // capa frontal del icono adaptativo
const ADAPTIVE_LOGO = 0.78; // deja el emblema dentro del círculo seguro del 66%
const SPLASH_SIZE = 512;
const FAVICON_SIZE = 192;
const PUBLIC_ICON_SIZE = 512;

/** Rasteriza el SVG una sola vez y lo deja en caché. */
let masterCache = null;
async function masterBuffer() {
  if (!masterCache) {
    masterCache = await sharp(LOGO_SVG, {
      density: RENDER_DENSITY,
      limitInputPixels: false,
    })
      .png()
      .toBuffer();
  }
  return masterCache;
}

/** Logo cuadrado a `size` px (png o webp). */
async function logoAt(size, format = "png", quality = 100) {
  let img = sharp(await masterBuffer()).resize(size, size, { fit: "fill" });
  if (format === "webp") img = img.webp({ quality, effort: 6 });
  return img.toBuffer();
}

/** Fondo opaco del rojo del logo con el logo a sangre (iOS exige sin alfa). */
async function writeOpaque(size, out, format = "png") {
  const logo = await logoAt(size, format);
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: LOGO_RED,
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .toFile(out);
  console.log(`✅ ${path.relative(ROOT, out)} (${size}×${size})`);
}

/** Logo centrado sobre fondo transparente (Android pone el color detrás). */
async function writeTransparent(size, out, logoScale = 1, format = "png") {
  const inner = Math.round(size * logoScale);
  const logo = await logoAt(inner, format);
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .toFile(out);
  console.log(
    `✅ ${path.relative(ROOT, out)} (${size}×${size}, logo ${Math.round(logoScale * 100)}%)`,
  );
}

/**
 * Recursos nativos de Android. Los nombres y tamaños son los que usa
 * `expo prebuild`; se respetan para no alterar el escalado en pantalla.
 */
const ANDROID_DENSITIES = [
  { dir: "mdpi", icon: 48, foreground: 108, splash: 288 },
  { dir: "hdpi", icon: 72, foreground: 162, splash: 432 },
  { dir: "xhdpi", icon: 96, foreground: 216, splash: 576 },
  { dir: "xxhdpi", icon: 144, foreground: 324, splash: 864 },
  { dir: "xxxhdpi", icon: 192, foreground: 432, splash: 1152 },
];

async function writeAndroidResources() {
  const resRoot = path.join(ROOT, "android/app/src/main/res");
  if (!fs.existsSync(resRoot)) {
    console.log(
      "ℹ️  No hay carpeta android/: se omiten los recursos nativos (se generarán en el próximo prebuild)",
    );
    return;
  }

  for (const d of ANDROID_DENSITIES) {
    const mipmap = path.join(resRoot, `mipmap-${d.dir}`);

    // Icono heredado (cuadrado) y redondo: el logo a sangre. En el redondo el
    // lanzador aplica su máscara circular y el anillo blanco (82,5%) queda
    // dentro, así que no se corta.
    await writeOpaque(d.icon, path.join(mipmap, "ic_launcher.webp"), "webp");
    await writeOpaque(
      d.icon,
      path.join(mipmap, "ic_launcher_round.webp"),
      "webp",
    );

    // Capa frontal del icono adaptativo: transparente (el color lo pone
    // @color/iconBackground) y el logo al 78% para respetar la zona segura.
    await writeTransparent(
      d.foreground,
      path.join(mipmap, "ic_launcher_foreground.webp"),
      ADAPTIVE_LOGO,
      "webp",
    );

    // Logo del splash: a sangre. El fondo rojo #EB0000 lo pone el tema
    // (@color/splashscreen_background), así que el cuadrado se funde con él.
    for (const variant of ["", "-night-"]) {
      const dir = variant ? `drawable-night-${d.dir}` : `drawable-${d.dir}`;
      await writeTransparent(
        d.splash,
        path.join(resRoot, dir, "splashscreen_logo.png"),
        1,
        "png",
      );
    }
  }
}

async function main() {
  if (!fs.existsSync(LOGO_SVG)) {
    throw new Error(`No se encuentra el logo oficial: ${LOGO_SVG}`);
  }

  const meta = await sharp(await masterBuffer()).metadata();
  if (meta.width < 1024 || !meta.hasAlpha === true) {
    console.log(
      `ℹ️  SVG rasterizado a ${meta.width}×${meta.height} (${meta.hasAlpha ? "con" : "sin"} alfa)`,
    );
  }

  // Copia maestra que consume la app (Metro) para pintar el logo en pantalla.
  await sharp(await masterBuffer())
    .resize(ICON_SIZE, ICON_SIZE, { fit: "fill" })
    .png({ compressionLevel: 9 })
    .toFile(path.join(ROOT, "assets/images/comeya-logo-nuevo.png"));
  console.log(
    `✅ assets/images/comeya-logo-nuevo.png (${ICON_SIZE}×${ICON_SIZE})`,
  );

  // Icono de la app (iOS + icono heredado de Android)
  await writeOpaque(ICON_SIZE, path.join(ROOT, "client/assets/icon.png"));

  // Icono adaptativo de Android: capa frontal transparente + fondo de color
  // (el color lo pone app.config.js con adaptiveIcon.backgroundColor).
  await writeTransparent(
    ADAPTIVE_SIZE,
    path.join(ROOT, "client/assets/adaptive-icon.png"),
    ADAPTIVE_LOGO,
  );

  // Pantalla de carga: el cuadrado del logo se funde con el rojo del fondo
  await writeTransparent(
    SPLASH_SIZE,
    path.join(ROOT, "client/assets/splash.png"),
  );
  await writeTransparent(
    SPLASH_SIZE,
    path.join(ROOT, "client/assets/splash-dark.png"),
  );

  // Web
  await writeOpaque(FAVICON_SIZE, path.join(ROOT, "client/assets/favicon.png"));
  const publicDir = path.join(ROOT, "public");
  if (fs.existsSync(publicDir)) {
    await writeOpaque(PUBLIC_ICON_SIZE, path.join(publicDir, "icon.png"));
    // Logo de las páginas estáticas (splash web, privacidad, borrar cuenta)
    await writeOpaque(PUBLIC_ICON_SIZE, path.join(publicDir, "logo.png"));
  }
  const webDir = path.join(ROOT, "web");
  if (fs.existsSync(webDir)) {
    await writeOpaque(FAVICON_SIZE, path.join(webDir, "logo.png"));
  }

  // Recursos nativos de Android (imprescindible para builds locales)
  await writeAndroidResources();

  console.log(
    `\n🎉 Assets de marca generados desde el logo oficial (rojo ${LOGO_RED}).` +
      `\n   Recuerda que splash e iconBackground de Android deben ser ${LOGO_RED}` +
      `\n   (app.config.js y android/app/src/main/res/values/colors.xml).`,
  );
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
