// Comprehensive Security Middleware for ComeYa - Production Ready
import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { body, validationResult, param, query } from "express-validator";
import { db } from "./db";
import { users } from "@shared/schema-mysql";
import { eq } from "drizzle-orm";

// Rate limiting configurations
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: {
    error: "Too many authentication attempts, please try again later.",
    retryAfter: "15 minutes",
  },
  skipSuccessfulRequests: true,
});

export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 payment requests per minute
  message: {
    error: "Too many payment requests, please try again later.",
    retryAfter: "1 minute",
  },
});

export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Allow more webhook requests
  message: {
    error: "Webhook rate limit exceeded",
    retryAfter: "1 minute",
  },
});

// Security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.stripe.com"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// Input validation schemas
export const validateOrderCreation = [
  body("businessId").isString().trim().isLength({ min: 1, max: 50 }).escape(),
  body("items").isArray({ min: 1, max: 20 }),
  body("items.*.name")
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .escape(),
  body("items.*.price")
    .isNumeric()
    .custom((value) => {
      if (value < 0 || value > 100000) {
        // Max $1000 per item
        throw new Error("Price must be between 0 and 100000 cents");
      }
      return true;
    }),
  body("items.*.quantity").isInt({ min: 1, max: 10 }),
  body("deliveryAddress")
    .isString()
    .trim()
    .isLength({ min: 10, max: 200 })
    .escape(),
  body("customerPhone").isMobilePhone("any").optional(),
  body("notes").isString().trim().isLength({ max: 500 }).escape().optional(),
];

export const validateBusinessRegistration = [
  body("name").isString().trim().isLength({ min: 2, max: 100 }).escape(),
  body("email").isEmail().normalizeEmail(),
  body("phone").isMobilePhone("any"),
  body("address").isString().trim().isLength({ min: 10, max: 200 }).escape(),
  body("businessType").isIn(["restaurant", "grocery", "pharmacy", "retail"]),
  body("description")
    .isString()
    .trim()
    .isLength({ max: 500 })
    .escape()
    .optional(),
];

export const validateUserRegistration = [
  body("name").isString().trim().isLength({ min: 2, max: 50 }).escape(),
  body("email").isEmail().normalizeEmail(),
  body("phone").isMobilePhone("any"),
  body("role").isIn(["customer", "business", "driver"]),
  body("password")
    .isLength({ min: 8, max: 128 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
];

export const validatePaymentIntent = [
  body("orderId").isString().trim().isLength({ min: 1, max: 50 }).escape(),
  body("amount").isInt({ min: 100, max: 10000000 }), // $1 to $100,000
  body("currency").isIn(["usd"]),
  body("paymentMethodId")
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .escape()
    .optional(),
];

export const validateIdParam = [
  param("id").isString().trim().isLength({ min: 1, max: 50 }).escape(),
];

export const validatePaginationQuery = [
  query("page").isInt({ min: 1, max: 1000 }).optional(),
  query("limit").isInt({ min: 1, max: 100 }).optional(),
];

// Validation error handler
export function handleValidationErrors(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const sanitizedErrors = errors.array().map((error) => ({
      field: error.type === "field" ? error.path : "unknown",
      message: error.msg,
    }));

    return res.status(400).json({
      error: "Validation failed",
      details: sanitizedErrors,
    });
  }
  next();
}

// Role-based access control
export function requireRole(allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.headers["x-user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Validate user ID format
      if (!/^[a-zA-Z0-9_-]+$/.test(userId) || userId.length > 50) {
        return res.status(401).json({ error: "Invalid user ID format" });
      }

      const [user] = await db
        .select({ role: users.role, status: users.status })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      if (user.status !== "active") {
        return res.status(403).json({ error: "Account is not active" });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: allowedRoles,
          current: user.role,
        });
      }

      // Add user info to request for downstream use
      req.user = { id: userId, role: user.role };
      next();
    } catch (error) {
      console.error("Role validation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

// Request sanitization
export function sanitizeRequest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Remove potentially dangerous characters from string fields
  function sanitizeObject(obj: any): any {
    if (typeof obj === "string") {
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/javascript:/gi, "")
        .replace(/on\w+\s*=/gi, "");
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    if (obj && typeof obj === "object") {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip potentially dangerous keys
        if (!/^[a-zA-Z0-9_-]+$/.test(key)) continue;
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
}

// Request logging for audit
export function auditLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const originalSend = res.send;

  res.send = function (data) {
    const duration = Date.now() - startTime;
    const userId = req.user?.id || "anonymous";

    // Log sensitive operations
    const sensitiveEndpoints = ["/api/payments", "/api/webhooks", "/api/auth"];
    const isSensitive = sensitiveEndpoints.some((endpoint) =>
      req.path.startsWith(endpoint),
    );

    if (isSensitive || res.statusCode >= 400) {
      console.log(`[AUDIT] ${req.method} ${req.path}`, {
        userId,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
    }

    return originalSend.call(this, data);
  };

  next();
}

// Error handling middleware
export function errorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.error("Unhandled error:", {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    timestamp: new Date().toISOString(),
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === "development";

  res.status(error.status || 500).json({
    error: "Internal server error",
    ...(isDevelopment && { details: error.message, stack: error.stack }),
  });
}

// Extend Request interface
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
      };
    }
  }
}
