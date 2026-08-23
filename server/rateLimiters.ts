import rateLimit from "express-rate-limit";
import { RateLimitError } from "./errors";
import { logger } from "./logger";

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.security("Rate limit exceeded", {
      ip: req.ip,
      path: req.path,
    });
    throw new RateLimitError();
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: "Too many authentication attempts",
  handler: (req, res) => {
    logger.security("Auth rate limit exceeded", {
      ip: req.ip,
      path: req.path,
    });
    throw new RateLimitError(
      "Too many authentication attempts. Try again later.",
    );
  },
});

export const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: "Too many orders created",
  handler: (req, res) => {
    logger.security("Order rate limit exceeded", {
      ip: req.ip,
      userId: (req as any).user?.id,
    });
    throw new RateLimitError("Too many orders. Please wait a moment.");
  },
});

export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  skipFailedRequests: true,
});

export const geocodingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5, // máximo 5 geocodificaciones por minuto por IP
  message: "Demasiadas solicitudes de geocodificación. Espera un momento.",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.security("Geocoding rate limit exceeded", {
      ip: req.ip,
      userId: (req as any).user?.id,
    });
    throw new RateLimitError(
      "Demasiadas solicitudes de geocodificación. Espera un momento.",
    );
  },
});

export const gpsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 120, // defensa adicional; los límites reales de Google viven en googleMapsService
  message: "Demasiadas solicitudes de mapas. Espera un momento.",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.security("GPS rate limit exceeded", {
      ip: req.ip,
      userId: (req as any).user?.id,
      path: req.path,
    });
    throw new RateLimitError(
      "Demasiadas solicitudes de mapas. Espera un momento.",
    );
  },
});
