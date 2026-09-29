/**
 * Genera los assets de marca de ComeYa (icono, splash, favicon y el icono
 * adaptativo de Android) a partir del logo oficial.
 *
 * Antes el icono y sobre todo la pantalla de carga usaban una imagen con
 * bandas naranjas arriba y abajo (la que se veía al abrir la app). Aquí todo
 * se compone sobre el rojo de marca para que no aparezca ningún borde.
 *
 * Además de los assets de Expo, escribe los recursos NATIVOS de Android
 * (`android/app/src/main/res/`). Esto es imprescindible: un build local con
 * Gradle (scripts/build-apk-comeya.bat) NO ejecuta `expo prebuild`, así que
 * si solo se cambian los assets de client/assets el icono y el splash de la
 * APK siguen siendo los viejos.
 *
 * Uso:  node scripts/generate-brand-assets.js
 */
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const BADGE = path.join(ROOT, "client/assets/images/comeya-badge.png");
// Rojo de marca (el mismo que app.config.js usa como backgroundColor y que
// android/app/src/main/res/values/colors.xml tiene como iconBackground)
const BRAND_RED = "#DC2626";

// El badge es un círculo con un anillo blanco grueso que toca los bordes del
// lienzo. Si se usa a sangre, iOS recorta el anillo al aplicar la máscara
// redondeada, así que siempre se compone con un margen.
const ICON_SIZE = 1024;
const ICON_BADGE = Math.round(ICON_SIZE * 0.82); // margen del 9% por lado

// Android recorta el icono adaptativo a un círculo: el contenido útil debe
// caber en el 66% central.
const ADAPTIVE_SIZE = 1024;
const ADAPTIVE_BADGE = Math.round(ADAPTIVE_SIZE * 0.62);

const SPLASH_SIZE = 512;
const SPLASH_BADGE = Math.round(SPLASH_SIZE * 0.86);

async function badgeBuffer(size) {
  return sharp(BADGE).resize(size, size, { fit: "contain" }).png().toBuffer();
}

/** Icono cuadrado con fondo de marca (sin transparencia: iOS lo exige). */
async function makeOpaqueIcon(size, badgeSize, out, format = "png") {
  const badge = await badgeBuffer(badgeSize);
  let img = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_RED,
    },
  })
    .composite([{ input: badge, gravity: "center" }]);

  img = format === "webp" ? img.webp({ quality: 100 }) : img.png();
  await img.toFile(out);
  console.log(`✅ ${path.relative(ROOT, out)} (${size}×${size})`);
}

/** Icono con fondo transparente (para Android, que pone el color detrás). */
async function makeTransparentIcon(size, badgeSize, out, format = "png") {
  const badge = await badgeBuffer(badgeSize);
  let img = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: badge, gravity: "center" }]);

  img = format === "webp" ? img.webp({ quality: 100 }) : img.png();
  await img.toFile(out);
  console.log(`✅ ${path.relative(ROOT, out)} (${size}×${size}, transparente)`);
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

    // Icono heredado (cuadrado) y redondo: badge sobre rojo de marca.
    // El 82% deja margen para que la máscara no corte el anillo blanco.
    await makeOpaqueIcon(
      d.icon,
      Math.round(d.icon * 0.82),
      path.join(mipmap, "ic_launcher.webp"),
      "webp",
    );
    await makeOpaqueIcon(
      d.icon,
      Math.round(d.icon * 0.82),
      path.join(mipmap, "ic_launcher_round.webp"),
      "webp",
    );

    // Capa frontal del icono adaptativo: fondo transparente (el color lo
    // pone @color/iconBackground) y el badge dentro de la zona segura del
    // 66% que Android recorta a círculo.
    await makeTransparentIcon(
      d.foreground,
      Math.round(d.foreground * 0.62),
      path.join(mipmap, "ic_launcher_foreground.webp"),
      "webp",
    );

    // Logo del splash: SIN bandas. El fondo rojo lo pone el tema
    // (@color/splashscreen_background = #DC2626), así que aquí solo va el
    // badge con el resto transparente.
    for (const variant of ["", "-night-"]) {
      const dir = variant
        ? `drawable-night-${d.dir}`
        : `drawable-${d.dir}`;
      await makeTransparentIcon(
        d.splash,
        Math.round(d.splash * 0.86),
        path.join(resRoot, dir, "splashscreen_logo.png"),
        "png",
      );
    }
  }
}

async function main() {
  if (!fs.existsSync(BADGE)) {
    throw new Error(`No se encuentra el logo: ${BADGE}`);
  }

  // Icono de la app (iOS + fallback Android)
  await makeOpaqueIcon(ICON_SIZE, ICON_BADGE, path.join(ROOT, "client/assets/icon.png"));

  // Icono adaptativo de Android: capa frontal transparente + fondo de color
  // (el color lo pone app.config.js con adaptiveIcon.backgroundColor).
  await makeTransparentIcon(
    ADAPTIVE_SIZE,
    ADAPTIVE_BADGE,
    path.join(ROOT, "client/assets/adaptive-icon.png"),
  );

  // Pantalla de carga: badge sobre rojo, SIN bandas naranjas
  await makeTransparentIcon(
    SPLASH_SIZE,
    SPLASH_BADGE,
    path.join(ROOT, "client/assets/splash.png"),
  );
  await makeTransparentIcon(
    SPLASH_SIZE,
    SPLASH_BADGE,
    path.join(ROOT, "client/assets/splash-dark.png"),
  );

  // Web
  await makeOpaqueIcon(192, Math.round(192 * 0.86), path.join(ROOT, "client/assets/favicon.png"));
  const publicDir = path.join(ROOT, "public");
  if (fs.existsSync(publicDir)) {
    await makeOpaqueIcon(512, Math.round(512 * 0.86), path.join(publicDir, "icon.png"));
  }

  // Recursos nativos de Android (imprescindible para builds locales)
  await writeAndroidResources();

  console.log("\n🎉 Assets de marca generados. Revisa el icono antes de publicar.");
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
