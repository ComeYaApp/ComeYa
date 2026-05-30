import { connection } from "./db";

/**
 * Execute a query with automatic retry on connection errors
 */
export async function executeWithRetry<T>(
  queryFn: (conn: any) => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let conn;
    try {
      console.log(`🔄 Database query attempt ${attempt}/${maxRetries}`);

      // Get connection from pool
      conn = await connection.getConnection();

      // Execute query
      const result = await queryFn(conn);

      console.log(`✅ Query successful on attempt ${attempt}`);
      return result;
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Attempt ${attempt} failed:`, error.message, error.code);

      // If it's a connection error, wait and retry
      if (
        error.code === "ECONNRESET" ||
        error.code === "ETIMEDOUT" ||
        error.code === "PROTOCOL_CONNECTION_LOST"
      ) {
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } else {
        // Non-connection error, don't retry
        throw error;
      }
    } finally {
      if (conn) {
        try {
          conn.release();
        } catch (releaseError) {
          console.error("Error releasing connection:", releaseError);
        }
      }
    }
  }

  // All retries failed
  console.error("❌ All retry attempts exhausted");
  throw lastError;
}

/**
 * Simple query helper
 */
export async function queryWithRetry<T = any>(
  sql: string,
  params: any[] = [],
): Promise<T[]> {
  return executeWithRetry(async (conn) => {
    const [rows] = await conn.query(sql, params);
    return rows as T[];
  });
}
