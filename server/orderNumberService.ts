/**
 * Numeración secuencial de pedidos con formato #CY000001.
 *
 * Usa una tabla contadora (order_number_sequence) con incremento atómico
 * vía LAST_INSERT_ID(expr) — seguro ante creaciones concurrentes — y una
 * columna UNIQUE en orders para garantizar que nunca se repite.
 */
import { db } from "./db";
import { sql } from "drizzle-orm";

/**
 * Reserva el siguiente número de pedido (atómico).
 * Devuelve el entero secuencial (1, 2, 3...) o null si falla.
 */
export async function nextOrderNumber(): Promise<number | null> {
  try {
    const [result] = (await db.execute(sql`
      INSERT INTO order_number_sequence (id, next_value)
      VALUES (1, 1)
      ON DUPLICATE KEY UPDATE next_value = LAST_INSERT_ID(next_value + 1)
    `)) as any;

    // mysql2 con drizzle: insertId queda poblado por LAST_INSERT_ID
    const insertId =
      (result as any)?.insertId ??
      (result as any)?.[0]?.insertId ??
      null;
    if (insertId && Number.isFinite(Number(insertId))) {
      return Number(insertId);
    }

    // Fallback: leer el valor actual tras el incremento
    const [rows] = (await db.execute(
      sql`SELECT next_value AS v FROM order_number_sequence WHERE id = 1`,
    )) as any;
    const row = (rows as any[])[0];
    return row ? Number(row.v) - 1 : null;
  } catch (error) {
    console.error("nextOrderNumber error:", error);
    return null;
  }
}

/** Formato público: 1 → "#CY000001". */
export function formatOrderNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "";
  return `#CY${String(Math.max(0, Math.trunc(Number(n)))).padStart(6, "0")}`;
}

/**
 * Referencia pública de un pedido para notificaciones y textos: "#CY000234".
 * Fallback al ID corto en mayúsculas para pedidos históricos sin número
 * (mismo criterio que displayOrderNumber del cliente).
 */
export function orderRef(order: {
  orderNumber?: number | null;
  id?: string | null;
} | null | undefined): string {
  const formatted = formatOrderNumber(order?.orderNumber as number | null);
  if (formatted) return formatted;
  const id = String(order?.id ?? "");
  return id ? `#${id.slice(-6).toUpperCase()}` : "#—";
}

/** Igual que orderRef, resolviendo el pedido desde la BD cuando solo hay id. */
export async function orderRefFromId(orderId: string): Promise<string> {
  if (!orderId) return "#—";
  try {
    const { orders } = await import("@shared/schema-mysql");
    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select({ orderNumber: orders.orderNumber, id: orders.id })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    return orderRef(row ?? { id: orderId });
  } catch {
    return `#${String(orderId).slice(-6).toUpperCase()}`;
  }
}

/**
 * Backfill idempotente: asigna números secuenciales a los pedidos históricos
 * ordenados por fecha de creación (el más antiguo = CY000001) y alinea el
 * contador con el máximo asignado. Se ejecuta al arrancar el servidor.
 *
 * Nota MySQL: el MAX no puede ir como subquery dentro del SET del UPDATE
 * (error 1093 "can't specify target table for update in FROM clause"), así
 * que se lee primero y se pasa como parámetro.
 */
export async function backfillOrderNumbers(): Promise<number> {
  try {
    // 1. Leer el máximo número ya asignado (0 si no hay ninguno)
    const [maxRows] = (await db.execute(
      sql`SELECT COALESCE(MAX(order_number), 0) AS base FROM orders`,
    )) as any;
    const base = Number((maxRows as any[])[0]?.base ?? 0);

    // 2. Asignar números a los pedidos que no tienen, por created_at.
    //    La derived table se anida dos veces para forzar su materialización.
    const [res] = (await db.execute(sql`
      UPDATE orders o
      JOIN (
        SELECT id, rn FROM (
          SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
          FROM orders
          WHERE order_number IS NULL
        ) t
      ) ranked ON ranked.id = o.id
      SET o.order_number = ranked.rn + ${base}
    `)) as any;

    // 3. Alinear el contador con el máximo número asignado
    await db.execute(sql`
      INSERT INTO order_number_sequence (id, next_value)
      VALUES (1, COALESCE((SELECT MAX(order_number) FROM orders), 0) + 1)
      ON DUPLICATE KEY UPDATE
        next_value = GREATEST(next_value, COALESCE((SELECT MAX(order_number) FROM orders), 0) + 1)
    `);

    const affected = Number((res as any)?.affectedRows ?? 0);
    if (affected > 0) {
      console.log(
        `🔢 Backfill de numeración: ${affected} pedidos numerados (base ${base})`,
      );
    }
    return affected;
  } catch (error) {
    console.error("backfillOrderNumbers error:", error);
    return 0;
  }
}

/** Crea tabla de secuencia + columna si no existen (idempotente). */
export async function ensureOrderNumberSchema(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS order_number_sequence (
        id TINYINT PRIMARY KEY DEFAULT 1,
        next_value INT NOT NULL DEFAULT 1
      )
    `);
    await db.execute(
      sql`ALTER TABLE orders ADD COLUMN order_number INT NULL`,
    );
    console.log("✅ Numeración de pedidos #CY asegurada");
  } catch (err: any) {
    // Columna ya existe — normal en arranques posteriores
    if (err?.code !== "ER_DUP_FIELDNAME" && err?.errno !== 1060) {
      console.error("ensureOrderNumberSchema:", err?.message ?? err);
    }
  }
  try {
    await db.execute(
      sql`CREATE UNIQUE INDEX idx_orders_order_number ON orders (order_number)`,
    );
  } catch {
    // índice ya existe
  }
}
