// Saneamiento de coordenadas: geocodifica con Google Maps (clave del
// servidor) todos los negocios y direcciones guardados sin lat/lng.
// Uso (producción): npx tsx -r dotenv/config scripts/geocode-missing-coords.ts dotenv_config_path=.env.render
import fs from "fs";
import mysql from "mysql2/promise";

const envPath = process.env.DOTENV_CONFIG_PATH || ".env.render";
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [
      l.slice(0, l.indexOf("=")).trim(),
      l.slice(l.indexOf("=") + 1).trim(),
    ]),
);

const GMAPS_KEY =
  env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || env.GOOGLE_MAPS_API_KEY || "";

async function geocode(
  conn: any,
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  if (!GMAPS_KEY) throw new Error("Sin GOOGLE_MAPS_API_KEY en " + envPath);
  const base = address.trim();
  const q = base.toLowerCase().includes("soria") ? base : `${base}, Soria, España`;
  const cacheKey = q.toLowerCase().trim();

  // Caché persistente: una dirección se geocodifica UNA sola vez
  const [cached]: any = await conn.query(
    `SELECT lat, lng FROM geocode_cache WHERE address_key = ? LIMIT 1`,
    [cacheKey],
  );
  if (cached[0]) return { lat: Number(cached[0].lat), lng: Number(cached[0].lng) };

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${GMAPS_KEY}`,
  );
  const data = await res.json() as any;
  if (data.status === "OK" && data.results?.[0]) {
    const { lat, lng } = data.results[0].geometry.location;
    await conn.query(
      `INSERT INTO geocode_cache (address_key, lat, lng, formatted_address)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE lat = VALUES(lat), lng = VALUES(lng)`,
      [cacheKey, lat, lng, data.results[0].formatted_address || ""],
    );
    return { lat, lng };
  }
  console.warn(`  ⚠️ Google no encontró: "${q}" (${data.status})`);
  return null;
}

(async () => {
  console.log(`🗺️  Saneamiento de coordenadas (${envPath})`);
  console.log(`   Clave Google: ${GMAPS_KEY ? "OK" : "FALTA"}`);

  const conn = await mysql.createConnection({
    host: env.DB_HOST || env.MYSQLHOST,
    user: env.DB_USER || env.MYSQLUSER,
    password: env.DB_PASSWORD || env.MYSQLPASSWORD,
    database: env.DB_NAME || env.MYSQLDATABASE,
    port: Number(env.DB_PORT || env.MYSQLPORT || 3306),
    ssl: { rejectUnauthorized: false },
    multipleStatements: false,
  });

  // Tabla de caché persistente (creada también por el servidor)
  await conn.query(`CREATE TABLE IF NOT EXISTS geocode_cache (
    address_key VARCHAR(255) PRIMARY KEY,
    lat DOUBLE NOT NULL,
    lng DOUBLE NOT NULL,
    formatted_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  // 1) Negocios sin coordenadas
  const [bizRows] = (await conn.query(
    `SELECT id, name, address FROM businesses
     WHERE address IS NOT NULL AND address != ''
       AND (latitude IS NULL OR latitude = '' OR longitude IS NULL OR longitude = '')`,
  )) as any[];

  console.log(`\n🏪 Negocios sin coordenadas: ${bizRows.length}`);
  let bizFixed = 0;
  for (const b of bizRows) {
    const geo = await geocode(conn, b.address);
    if (geo) {
      await conn.query(
        `UPDATE businesses SET latitude = ?, longitude = ? WHERE id = ?`,
        [String(geo.lat), String(geo.lng), b.id],
      );
      bizFixed++;
      console.log(`  ✅ ${b.name} → ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}`);
    }
  }

  // 2) Direcciones de clientes sin coordenadas
  const [addrRows] = (await conn.query(
    `SELECT id, label, street, city FROM addresses
     WHERE (latitude IS NULL OR latitude = '' OR longitude IS NULL OR longitude = '')`,
  )) as any[];

  console.log(`\n🏠 Direcciones sin coordenadas: ${addrRows.length}`);
  let addrFixed = 0;
  for (const a of addrRows) {
    const geo = await geocode(conn, `${a.street}, ${a.city || "Soria"}`);
    if (geo) {
      await conn.query(
        `UPDATE addresses SET latitude = ?, longitude = ? WHERE id = ?`,
        [String(geo.lat), String(geo.lng), a.id],
      );
      addrFixed++;
      console.log(`  ✅ ${a.label || a.street} → ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}`);
    }
  }

  console.log(
    `\n🎉 Listo: ${bizFixed}/${bizRows.length} negocios y ${addrFixed}/${addrRows.length} direcciones geocodificados`,
  );
  await conn.end();
  process.exit(0);
})().catch((e) => {
  console.error("GEOCODE SCRIPT FALLÓ:", e.message);
  process.exit(1);
});
