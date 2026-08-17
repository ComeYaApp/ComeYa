// Crea la tabla delivery_requests (Plan Logística Local B2B) si no existe.
import fs from "fs";
import mysql from "mysql2/promise";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [
      l.slice(0, l.indexOf("=")).trim(),
      l.slice(l.indexOf("=") + 1).trim(),
    ]),
);

(async () => {
  const conn = await mysql.createConnection({
    host: env.DB_HOST || env.MYSQLHOST,
    user: env.DB_USER || env.MYSQLUSER,
    password: env.DB_PASSWORD || env.MYSQLPASSWORD,
    database: env.DB_NAME || env.MYSQLDATABASE,
    port: Number(env.DB_PORT || env.MYSQLPORT || 3306),
    ssl: { rejectUnauthorized: false },
  });

  await conn.query(`
    CREATE TABLE IF NOT EXISTS delivery_requests (
      id varchar(255) PRIMARY KEY,
      business_id varchar(255) NOT NULL,
      business_name varchar(255) NOT NULL,
      pickup_address text NOT NULL,
      pickup_latitude text,
      pickup_longitude text,
      dropoff_address text NOT NULL,
      dropoff_latitude text,
      dropoff_longitude text,
      contact_phone varchar(30),
      fee int NOT NULL DEFAULT 350,
      status varchar(20) NOT NULL DEFAULT 'pending',
      driver_id varchar(255),
      notes text,
      created_at datetime DEFAULT CURRENT_TIMESTAMP,
      accepted_at datetime,
      delivered_at datetime
    )
  `);
  console.log("✅ Tabla delivery_requests lista");
  await conn.end();
  process.exit(0);
})().catch((e) => {
  console.error("MIGRACIÓN FALLÓ:", e.message);
  process.exit(1);
});
