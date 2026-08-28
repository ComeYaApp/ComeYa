import { config } from "dotenv";
config({ path: "C:/CY/.env.local", override: true });
import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [failed] = await conn.query("SELECT status, COUNT(*) AS c FROM refunds GROUP BY status");
const [det] = await conn.query(`SELECT r.id, r.status, r.amount, r.method, o.paid_at FROM refunds r JOIN orders o ON o.id = r.order_id WHERE r.status = 'failed'`);
console.log(JSON.stringify({ refundsPorEstado: failed, failedDetalle: det }, null, 2));
await conn.end();
