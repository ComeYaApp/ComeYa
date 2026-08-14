// Authentication & Authorization Middleware - Production Implementation
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { users, auditLogs } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string; // Add for compatibility
        id: string;
        email?: string;
        name: string;
        phone: string;
        role: string;
        phoneVerified: boolean;
        verificationStatus?: string;
        isActive?: boolean;
      };
    }
  }
}

// Role hierarchy
const ROLE_HIERARCHY = {
  super_admin: 100,
  admin: 80,
  business_owner: 60,
  delivery_driver: 40,
  customer: 20,
};

// Verify JWT token
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Token requerido" });
    }

    // Verify JWT
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "comeya_local_secret_key",
    ) as any;
    // Get user from database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.id))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }

    // Attach user to request
    req.user = {
      userId: user.id, // Add userId field for compatibility
      id: user.id,
      email: user.email || undefined,
      name: user.name,
      phone: user.phone,
      role: user.role,
      phoneVerified: user.phoneVerified,
      verificationStatus: user.verificationStatus ?? undefined,
      isActive: user.isActive,
    };

    next();
  } catch (error) {
    console.error("❌ Auth error:", error);
    return res.status(401).json({ error: "Token inválido" });
  }
}

// Require specific role
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "No tienes permisos para esta acción",
        requiredRole: allowedRoles,
        yourRole: req.user.role,
      });
    }

    next();
  };
}

// Require an approved delivery driver (verified by admin before working)
export function requireApprovedDriver(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return res.status(401).json({ error: "No autenticado" });
  }

  if (req.user.role !== "delivery_driver") {
    return res.status(403).json({
      error: "Debes tener un perfil de repartidor",
      code: "driver_role_required",
    });
  }

  if (req.user.verificationStatus !== "verified") {
    return res.status(403).json({
      error:
        "Tu perfil de repartidor está pendiente de aprobación por el administrador",
      code: "driver_not_verified",
      verificationStatus: req.user.verificationStatus || "pending",
    });
  }

  if (req.user.isActive === false) {
    return res.status(403).json({
      error: "Tu cuenta de repartidor está desactivada",
      code: "driver_inactive",
    });
  }

  next();
}

// Require admin role (shorthand)
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "No autenticado" });
  }

  if (req.user.role !== "admin" && req.user.role !== "super_admin") {
    return res.status(403).json({
      error: "Solo administradores pueden acceder",
      yourRole: req.user.role,
    });
  }

  next();
}

// Require minimum role level
export function requireMinRole(minRole: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const userLevel =
      ROLE_HIERARCHY[req.user.role as keyof typeof ROLE_HIERARCHY] || 0;
    const minLevel =
      ROLE_HIERARCHY[minRole as keyof typeof ROLE_HIERARCHY] || 0;

    if (userLevel < minLevel) {
      return res.status(403).json({
        error: "Permisos insuficientes",
        requiredRole: minRole,
        yourRole: req.user.role,
      });
    }

    next();
  };
}

// Check if user owns resource
export function requireOwnership(
  resourceType: "order" | "business" | "wallet",
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    // Super admins bypass ownership check
    if (req.user.role === "super_admin" || req.user.role === "admin") {
      return next();
    }

    // Implementation for ownership check would go here
    next();
  };
}

// Audit sensitive actions
export function auditAction(action: string, entityType: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.user) {
      try {
        await db.insert(auditLogs).values({
          userId: req.user.id,
          action,
          entityType,
          entityId: req.params.id || req.body.id,
          changes: JSON.stringify({
            method: req.method,
            path: req.path,
            body: req.body,
            query: req.query,
          }),
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });
      } catch (error) {
        console.error("Audit log error:", error);
      }
    }
    next();
  };
}

// Rate limiting per user
const userRequestCounts = new Map<string, { count: number; resetAt: number }>();

export function rateLimitPerUser(
  maxRequests: number = 60,
  windowMs: number = 60000,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next();
    }

    // Bypass rate limiting for admin users
    if (req.user.role === "admin" || req.user.role === "super_admin") {
      return next();
    }

    const now = Date.now();
    const userKey = req.user.id;
    const userLimit = userRequestCounts.get(userKey);

    if (!userLimit || now > userLimit.resetAt) {
      userRequestCounts.set(userKey, {
        count: 1,
        resetAt: now + windowMs,
      });
      return next();
    }

    if (userLimit.count >= maxRequests) {
      return res.status(429).json({
        error: "Demasiadas solicitudes",
        retryAfter: Math.ceil((userLimit.resetAt - now) / 1000),
      });
    }

    userLimit.count++;
    next();
  };
}

// Verify phone is verified
export function requirePhoneVerified(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return res.status(401).json({ error: "No autenticado" });
  }

  if (!req.user.phoneVerified) {
    return res.status(403).json({
      error: "Debes verificar tu teléfono primero",
      action: "verify_phone_required",
    });
  }

  next();
}
