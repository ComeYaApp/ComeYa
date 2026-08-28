// Jobs Runner - Standalone process for background jobs
import dotenv from "dotenv";
import path from "path";
import { startBackgroundJobs } from "./backgroundJobs";
import { startPendingOrdersMonitor } from "./pendingOrdersMonitor";

// Load environment
dotenv.config({ path: path.join(process.cwd(), ".env.local") });
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

console.log("🚀 ComeYa Background Jobs Runner");
console.log(`📅 Started at: ${new Date().toISOString()}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV}`);

// Start all background jobs
startBackgroundJobs();
startPendingOrdersMonitor();

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down jobs runner...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Shutting down jobs runner...");
  process.exit(0);
});

console.log("✅ Jobs runner is active");
