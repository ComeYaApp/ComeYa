import jwt from "jsonwebtoken";
import { db } from "./db";
import { refreshTokens } from "../shared/schema-mysql";
import { eq, and, lt } from "drizzle-orm";

const JWT_SECRET =
  process.env.JWT_SECRET || "comeya_local_secret_key";
const REFRESH_SECRET =
  process.env.REFRESH_SECRET || "comeya-refresh-secret-change-in-production";
const ACCESS_TOKEN_EXPIRY = "30d"; // 30 días
const REFRESH_TOKEN_EXPIRY = "90d"; // 90 días

interface TokenPayload {
  id: string;
  userId: string;
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
  userId: string,
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

  // Datos frescos del usuario: el rol puede haber cambiado desde que se
  // emitió el token (p. ej. aprobación como repartidor/negocio por el admin)
  const { users } = await import("../shared/schema-mysql");
  const userId = String(payload.userId || payload.id);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    await revokeRefreshToken(oldToken);
    return null;
  }

  // Revocar el token antiguo
  await revokeRefreshToken(oldToken);

  // Generar nuevos tokens
  const tokenPayload: TokenPayload = {
    id: user.id,
    userId: user.id,
    phone: user.phone,
    role: user.role,
  };
  const newAccessToken = generateAccessToken(tokenPayload);
  const newRefreshToken = generateRefreshToken(tokenPayload);

  // Almacenar el nuevo refresh token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90); // 90 días
  await storeRefreshToken(user.id, newRefreshToken, expiresAt);

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
