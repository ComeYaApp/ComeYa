// Hoja de contactos para revisar visualmente los iconos ComeYa antes de
// generarlos como componentes TSX. Uso: node scripts/comeya-icons.preview.js
// Genera logs/comeya-icons-preview.png con cada icono sobre círculo rojo.
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

// Cuerpos SVG en cuadrícula 24x24. Trazo heredado: fill none, stroke blanco,
// anchura 1.8, extremos redondeados (estilo line-art del pack del diseñador).
const ICONS = {
  taco: `<path d="M2.9 16.9a9.1 9.1 0 0 1 18.2 0Z"/>
    <path d="M6.4 16.9a5.6 5.6 0 0 1 11.2 0"/>
    <path d="M6.7 9.8a1.85 1.85 0 0 1 3.6-.75a1.9 1.9 0 0 1 3.75-.4a1.85 1.85 0 0 1 3.5.5"/>
    <circle cx="10.4" cy="13.7" r="0.4" fill="#FFF" stroke="none"/>
    <circle cx="13.6" cy="13.7" r="0.4" fill="#FFF" stroke="none"/>`,
  hamburguesa: `<path d="M4.6 10.3c0-3.3 3.3-5.5 7.4-5.5s7.4 2.2 7.4 5.5c0 .9-.6 1.4-1.5 1.4H6.1c-.9 0-1.5-.5-1.5-1.4Z"/>
    <circle cx="9.6" cy="7.6" r="0.55" fill="#FFF" stroke="none"/>
    <circle cx="13.9" cy="7.2" r="0.55" fill="#FFF" stroke="none"/>
    <circle cx="11.9" cy="9.3" r="0.55" fill="#FFF" stroke="none"/>
    <path d="M4.7 14.1c1.1-1 2.2-1 3.3 0s2.2 1 3.3 0s2.2-1 3.3 0s2.2 1 3.3 0"/>
    <path d="M5.1 17.4h13.8"/>
    <path d="M5.2 20.4h13.6c0-1.7-1.3-3-3.1-3H8.3c-1.8 0-3.1 1.3-3.1 3Z"/>`,
  pizza: `<path d="M4.6 8.1a7.4 3.2 0 0 1 14.8 0Z"/>
    <path d="M5.4 9.4c.5 1.3 3.4 6.9 5.7 11.2c.4.8 1.4.8 1.8 0c2.3-4.3 5.2-9.9 5.7-11.2"/>
    <circle cx="9.4" cy="10.4" r="1.1"/>
    <circle cx="14.2" cy="10.1" r="1"/>
    <circle cx="12" cy="14.2" r="0.95"/>`,
  sushi: `<circle cx="7.3" cy="14.4" r="4.7"/>
    <circle cx="7.3" cy="14.4" r="1.8"/>
    <circle cx="7.3" cy="14.4" r="0.5" fill="#FFF" stroke="none"/>
    <g transform="rotate(-14 16.4 12.6)">
      <rect x="12.4" y="11.2" width="8" height="4.2" rx="2.1"/>
      <rect x="13.2" y="8.5" width="6.4" height="3.2" rx="1.6"/>
    </g>`,
  pollo: `<path d="M14.6 3.9a5.7 5.7 0 0 1 5.5 5.9c-.2 3.2-2.5 5.1-5 5.6c-1.9.4-3.1 1.2-4 2.6c-.4.6-1.2.7-1.7.2l-3.1-3.1c-.5-.5-.5-1.3.1-1.7c1.4-1 2.2-2.2 2.5-4.1c.5-3 2.7-5.3 5.7-5.4Z"/>
    <path d="M7.5 16.5l-2.9 2.9"/>
    <circle cx="3.7" cy="18.6" r="1.5"/>
    <circle cx="5.4" cy="20.3" r="1.5"/>`,
  paella: `<ellipse cx="12" cy="10.8" rx="8.9" ry="4.9"/>
    <path d="M3.1 10.8c0 3.8 4 6.3 8.9 6.3s8.9-2.5 8.9-6.3"/>
    <path d="M3.1 10c-1.5.3-2.2 1-2.2 1.9c0 1 1 1.8 2.5 2"/>
    <path d="M20.9 10c1.5.3 2.2 1 2.2 1.9c0 1-1 1.8-2.5 2"/>
    <path d="M8.9 9a1.9 1.9 0 1 0-1.9 1.9"/>
    <path d="M8.9 9l1.3-.9"/>
    <path d="M8.9 9l1.6.4"/>
    <circle cx="8.9" cy="10.9" r="0.45" fill="#FFF" stroke="none"/>
    <path d="M14.3 9.4a2.2 2.2 0 0 1 2.2 2.2h-2.2Z"/>
    <circle cx="13" cy="13" r="0.45" fill="#FFF" stroke="none"/>`,
  ensalada: `<path d="M4.5 12.8h15a7.5 7.5 0 0 1-15 0Z"/>
    <circle cx="8.3" cy="10.2" r="2.1"/>
    <circle cx="12.1" cy="9.3" r="2.4"/>
    <circle cx="15.9" cy="10.2" r="2.1"/>`,
  ramen: `<path d="M4.2 11.6h15.6a7.8 7.8 0 0 1-15.6 0Z"/>
    <path d="M9.6 19.2h4.8"/>
    <path d="M14.2 3.2L10 10"/>
    <path d="M18 2.4l-3.2 7.4"/>
    <path d="M7.3 14.2c.9.8 1.9.8 2.8 0s1.9-.8 2.8 0s1.9.8 2.8 0"/>`,
  postre: `<path d="M5.2 19.3v-8.1c0-.7.5-1.2 1.2-1.2h11.2c.7 0 1.2.5 1.2 1.2v8.1Z"/>
    <path d="M5.2 12.2c1.13 1.5 2.27 1.5 3.4 0c1.13 1.5 2.27 1.5 3.4 0c1.13 1.5 2.27 1.5 3.4 0c1.13 1.5 2.27 1.5 3.4 0"/>
    <path d="M8.7 16.3h6.6"/>
    <circle cx="12" cy="8.6" r="1.1"/>`,
  mercado: `<path d="M5.4 10.8V19h13.2v-8.2"/>
    <path d="M4.4 5.3h15.2l1.1 4.1c0 1.2-1 2.2-2.2 2.2s-2.2-1-2.2-2.2c0 1.2-1 2.2-2.2 2.2s-2.2-1-2.2-2.2c0 1.2-1 2.2-2.2 2.2s-2.2-1-2.2-2.2c0 1.2-1 2.2-2.2 2.2s-2.1-1-2.1-2.2Z"/>
    <path d="M9.4 19v-4.4h5.2V19"/>`,
  inicio: `<path d="M4.2 11.4 12 4.6l7.8 6.8"/>
    <path d="M6.3 9.9V18a1.9 1.9 0 0 0 1.9 1.9h7.6a1.9 1.9 0 0 0 1.9-1.9V9.9"/>
    <path d="M10.1 19.7v-3.9a1.9 1.9 0 0 1 3.8 0v3.9"/>`,
  pedidos: `<path d="M5.9 8.3h12.2l-.9 10.4a2.1 2.1 0 0 1-2.1 1.9H8.9a2.1 2.1 0 0 1-2.1-1.9Z"/>
    <path d="M9.1 8V6.9a2.9 2.9 0 0 1 5.8 0V8"/>`,
  mapa: `<path d="M12 20.7s-6.6-5.5-6.6-10.1A6.6 6.6 0 0 1 12 4a6.6 6.6 0 0 1 6.6 6.6c0 4.6-6.6 10.1-6.6 10.1Z"/>
    <circle cx="12" cy="10.4" r="2.4"/>`,
  perfil: `<circle cx="12" cy="8" r="3.6"/>
    <path d="M5.4 19.8a6.6 6.1 0 0 1 13.2 0"/>`,
  rayo: `<path d="M13.4 2.9 5.7 13.5h4.9l-1.7 7.6 7.7-10.6h-4.9Z"/>`,
  dolar: `<circle cx="12" cy="12" r="8.7"/>
    <path d="M12 6.9v10.2"/>
    <path d="M14.8 9.1c-.6-1-1.6-1.5-2.8-1.5c-1.7 0-3 .9-3 2.3c0 2.9 5.9 1.5 5.9 4.4c0 1.4-1.3 2.3-3 2.3c-1.3 0-2.4-.6-3-1.6"/>`,
  estrella: `<path d="M12 3.7l2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8Z"/>`,
  lupa: `<circle cx="10.9" cy="10.9" r="6.5"/>
    <path d="M15.7 15.7 20.5 20.5"/>`,
  corazon: `<path d="M12 20.1S4.1 15.4 4.1 9.7C4.1 7 6.1 5.1 8.4 5.1c1.5 0 2.9.8 3.6 2c.7-1.2 2.1-2 3.6-2c2.3 0 4.3 1.9 4.3 4.6c0 5.7-7.9 10.4-7.9 10.4Z"/>`,
  luna: `<path d="M19.9 14.3A8.5 8.5 0 0 1 9.7 4.1a8.5 8.5 0 1 0 10.2 10.2Z"/>`,
  sliders: `<path d="M4.5 6.6h3.2"/>
    <path d="M11.5 6.6h8"/>
    <circle cx="9.6" cy="6.6" r="1.9"/>
    <path d="M4.5 12h8.6"/>
    <path d="M16.9 12h2.6"/>
    <circle cx="15" cy="12" r="1.9"/>
    <path d="M4.5 17.4h1.8"/>
    <path d="M10.1 17.4h9.4"/>
    <circle cx="8.2" cy="17.4" r="1.9"/>`,
  reloj: `<circle cx="12" cy="12" r="8.5"/>
    <path d="M12 7.5V12l3.2 2"/>`,
  medalla: `<circle cx="12" cy="9.3" r="5.3"/>
    <circle cx="12" cy="9.3" r="2.4"/>
    <path d="M9.3 13.7 7.5 20.2l4.5-2.5l4.5 2.5l-1.8-6.5"/>`,
  regalo: `<path d="M5 11.7h14v7.7a1.7 1.7 0 0 1-1.7 1.7H6.7A1.7 1.7 0 0 1 5 19.4Z"/>
    <path d="M4.1 8.4h15.8V11.7H4.1Z"/>
    <path d="M12 8.4v12.7"/>
    <path d="M12 8.2c-1.8-.2-4.3-.7-4.3-2.6c0-1.3 1.2-2.2 2.3-1.8c1.6.5 2 2.8 2 4.4c0-1.6.4-3.9 2-4.4c1.2-.4 2.3.5 2.3 1.8c0 1.9-2.5 2.4-4.3 2.6Z"/>`,
};

const STROKE = 1.8;
// Iconos densos que necesitan trazo más fino para no empastarse
const THIN_ICONS = new Set(["paella"]);
const CELL = 150;
const ICON_BOX = 108;
const COLS = 7;

async function main() {
  const names = Object.keys(ICONS);
  const rows = Math.ceil(names.length / COLS);
  const sheetW = COLS * CELL;
  const sheetH = rows * CELL + 10;

  const circles = [];
  const composites = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cx = col * CELL + CELL / 2;
    const cy = row * CELL + CELL / 2;

    circles.push(
      `<circle cx="${cx}" cy="${cy}" r="${CELL / 2 - 12}" fill="#E60000"/>` +
      `<text x="${cx}" y="${cy + CELL / 2 - 16}" font-family="sans-serif" font-size="13" fill="#FFF" text-anchor="middle">${name}</text>`
    );

    const w = THIN_ICONS.has(name) ? 1.5 : STROKE;
    const iconSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`
    );
    const iconPng = await sharp(iconSvg)
      .resize(ICON_BOX, ICON_BOX)
      .png()
      .toBuffer();
    composites.push({
      input: iconPng,
      left: Math.round(cx - ICON_BOX / 2),
      top: Math.round(cy - ICON_BOX / 2),
    });
  }

  const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}">
    <rect width="100%" height="100%" fill="#2E2E2E"/>
    ${circles.join("\n")}
  </svg>`;

  fs.mkdirSync("logs", { recursive: true });
  await sharp(Buffer.from(bg))
    .composite(composites)
    .png()
    .toFile(path.join("logs", "comeya-icons-preview.png"));
  console.log("OK -> logs/comeya-icons-preview.png", names.length, "iconos");
}

module.exports = { ICONS };
if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
