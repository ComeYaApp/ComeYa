// Diagnóstico de ENVÍO push: prueba la entrega real a un usuario concreto
// usando la API nueva de Expo (proyecto de la organización, EXPO_ACCESS_TOKEN)
// y, si falla, el endpoint legacy (tokens del proyecto personal).
//
// Uso (desde la carpeta server/):
//   npx tsx checkPushDelivery.ts <userId | email>
//   npx tsx checkPushDelivery.ts --list        (lista usuarios con token)
//
// Sin argumentos: envía la prueba al usuario con token más reciente.
import { config } from "dotenv";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

config({ path: ".env.local", override: true });

const NEW_PUSH_API = "https://api.expo.dev/v2/push/send";
const LEGACY_PUSH_API = "https://exp.host/--/api/v2/push/send";

async function send(endpoint: string, message: any, accessToken?: string) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(message),
  });
  const text = await response.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { httpStatus: response.status, json, text };
}

async function main() {
  const arg = process.argv[2];
  const mysqlUrl = process.env.MYSQL_DATABASE_URL || process.env.DATABASE_URL;
  if (!mysqlUrl) {
    console.error("❌ No se encontró MYSQL_DATABASE_URL ni DATABASE_URL");
    process.exit(1);
  }

  const url = new URL(mysqlUrl);
  const caEnv = process.env.AIVEN_CA_CERT;
  const caPath = path.join(process.cwd(), "ca.pem");
  const ca = caEnv
    ? Buffer.from(caEnv, "base64").toString("utf-8")
    : fs.existsSync(caPath)
      ? fs.readFileSync(caPath, "utf-8")
      : null;

  const conn = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port || "3306"),
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false },
    connectTimeout: 30000,
    charset: "utf8mb4",
  });

  try {
    if (arg === "--list") {
      const [rows] = (await conn.query(
        `SELECT id, name, phone, role, push_token, updated_at
         FROM users
         WHERE push_token IS NOT NULL AND push_token <> ''
         ORDER BY updated_at DESC LIMIT 20`,
      )) as [any[], unknown];
      console.log(`\n📱 Usuarios con push_token: ${rows.length}\n`);
      for (const r of rows) {
        console.log(
          `- ${r.name ?? "(sin nombre)"} | ${r.phone ?? "-"} | ${r.role ?? "-"} | id: ${r.id}`,
        );
      }
      return;
    }

    const [rows] = (await conn.query(
      arg
        ? `SELECT id, name, role, push_token FROM users
           WHERE (id = ? OR email = ?) AND push_token IS NOT NULL AND push_token <> ''
           LIMIT 1`
        : `SELECT id, name, role, push_token FROM users
           WHERE push_token IS NOT NULL AND push_token <> ''
           ORDER BY updated_at DESC LIMIT 1`,
      arg ? [arg, arg] : [],
    )) as [any[], unknown];

    const user = rows[0];
    if (!user) {
      console.error("❌ No se encontró ningún usuario con push_token");
      process.exit(1);
    }

    const message = {
      to: user.push_token,
      sound: "default",
      title: "🔔 Prueba de notificaciones ComeYa",
      body: "Si lees esto, los push funcionan de nuevo.",
      data: { screen: "Home", diagnostic: true },
    };

    console.log(
      `\n🎯 Destinatario: ${user.name ?? "-"} (${user.role ?? "-"}) — id ${user.id}`,
    );
    console.log(`   token: ${user.push_token}`);
    console.log(
      `   EXPO_ACCESS_TOKEN configurado: ${process.env.EXPO_ACCESS_TOKEN ? "SÍ ✅" : "NO ❌"}\n`,
    );

    console.log("── 1) API nueva de Expo (organización) ──────────────");
    const newResult = await send(
      NEW_PUSH_API,
      message,
      process.env.EXPO_ACCESS_TOKEN,
    );
    console.log(`HTTP ${newResult.httpStatus}`);
    console.log(JSON.stringify(newResult.json ?? newResult.text, null, 2));

    console.log("\n── 2) Endpoint legacy (tokens del proyecto personal) ──");
    const legacyResult = await send(LEGACY_PUSH_API, message);
    console.log(`HTTP ${legacyResult.httpStatus}`);
    console.log(JSON.stringify(legacyResult.json ?? legacyResult.text, null, 2));

    const newOk = newResult.json?.data?.[0]?.status === "ok";
    const legacyOk =
      legacyResult.json?.data?.status === "ok" ||
      legacyResult.json?.data?.[0]?.status === "ok";

    console.log("\n──────────────────────────────────────────────────────");
    console.log(
      newOk
        ? "✅ API nueva: ENTREGADO (los tokens del build nuevo funcionan)"
        : "❌ API nueva: FALLÓ — revisa EXPO_ACCESS_TOKEN (permiso push) y las credenciales APNs/FCM del proyecto de la organización",
    );
    console.log(
      legacyOk
        ? "✅ Legacy: ENTREGADO (los tokens del build antiguo funcionan)"
        : "⚠️ Legacy: falló también — el token puede ser inválido o el dispositivo no tiene la app instalada",
    );
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
