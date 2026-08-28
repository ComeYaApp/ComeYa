// Development utility for ComeYa app
// This helps create test data and handle missing orders gracefully

export const DEV_UTILS = {
  // Create a mock order for testing
  createMockOrder: (orderId: string) => ({
    id: orderId,
    userId: "user_demo",
    businessId: "business_demo",
    businessName: "Restaurante Demo",
    businessImage:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400",
    items: [
      {
        id: "item_1",
        quantity: 2,
        product: {
          id: "prod_1",
          name: "Tacos al Pastor",
          price: 15.0,
          image:
            "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400",
        },
      },
      {
        id: "item_2",
        quantity: 1,
        product: {
          id: "prod_2",
          name: "Refresco",
          price: 25.0,
          image:
            "https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=400",
        },
      },
    ],
    status: "preparing",
    subtotal: 5500, // in cents
    deliveryFee: 2500, // in cents
    total: 8000, // in cents
    paymentMethod: "card",
    deliveryAddress: "Calle Ejemplo 123, San Cristóbal, Táchira",
    deliveryLatitude: "7.7708",
    deliveryLongitude: "-104.3636",
    createdAt: new Date().toISOString(),
    estimatedDelivery: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  }),

  // Mock delivery location
  getMockDeliveryLocation: () => ({
    latitude: "7.7708",
    longitude: "-104.3636",
    updatedAt: new Date().toISOString(),
  }),

  // Check if we're in development mode
  isDevelopment: () => process.env.NODE_ENV === "development",

  // Log development info
  logDev: (message: string, data?: any) => {
    if (DEV_UTILS.isDevelopment()) {
      console.log(`[DEV] ${message}`, data || "");
    }
  },
};

export default DEV_UTILS;
