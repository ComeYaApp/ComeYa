import jwt from "jsonwebtoken";
import { db } from "./db";
import { refreshTokens } from "../shared/schema-mysql";
import { eq, and, lt } from "drizzle-orm";

const JWT_SECRET =
  process.env.JWT_SECRET || "comeya-secret-key-change-in-production";
const REFRESH_SECRET =
  process.env.REFRESH_SECRET || "comeya-refresh-secret-change-in-production";
const ACCESS_TOKEN_EXPIRY = "30d"; // 30 días
const REFRESH_TOKEN_EXPIRY = "90d"; // 90 días

interface TokenPayload {
  userId: number;
  phone: string;
  role: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

export async function storeRefreshToken(
  userId: number,
  token: string,
  expiresAt: Date,
): Promise<void> {
  await db.insert(refreshTokens).values({
    userId,
    token,
    expiresAt,
    createdAt: new Date(),
  });
}

export async function verifyRefreshToken(
  token: string,
): Promise<TokenPayload | null> {
  try {
    // Verificar firma del token
    const decoded = jwt.verify(token, REFRESH_SECRET) as TokenPayload;

    // Verificar que el token existe en la base de datos y no ha sido revocado
    const [storedToken] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(eq(refreshTokens.token, token), eq(refreshTokens.revoked, false)),
      )
      .limit(1);

    if (!storedToken) {
      return null;
    }

    // Verificar que no ha expirado
    if (new Date() > storedToken.expiresAt) {
      await revokeRefreshToken(token);
      return null;
    }

    return decoded;
  } catch (error) {
    return null;
  }
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(eq(refreshTokens.token, token));
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(
      and(eq(refreshTokens.userId, userId), eq(refreshTokens.revoked, false)),
    );
}

export async function rotateRefreshToken(oldToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  const payload = await verifyRefreshToken(oldToken);

  if (!payload) {
    return null;
  }

  // Revocar el token antiguo
  await revokeRefreshToken(oldToken);

  // Generar nuevos tokens
  const newAccessToken = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken(payload);

  // Almacenar el nuevo refresh token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90); // 90 días
  await storeRefreshToken(payload.userId, newRefreshToken, expiresAt);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

export async function cleanupExpiredTokens(): Promise<void> {
  const now = new Date();
  await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, now));
}

// Limpiar tokens expirados cada 24 horas
setInterval(
  () => {
    cleanupExpiredTokens().catch(console.error);
  },
  24 * 60 * 60 * 1000,
);
