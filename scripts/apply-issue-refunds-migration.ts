// Aplica migrations/order_issues_and_refunds.sql de forma idempotente.
// Uso: npx tsx scripts/apply-issue-refunds-migration.ts
import "dotenv/config";
import fs from "fs";
import path from "path";

async function main() {
  const { db } = await import("../server/db");
  const { sql } = await import("drizzle-orm");

  const content = fs.readFileSync(
    path.join(process.cwd(), "migrations/order_issues_and_refunds.sql"),
    "utf-8",
  );

  const statements = content
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    // Quita comentarios de línea para no partir statements por ellos
    .map((s) =>
      s
        .split("\n")
        .filter((l) => !l.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      await db.execute(sql.raw(stmt));
      console.log("OK:", stmt.slice(0, 60).replace(/\n/g, " ") + "...");
    } catch (err: any) {
      // 1050 tabla existente / 1060 columna duplicada: la migración es idempotente
      if (err?.errno === 1050 || err?.errno === 1060) {
        console.log("YA EXISTE:", stmt.slice(0, 50).replace(/\n/g, " ") + "...");
      } else {
        console.error("ERROR:", err?.message || err);
        console.error("STATEMENT:", stmt.slice(0, 200));
        process.exit(1);
      }
    }
  }
  console.log("Migración aplicada ✔");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
