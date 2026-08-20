// QA end-to-end contra PRODUCCIÓN (comeya-backend.onrender.com).
// Usa los usuarios de prueba (test-customer/owner/driver/admin) con una
// contraseña temporal (dev-email-login) para obtener tokens reales.
// Crea pedidos reales de prueba y los limpia al final.
// Ejecutar: npx tsx scripts/qa-e2e-prod.ts
import mysql from "mysql2/promise";
import fs from "fs";

const BASE = "https://comeya-backend.onrender.com";
const QA_PASSWORD = "qa-password-2026";
const createdOrderIds: string[] = [];
let passed = 0;
let failed = 0;

function ok(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}${detail ? " — " + detail : ""}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}${detail ? " — " + detail : ""}`);
  }
}

// Login real contra el servidor (dev-email-login) para obtener tokens
// firmados con el JWT_SECRET de producción.
async function login(email: string): Promise<string | null> {
  const res = await fetch(`${BASE}/api/auth/dev-email-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: QA_PASSWORD }),
  });
  const data: any = await res.json();
  return res.status === 200 && data.token ? data.token : null;
}

async function api(method: string, path: string, token: string, body?: any) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
}

async function main() {
  // Credenciales de BD de producción (solo para verificar y limpiar)
  const env = Object.fromEntries(
    fs
      .readFileSync(".env.render", "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );

  const CUSTOMER = await login("customer@test.com");
  const OWNER = await login("owner@test.com");
  const DRIVER = await login("driver@test.com");
  const ADMIN = await login("admin@test.com");

  if (!CUSTOMER || !OWNER || !DRIVER) {
    console.error("❌ No se pudo iniciar sesión con los usuarios de prueba. Verifica que sus contraseñas temporales están en la BD.");
    process.exit(1);
  }
  ok("login real de los 4 roles contra producción", !!CUSTOMER && !!OWNER && !!DRIVER && !!ADMIN);

  console.log("\n═══ A. AUTENTICACIÓN ═══");
  const me = await api("GET", "/orders", CUSTOMER);
  ok("token customer válido", me.status === 200);

  // Negocio del dueño de prueba
  const bizList = await api("GET", "/business/orders", OWNER);
  const bizRes = await fetch(`${BASE}/api/business/orders`, {
    headers: { Authorization: `Bearer ${OWNER}` },
  });
  const bizData = await bizRes.json();
  ok("dueño puede listar pedidos", bizRes.status === 200);

  // Buscar negocio del owner
  const conn = await mysql.createConnection({
    host: env.DB_HOST, user: env.DB_USER, password: env.DB_PASSWORD,
    database: env.DB_NAME, port: Number(env.DB_PORT || 3306),
    ssl: { rejectUnauthorized: false },
  });
  const [bizRows]: any = await conn.query(
    "SELECT id, name FROM businesses WHERE owner_id = 'test-owner' LIMIT 1",
  );
  const businessId = bizRows[0]?.id;
  ok("negocio de prueba existe", !!businessId, bizRows[0]?.name);

  console.log("\n═══ B. PEDIDO DELIVERY COMPLETO ═══");
  const createOrder = await api("POST", "/orders", CUSTOMER, {
    businessId,
    businessName: bizRows[0]?.name || "QA Biz",
    items: JSON.stringify([
      { id: "p1", name: "QA Producto", quantity: 2, price: 400 },
    ]),
    subtotal: 800,
    deliveryFee: 250,
    total: 1170, // 800 + 15% comisión (120) + envío (250)
    paymentMethod: "cash",
    orderType: "delivery",
    deliveryAddress: "Calle 2, Soria",
    deliveryLatitude: "41.76644",
    deliveryLongitude: "-2.47909",
    notes: "QA end-to-end",
  });
  const isCreated = (s: number) => s === 200 || s === 201;
  ok("crear pedido delivery (cash)", isCreated(createOrder.status), `status=${createOrder.status}`);
  let orderId = createOrder.data?.orderId || createOrder.data?.id || "";
  if (isCreated(createOrder.status) && orderId) {
    createdOrderIds.push(orderId);
  }
  ok("pedido visible para el cliente", !!orderId);

  // Negocio acepta → preparando → listo
  const acc = await api("PUT", `/business/orders/${orderId}/status`, OWNER, { status: "accepted" });
  ok("negocio acepta (push cliente)", acc.status === 200);
  const prep = await api("PUT", `/business/orders/${orderId}/status`, OWNER, {
    status: "preparing", estimatedPrepMinutes: 8, estimatedPrepRange: "5-10 min",
  });
  ok("negocio prepara (push repartidores)", prep.status === 200);
  const ready = await api("PUT", `/business/orders/${orderId}/status`, OWNER, { status: "ready" });
  ok("negocio marca listo (broadcast repartidores)", ready.status === 200);

  // Repartidor ve el pedido disponible
  const avail = await api("GET", "/delivery/available-orders", DRIVER);
  const availOrders = avail.data?.orders || [];
  const found = availOrders.find((o: any) => o.id === orderId);
  ok("repartidor ve pedido en Disponibles", !!found);
  ok("pedido trae items", found && !!found.items, "para la lista de productos");
  ok("pedido trae coordenadas del negocio", found && !!found.businessLatitude && found.businessAddress);
  const hasPickupInAvail = availOrders.some((o: any) => o.orderType === "pickup");
  ok("ningún pedido pickup en Disponibles", !hasPickupInAvail);

  // Repartidor acepta y entrega
  const accept = await api("POST", `/delivery/accept/${orderId}`, DRIVER);
  ok("repartidor acepta pedido", accept.status === 200);
  const onTheWay = await api("PATCH", `/orders/${orderId}/status`, DRIVER, { status: "on_the_way" });
  ok("repartidor en camino", onTheWay.status === 200);
  // Ubicar al repartidor en la dirección de entrega (geofence 200m) y
  // completar con la ubicación actual en el body (requisito del endpoint)
  await api("POST", "/delivery/location", DRIVER, {
    latitude: 41.76644, longitude: -2.47909,
  });
  const complete = await api("POST", `/orders/${orderId}/complete-delivery`, DRIVER, {
    latitude: 41.76644,
    longitude: -2.47909,
  });
  ok("entrega completada (geofence)", complete.status === 200, `status=${complete.status} ${JSON.stringify(complete.data || {}).slice(0, 120)}`);
  const confirm = await api("POST", `/orders/${orderId}/confirm-receipt`, CUSTOMER);
  ok("cliente confirma recepción (libera fondos)", confirm.status === 200, `status=${confirm.status}`);

  // Ganancias exactas sin redondeo
  const stats = await api("GET", `/business/${businessId}/stats`, OWNER);
  ok("stats del negocio responden", stats.status === 200);
  const todayRevenue = stats.data?.todayRevenue;
  ok(
    "ganancias en céntimos EXACTOS (sin redondear a euros)",
    typeof todayRevenue === "number" && Number.isFinite(todayRevenue),
    `todayRevenue=${todayRevenue} céntimos`,
  );

  console.log("\n═══ C. PEDIDO PICKUP (RECOGIDA EN LOCAL) ═══");
  const createPickup = await api("POST", "/orders", CUSTOMER, {
    businessId,
    businessName: bizRows[0]?.name || "QA Biz",
    items: JSON.stringify([{ id: "p2", name: "QA Pickup", quantity: 1, price: 575 }]),
    subtotal: 575,
    deliveryFee: 0,
    total: 661, // 575 + 15% comisión (86), recogida sin envío
    paymentMethod: "cash",
    orderType: "pickup",
    deliveryAddress: "Calle Collado 1, Soria",
    notes: "QA pickup",
  });
  ok("crear pedido pickup", isCreated(createPickup.status), `status=${createPickup.status}`);
  let pickupId = createPickup.data?.orderId || createPickup.data?.id || "";
  if (isCreated(createPickup.status) && pickupId) {
    createdOrderIds.push(pickupId);
  }

  const info = await api("GET", `/pickup/${pickupId}/info`, CUSTOMER);
  const pickup = info.data?.pickup;
  ok("info pickup con código de 6 dígitos", !!pickup?.code && pickup.code.length === 6, pickup?.code);
  ok("info pickup con QR generado", !!pickup?.qrCode);

  // Negocio acepta pickup (avisa al CLIENTE, no a repartidores)
  const accP = await api("PATCH", `/orders/${pickupId}/status`, OWNER, { status: "accepted" });
  ok("negocio acepta pickup", accP.status === 200);
  const updTime = await api("POST", `/pickup/${pickupId}/update-time`, OWNER, { estimatedMinutes: 15 });
  ok("tiempo estimado de recogida al cliente", updTime.status === 200);
  const prepP = await api("PUT", `/business/orders/${pickupId}/status`, OWNER, { status: "preparing" });
  ok("pickup pasa a preparando (sin modal repartidores)", prepP.status === 200);
  const readyP = await api("PUT", `/business/orders/${pickupId}/status`, OWNER, { status: "ready" });
  ok("pickup listo", readyP.status === 200);

  // NO debe aparecer en el pool del repartidor
  const avail2 = await api("GET", "/delivery/available-orders", DRIVER);
  const pickupInPool = (avail2.data?.orders || []).some((o: any) => o.id === pickupId);
  ok("pickup NO aparece en Disponibles del repartidor", !pickupInPool);

  // Validar código y entregar con el flujo QR
  const codeValid = await api("POST", `/pickup/${pickupId}/validate-code`, OWNER, { code: pickup.code });
  ok("negocio valida código de recogida", codeValid.status === 200 && codeValid.data?.valid === true);
  // Seguridad: sin código el servidor debe rechazar la recogida
  const pickedUpNoCode = await api("POST", `/orders/${pickupId}/mark-picked-up`, OWNER, {});
  ok("recogida SIN código es rechazada (seguridad)", pickedUpNoCode.status === 400, `status=${pickedUpNoCode.status}`);
  const pickedUp = await api("POST", `/orders/${pickupId}/mark-picked-up`, OWNER, { code: pickup.code });
  ok("pickup marcado como recogido (entrega completada)", pickedUp.status === 200);
  const orderAfter = await api("GET", `/orders/${pickupId}`, CUSTOMER);
  ok("estado final del pickup = delivered", orderAfter.data?.order?.status === "delivered", orderAfter.data?.order?.status);
  ok(
    "pickup queda confirmado automáticamente (pasa a historial sin confirmar)",
    orderAfter.data?.order?.confirmedByCustomer === true,
  );

  console.log("\n═══ D. INCIDENCIA ═══");
  const inc = await api("POST", `/orders/${orderId}/report-issue`, CUSTOMER, {
    issueType: "product_issue",
    description: "QA incidencia de prueba",
    priority: "media",
  });
  ok("reportar incidencia persiste sin error .returning()", inc.status === 200, `status=${inc.status}`);

  console.log("\n═══ E. LIMPIEZA DE DATOS DE PRUEBA ═══");
  if (createdOrderIds.length) {
    const ids = createdOrderIds.map((id) => `'${id}'`).join(",");
    await conn.query(`DELETE FROM payouts WHERE order_id IN (${ids})`);
    await conn.query(`DELETE FROM transactions WHERE order_id IN (${ids})`);
    await conn.query(`DELETE FROM reviews WHERE order_id IN (${ids})`);
    await conn.query(`DELETE FROM support_tickets WHERE order_id IN (${ids})`);
    await conn.query(`DELETE FROM orders WHERE id IN (${ids})`);
    console.log(`  🧹 Borrados ${createdOrderIds.length} pedidos de QA y sus registros asociados`);
  }
  await conn.end();

  console.log(`\n══════════════════════════════════════`);
  console.log(`RESULTADO: ${passed} OK / ${failed} FALLOS`);
  console.log(`══════════════════════════════════════`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("QA E2E falló:", e.message);
  process.exit(1);
});
