// Script para verificar órdenes y estadísticas
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function checkOrders() {
  const mysqlUrl = process.env.MYSQL_DATABASE_URL || process.env.DATABASE_URL;
  const url = new URL(mysqlUrl);

  const connection = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port || "3306"),
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: false },
  });

  console.log("✅ Connected to database\n");

  // Ver todas las órdenes
  const [orders] = await connection.execute(`
    SELECT 
      id, 
      business_id,
      status,
      subtotal,
      DATE(created_at) as order_date,
      created_at
    FROM orders 
    ORDER BY created_at DESC
  `);

  console.log("📦 TODAS LAS ÓRDENES:");
  console.table(orders);

  // Ver órdenes de hoy por negocio
  const [todayOrders] = await connection.execute(`
    SELECT 
      b.name as business_name,
      COUNT(*) as total_orders,
      SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN o.status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN o.status = 'delivered' THEN o.subtotal ELSE 0 END) as revenue
    FROM orders o
    JOIN businesses b ON o.business_id = b.id
    WHERE DATE(o.created_at) = CURDATE()
    GROUP BY b.id, b.name
  `);

  console.log("\n📊 ÓRDENES DE HOY POR NEGOCIO:");
  console.table(todayOrders);

  // Ver negocios
  const [businesses] = await connection.execute(`
    SELECT id, name, owner_id FROM businesses WHERE is_active = 1
  `);

  console.log("\n🏪 NEGOCIOS ACTIVOS:");
  console.table(businesses);

  await connection.end();
}

checkOrders().catch(console.error);
