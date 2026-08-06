/**
 * Map Data Routes — Datos geoespaciales para los mapas de la app
 * Incluye negocios cercanos con estado abierto/cerrado
 */
import express from "express";
import { db } from "../db";
import { businesses } from "@shared/schema-mysql";
import { eq, and, sql } from "drizzle-orm";
import { authenticateToken } from "../authMiddleware";
import { googleMapsService } from "../services/googleMapsService";
import { isBusinessOpen } from "../../shared/businessHours";

const router = express.Router();

// GET /api/map/nearby-businesses — negocios cercanos con estado abierto/cerrado
router.get("/nearby-businesses", authenticateToken, async (req, res) => {
  try {
    const { lat, lng, radiusKm = "5" } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: "lat and lng required" });
    }

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);
    const radius = parseFloat(radiusKm as string);

    // Obtener todos los negocios activos con coordenadas
    const allBusinesses = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        image: businesses.image,
        address: businesses.address,
        latitude: businesses.latitude,
        longitude: businesses.longitude,
        categories: businesses.categories,
        isActive: businesses.isActive,
        openingHours: businesses.openingHours,
        ownerId: businesses.ownerId,
      })
      .from(businesses)
      .where(
        and(
          eq(businesses.isActive, true),
          sql`${businesses.latitude} IS NOT NULL`,
          sql`${businesses.longitude} IS NOT NULL`,
        ),
      );

    // Filtrar por distancia y calcular estado abierto/cerrado
    const nearby = allBusinesses
      .map((biz) => {
        const bizLat = parseFloat(biz.latitude as string);
        const bizLng = parseFloat(biz.longitude as string);
        
        if (isNaN(bizLat) || isNaN(bizLng)) return null;

        const distanceKm = googleMapsService.calculateHaversineDistance(
          latitude,
          longitude,
          bizLat,
          bizLng,
        );

        if (distanceKm > radius) return null;

        // Determinar si está abierto ahora
        let isOpen = false;
        try {
          isOpen = isBusinessOpen(biz.openingHours, biz.isActive);
        } catch {
          isOpen = true; // Si no hay datos de horario, asumir abierto
        }

        return {
          id: biz.id,
          name: biz.name,
          image: biz.image,
          address: biz.address,
          latitude: bizLat,
          longitude: bizLng,
          categories: biz.categories,
          distanceKm: Math.round(distanceKm * 10) / 10,
          isOpen,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.distanceKm - b!.distanceKm);

    res.json({ success: true, businesses: nearby });
  } catch (error: any) {
    console.error("Error fetching nearby businesses:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/map/route — ruta entre dos puntos usando el servicio cacheado
router.get("/route", authenticateToken, async (req, res) => {
  try {
    const { originLat, originLng, destLat, destLng } = req.query;

    if (!originLat || !originLng || !destLat || !destLng) {
      return res.status(400).json({ error: "Missing coordinates" });
    }

    const result = await googleMapsService.getDirections(
      parseFloat(originLat as string),
      parseFloat(originLng as string),
      parseFloat(destLat as string),
      parseFloat(destLng as string),
    );

    if (!result) {
      const distanceKm = googleMapsService.calculateHaversineDistance(
        parseFloat(originLat as string),
        parseFloat(originLng as string),
        parseFloat(destLat as string),
        parseFloat(destLng as string),
      );
      
      return res.json({
        success: true,
        fallback: true,
        polyline: "",
        distance: { text: `${distanceKm.toFixed(1)} km`, value: Math.round(distanceKm * 1000) },
        duration: { text: `${googleMapsService.estimateDeliveryTimeMinutes(distanceKm)} min`, value: 0 },
        decodedPath: [
          { latitude: parseFloat(originLat as string), longitude: parseFloat(originLng as string) },
          { latitude: parseFloat(destLat as string), longitude: parseFloat(destLng as string) },
        ],
      });
    }

    const decodedPath = googleMapsService.decodePolyline(result.polyline);

    res.json({
      success: true,
      polyline: result.polyline,
      distance: result.distance,
      duration: result.duration,
      decodedPath,
      startLocation: result.startLocation,
      endLocation: result.endLocation,
    });
  } catch (error: any) {
    console.error("Error fetching route:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;