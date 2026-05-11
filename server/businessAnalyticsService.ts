import { db } from './db';
import { orders, products, reviews, businesses } from '@shared/schema-mysql';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

export class BusinessAnalyticsService {
  // Dashboard principal con métricas en tiempo real
  static async getDashboard(businessId: string, period: 'today' | 'week' | 'month' | 'all' = 'week') {
    const now = new Date();
    let startDate: Date | null = null;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'all':
        startDate = null;
        break;
    }

    // Pedidos del período
    const periodOrders = await db
      .select()
      .from(orders)
      .where(
        startDate
          ? and(eq(orders.businessId, businessId), gte(orders.createdAt, startDate))
          : eq(orders.businessId, businessId)
      );

    // Pedidos del período anterior (para comparación)
    const periodLength = startDate ? now.getTime() - startDate.getTime() : 0;
    const previousStartDate = startDate ? new Date(startDate.getTime() - periodLength) : null;
    const previousOrders = (startDate && previousStartDate) ? await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.businessId, businessId),
          gte(orders.createdAt, previousStartDate),
          lte(orders.createdAt, startDate)
        )
      ) : [];

    // Todos los pedidos del negocio (para métricas globales)
    const allOrders = startDate ? await db.select().from(orders).where(eq(orders.businessId, businessId)) : periodOrders;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayOrders = allOrders.filter(o => o.createdAt && new Date(o.createdAt) >= todayStart);
    const completedOrders = periodOrders.filter(o => o.status === 'delivered');
    const cancelledOrders = periodOrders.filter(o => o.status === 'cancelled');
    // businessEarnings puede ser null si no se calculó al crear la orden.
    // Fallback: subtotal (precio base productos, sin comisión ni delivery)
    const getBusinessRevenue = (o: any) => o.businessEarnings ?? o.subtotal ?? 0;
    const totalRevenue = completedOrders.reduce((sum, o) => sum + getBusinessRevenue(o), 0);
    const previousRevenue = previousOrders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + getBusinessRevenue(o), 0);
    const revenueChange = previousRevenue > 0
      ? ((totalRevenue - previousRevenue) / previousRevenue) * 100
      : 0;
    const avgOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;
    const totalOrders = periodOrders.length;
    const previousTotalOrders = previousOrders.length;
    const ordersChange = previousTotalOrders > 0
      ? ((totalOrders - previousTotalOrders) / previousTotalOrders) * 100
      : 0;

    // Rating promedio
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    const rating = business?.rating ? business.rating / 10 : 0;

    return {
      success: true,
      dashboard: {
        period,
        totalOrders,
        ordersChange: Math.round(ordersChange * 10) / 10,
        totalRevenue: totalRevenue,
        revenueChange: Math.round(revenueChange * 10) / 10,
        avgOrderValue,
        averageTicket: avgOrderValue,
        rating,
        averageRating: (business?.rating || 0),
        totalReviews: business?.totalRatings || 0,
        // Campos que espera el frontend
        todayOrders: todayOrders.length,
        completedOrders: completedOrders.length,
        cancelledOrders: cancelledOrders.length,
        todayRevenue: todayOrders.filter(o => o.status === 'delivered').reduce((s, o) => s + getBusinessRevenue(o), 0),
        weekRevenue: totalRevenue,
        monthRevenue: totalRevenue,
      },
    };
  }

  // Productos más vendidos
  static async getTopProducts(businessId: string, limit = 10) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const recentOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.businessId, businessId),
          eq(orders.status, 'delivered'),
          gte(orders.createdAt, thirtyDaysAgo)
        )
      );

    // Contar productos
    const productCounts: Record<string, { name: string; count: number; revenue: number }> = {};

    for (const order of recentOrders) {
      try {
        const items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
        for (const item of items) {
          const productId = item.productId || item.product?.id || item.id || 'unknown';
          const productName = item.product?.name || item.name || 'Producto';
          const quantity = item.quantity || 1;
          // price está en centavos en la BD
          const price = item.price || item.product?.price || 0;

          if (!productCounts[productId]) {
            productCounts[productId] = { name: productName, count: 0, revenue: 0 };
          }
          productCounts[productId].count += quantity;
          productCounts[productId].revenue += price * quantity;
        }
      } catch { /* item malformado, ignorar */ }
    }

    // Ordenar por cantidad vendida
    const topProducts = Object.entries(productCounts)
      .map(([id, data]) => ({
        productId: id,
        name: data.name,
        unitsSold: data.count,
        revenue: data.revenue / 100,
      }))
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, limit);

    return { success: true, topProducts };
  }

  // Horas pico
  static async getPeakHours(businessId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const recentOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.businessId, businessId),
          gte(orders.createdAt, thirtyDaysAgo)
        )
      );

    // Agrupar por hora
    const hourCounts: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
      hourCounts[i] = 0;
    }

    for (const order of recentOrders) {
      const hour = new Date(order.createdAt).getHours();
      hourCounts[hour]++;
    }

    const peakHours = Object.entries(hourCounts)
      .map(([hour, count]) => ({
        hour: parseInt(hour),
        orderCount: count,
        label: `${hour}:00 - ${parseInt(hour) + 1}:00`,
      }))
      .sort((a, b) => b.orderCount - a.orderCount);

    return { success: true, peakHours };
  }

  // Ventas por día (últimos 30 días)
  static async getSalesChart(businessId: string, days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const recentOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.businessId, businessId),
          eq(orders.status, 'delivered'),
          gte(orders.createdAt, startDate)
        )
      );

    // Agrupar por día
    const dailySales: Record<string, { orders: number; revenue: number }> = {};

    for (const order of recentOrders) {
      const date = new Date(order.createdAt).toISOString().split('T')[0];
      
      if (!dailySales[date]) {
        dailySales[date] = { orders: 0, revenue: 0 };
      }

      dailySales[date].orders++;
      dailySales[date].revenue += order.businessEarnings ?? order.subtotal ?? 0;
    }

    const chartData = Object.entries(dailySales)
      .map(([date, data]) => ({
        date,
        orders: data.orders,
        revenue: data.revenue / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { success: true, chartData };
  }

  // Estadísticas de reviews
  static async getReviewStats(businessId: string) {
    const businessReviews = await db
      .select()
      .from(reviews)
      .where(
        and(
          eq(reviews.businessId, businessId),
          eq(reviews.approved, true)
        )
      );

    const totalReviews = businessReviews.length;
    
    if (totalReviews === 0) {
      return {
        success: true,
        reviewStats: {
          totalReviews: 0,
          avgRating: 0,
          avgFoodRating: 0,
          avgPackagingRating: 0,
          ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        },
      };
    }

    const avgRating = businessReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
    
    const foodRatings = businessReviews.filter(r => r.foodRating);
    const avgFoodRating = foodRatings.length > 0
      ? foodRatings.reduce((sum, r) => sum + (r.foodRating || 0), 0) / foodRatings.length
      : 0;

    const packagingRatings = businessReviews.filter(r => r.packagingRating);
    const avgPackagingRating = packagingRatings.length > 0
      ? packagingRatings.reduce((sum, r) => sum + (r.packagingRating || 0), 0) / packagingRatings.length
      : 0;

    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const review of businessReviews) {
      ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
    }

    return {
      success: true,
      reviewStats: {
        totalReviews,
        avgRating: Math.round(avgRating * 10) / 10,
        avgFoodRating: Math.round(avgFoodRating * 10) / 10,
        avgPackagingRating: Math.round(avgPackagingRating * 10) / 10,
        ratingDistribution,
      },
    };
  }

  // Comparativa semanal
  static async getWeeklyComparison(businessId: string) {
    const now = new Date();
    const thisWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const thisWeekOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.businessId, businessId),
          eq(orders.status, 'delivered'),
          gte(orders.createdAt, thisWeekStart)
        )
      );

    const lastWeekOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.businessId, businessId),
          eq(orders.status, 'delivered'),
          gte(orders.createdAt, lastWeekStart),
          lte(orders.createdAt, thisWeekStart)
        )
      );

    const thisWeekRevenue = thisWeekOrders.reduce((sum, o) => sum + (o.businessEarnings || 0), 0);
    const lastWeekRevenue = lastWeekOrders.reduce((sum, o) => sum + (o.businessEarnings || 0), 0);

    return {
      success: true,
      comparison: {
        thisWeek: {
          orders: thisWeekOrders.length,
          revenue: thisWeekRevenue / 100,
        },
        lastWeek: {
          orders: lastWeekOrders.length,
          revenue: lastWeekRevenue / 100,
        },
        ordersChange: lastWeekOrders.length > 0
          ? ((thisWeekOrders.length - lastWeekOrders.length) / lastWeekOrders.length) * 100
          : 0,
        revenueChange: lastWeekRevenue > 0
          ? ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100
          : 0,
      },
    };
  }
}
