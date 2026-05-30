import { Business, Product, Order, CarnivalEvent, Address } from "@/types";

export const mockBusinesses: Business[] = [
  {
    id: "1",
    name: "Tacos El Güero",
    description:
      "Los mejores tacos de San Cristóbal con ingredientes frescos y recetas tradicionales.",
    type: "restaurant",
    profileImage:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=200&fit=crop",
    bannerImage:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=400&fit=crop",
    rating: 4.8,
    reviewCount: 245,
    deliveryTime: "20-30 min",
    deliveryFee: 25,
    minimumOrder: 80,
    isOpen: true,
    openingHours: [
      { day: "Lunes", open: "10:00", close: "22:00" },
      { day: "Martes", open: "10:00", close: "22:00" },
      { day: "Miércoles", open: "10:00", close: "22:00" },
      { day: "Jueves", open: "10:00", close: "22:00" },
      { day: "Viernes", open: "10:00", close: "23:00" },
      { day: "Sábado", open: "10:00", close: "23:00" },
      { day: "Domingo", open: "11:00", close: "21:00" },
    ],
    address: "Calle Hidalgo 123, Centro, San Cristóbal",
    phone: "+58 317 123 4567",
    categories: ["Tacos", "Mexicana", "Antojitos"],
    acceptsCash: true,
    featured: true,
    latitude: 7.7708,
    longitude: -72.2236,
  },
  {
    id: "2",
    name: "La Casita del Chef",
    description:
      "Comida casera con el sazón de la abuela. Especialidad en platillos regionales.",
    type: "restaurant",
    profileImage:
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&h=200&fit=crop",
    bannerImage:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=400&fit=crop",
    rating: 4.6,
    reviewCount: 189,
    deliveryTime: "25-40 min",
    deliveryFee: 30,
    minimumOrder: 100,
    isOpen: true,
    openingHours: [
      { day: "Lunes", open: "08:00", close: "20:00" },
      { day: "Martes", open: "08:00", close: "20:00" },
      { day: "Miércoles", open: "08:00", close: "20:00" },
      { day: "Jueves", open: "08:00", close: "20:00" },
      { day: "Viernes", open: "08:00", close: "21:00" },
      { day: "Sábado", open: "09:00", close: "21:00" },
      { day: "Domingo", open: "09:00", close: "18:00" },
    ],
    address: "Av. Juárez 456, Col. Centro, San Cristóbal",
    phone: "+58 317 234 5678",
    categories: ["Comida Casera", "Mexicana", "Desayunos"],
    acceptsCash: true,
    featured: true,
    latitude: 7.772,
    longitude: -72.225,
  },
  {
    id: "3",
    name: "Sushi Kai",
    description:
      "El mejor sushi de la región con pescado fresco y preparaciones innovadoras.",
    type: "restaurant",
    profileImage:
      "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200&h=200&fit=crop",
    bannerImage:
      "https://images.unsplash.com/photo-1553621042-f6e147245754?w=800&h=400&fit=crop",
    rating: 4.9,
    reviewCount: 312,
    deliveryTime: "30-45 min",
    deliveryFee: 35,
    minimumOrder: 150,
    isOpen: true,
    openingHours: [
      { day: "Lunes", open: "Cerrado", close: "" },
      { day: "Martes", open: "13:00", close: "22:00" },
      { day: "Miércoles", open: "13:00", close: "22:00" },
      { day: "Jueves", open: "13:00", close: "22:00" },
      { day: "Viernes", open: "13:00", close: "23:00" },
      { day: "Sábado", open: "13:00", close: "23:00" },
      { day: "Domingo", open: "13:00", close: "21:00" },
    ],
    address: "Blvd. Las Torres 789, San Cristóbal",
    phone: "+58 317 345 6789",
    categories: ["Sushi", "Japonesa", "Mariscos"],
    acceptsCash: false,
    featured: false,
    latitude: 7.7695,
    longitude: -72.225,
  },
  {
    id: "4",
    name: "Mercado Don Pancho",
    description:
      "Frutas, verduras y carnes frescas directo del campo a tu mesa. Productos locales de la mejor calidad.",
    type: "market",
    profileImage:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&h=200&fit=crop",
    bannerImage:
      "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&h=400&fit=crop",
    rating: 4.7,
    reviewCount: 456,
    deliveryTime: "40-60 min",
    deliveryFee: 40,
    minimumOrder: 200,
    isOpen: true,
    openingHours: [
      { day: "Lunes", open: "06:00", close: "18:00" },
      { day: "Martes", open: "06:00", close: "18:00" },
      { day: "Miércoles", open: "06:00", close: "18:00" },
      { day: "Jueves", open: "06:00", close: "18:00" },
      { day: "Viernes", open: "06:00", close: "18:00" },
      { day: "Sábado", open: "06:00", close: "16:00" },
      { day: "Domingo", open: "07:00", close: "14:00" },
    ],
    address: "Mercado Municipal, Centro, San Cristóbal",
    phone: "+58 317 456 7890",
    categories: ["Frutas", "Verduras", "Carnes", "Abarrotes"],
    acceptsCash: true,
    featured: true,
    latitude: 7.7715,
    longitude: -72.224,
  },
  {
    id: "5",
    name: "Carnicería La Preferida",
    description:
      "Carnes selectas y cortes especiales. Más de 30 años de experiencia.",
    type: "market",
    profileImage:
      "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=200&h=200&fit=crop",
    bannerImage:
      "https://images.unsplash.com/photo-1558030006-450675393462?w=800&h=400&fit=crop",
    rating: 4.8,
    reviewCount: 278,
    deliveryTime: "35-50 min",
    deliveryFee: 35,
    minimumOrder: 250,
    isOpen: true,
    openingHours: [
      { day: "Lunes", open: "07:00", close: "19:00" },
      { day: "Martes", open: "07:00", close: "19:00" },
      { day: "Miércoles", open: "07:00", close: "19:00" },
      { day: "Jueves", open: "07:00", close: "19:00" },
      { day: "Viernes", open: "07:00", close: "19:00" },
      { day: "Sábado", open: "07:00", close: "17:00" },
      { day: "Domingo", open: "Cerrado", close: "" },
    ],
    address: "Calle Morelos 234, Centro, San Cristóbal",
    phone: "+58 317 567 8901",
    categories: ["Carnes", "Embutidos", "Pollo"],
    acceptsCash: true,
    featured: false,
    latitude: 7.77,
    longitude: -72.2245,
  },
  {
    id: "6",
    name: "Pizza Roma",
    description:
      "Auténtica pizza italiana al horno de leña. Ingredientes importados.",
    type: "restaurant",
    profileImage:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200&h=200&fit=crop",
    bannerImage:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&h=400&fit=crop",
    rating: 4.5,
    reviewCount: 198,
    deliveryTime: "30-45 min",
    deliveryFee: 30,
    minimumOrder: 120,
    isOpen: false,
    openingHours: [
      { day: "Lunes", open: "12:00", close: "22:00" },
      { day: "Martes", open: "12:00", close: "22:00" },
      { day: "Miércoles", open: "12:00", close: "22:00" },
      { day: "Jueves", open: "12:00", close: "22:00" },
      { day: "Viernes", open: "12:00", close: "23:00" },
      { day: "Sábado", open: "12:00", close: "23:00" },
      { day: "Domingo", open: "12:00", close: "21:00" },
    ],
    address: "Plaza Principal 12, Centro, San Cristóbal",
    phone: "+58 317 678 9012",
    categories: ["Pizza", "Italiana", "Pastas"],
    acceptsCash: true,
    featured: false,
    latitude: 7.771,
    longitude: -72.2238,
  },
];

export const mockProducts: Record<string, Product[]> = {
  "1": [
    {
      id: "p1",
      businessId: "1",
      name: "Tacos al Pastor",
      description: "3 tacos de pastor con piña, cilantro y cebolla",
      price: 45,
      image:
        "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=400&h=300&fit=crop",
      category: "Tacos",
      available: true,
      isWeightBased: false,
      requiresNote: false,
    },
    {
      id: "p2",
      businessId: "1",
      name: "Tacos de Bistec",
      description: "3 tacos de bistec con guacamole",
      price: 55,
      image:
        "https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?w=400&h=300&fit=crop",
      category: "Tacos",
      available: true,
      isWeightBased: false,
      requiresNote: false,
    },
    {
      id: "p3",
      businessId: "1",
      name: "Quesadilla de Queso",
      description: "Quesadilla con queso oaxaca derretido",
      price: 35,
      image:
        "https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=400&h=300&fit=crop",
      category: "Quesadillas",
      available: true,
      isWeightBased: false,
      requiresNote: false,
    },
    {
      id: "p4",
      businessId: "1",
      name: "Orden de Guacamole",
      description: "Guacamole fresco con totopos",
      price: 65,
      image:
        "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400&h=300&fit=crop",
      category: "Extras",
      available: true,
      isWeightBased: false,
      requiresNote: false,
    },
  ],
  "2": [
    {
      id: "p5",
      businessId: "2",
      name: "Enchiladas Verdes",
      description: "3 enchiladas de pollo con salsa verde y crema",
      price: 85,
      image:
        "https://images.unsplash.com/photo-1534352956036-cd81e27dd615?w=400&h=300&fit=crop",
      category: "Platillos",
      available: true,
      isWeightBased: false,
      requiresNote: false,
    },
    {
      id: "p6",
      businessId: "2",
      name: "Pozole Rojo",
      description: "Pozole tradicional con carne de cerdo",
      price: 95,
      image:
        "https://images.unsplash.com/photo-1564671165093-20688ff1fffa?w=400&h=300&fit=crop",
      category: "Sopas",
      available: true,
      isWeightBased: false,
      requiresNote: false,
    },
  ],
  "3": [
    {
      id: "p7",
      businessId: "3",
      name: "Roll Filadelfia",
      description: "8 piezas de salmón, queso crema y aguacate",
      price: 145,
      image:
        "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=400&h=300&fit=crop",
      category: "Rolls",
      available: true,
      isWeightBased: false,
      requiresNote: false,
    },
    {
      id: "p8",
      businessId: "3",
      name: "Nigiri Mixto",
      description: "6 piezas variadas de nigiri",
      price: 180,
      image:
        "https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=400&h=300&fit=crop",
      category: "Nigiris",
      available: true,
      isWeightBased: false,
      requiresNote: false,
    },
  ],
  "4": [
    {
      id: "p9",
      businessId: "4",
      name: "Jitomate Bola",
      description: "Jitomate fresco de la región",
      price: 35,
      image:
        "https://images.unsplash.com/photo-1546470427-0d4db154cde8?w=400&h=300&fit=crop",
      category: "Verduras",
      available: true,
      isWeightBased: true,
      unit: "kg",
      requiresNote: true,
    },
    {
      id: "p10",
      businessId: "4",
      name: "Aguacate Hass",
      description: "Aguacate premium de Michoacán",
      price: 65,
      image:
        "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=400&h=300&fit=crop",
      category: "Frutas",
      available: true,
      isWeightBased: true,
      unit: "kg",
      requiresNote: true,
    },
    {
      id: "p11",
      businessId: "4",
      name: "Cebolla Blanca",
      description: "Cebolla fresca",
      price: 25,
      image:
        "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=400&h=300&fit=crop",
      category: "Verduras",
      available: true,
      isWeightBased: true,
      unit: "kg",
      requiresNote: true,
    },
    {
      id: "p12",
      businessId: "4",
      name: "Limón",
      description: "Limón verde jugoso",
      price: 30,
      image:
        "https://images.unsplash.com/photo-1590502593747-42a996133562?w=400&h=300&fit=crop",
      category: "Frutas",
      available: true,
      isWeightBased: true,
      unit: "kg",
      requiresNote: false,
    },
  ],
  "5": [
    {
      id: "p13",
      businessId: "5",
      name: "Bistec de Res",
      description: "Corte de primera calidad",
      price: 180,
      image:
        "https://images.unsplash.com/photo-1588347818036-558601350947?w=400&h=300&fit=crop",
      category: "Res",
      available: true,
      isWeightBased: true,
      unit: "kg",
      requiresNote: true,
    },
    {
      id: "p14",
      businessId: "5",
      name: "Pechuga de Pollo",
      description: "Pechuga fresca sin hueso",
      price: 95,
      image:
        "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=300&fit=crop",
      category: "Pollo",
      available: true,
      isWeightBased: true,
      unit: "kg",
      requiresNote: true,
    },
    {
      id: "p15",
      businessId: "5",
      name: "Costilla de Cerdo",
      description: "Costilla para asar o guisar",
      price: 120,
      image:
        "https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=400&h=300&fit=crop",
      category: "Cerdo",
      available: true,
      isWeightBased: true,
      unit: "kg",
      requiresNote: true,
    },
  ],
  "6": [
    {
      id: "p16",
      businessId: "6",
      name: "Pizza Margarita",
      description: "Salsa de tomate, mozzarella y albahaca fresca",
      price: 145,
      image:
        "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop",
      category: "Pizzas",
      available: true,
      isWeightBased: false,
      requiresNote: false,
    },
    {
      id: "p17",
      businessId: "6",
      name: "Pizza Pepperoni",
      description: "Pepperoni y queso mozzarella",
      price: 165,
      image:
        "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&h=300&fit=crop",
      category: "Pizzas",
      available: true,
      isWeightBased: false,
      requiresNote: false,
    },
  ],
};

export const mockOrders: Order[] = [
  {
    id: "o1",
    userId: "1",
    businessId: "1",
    businessName: "Tacos El Güero",
    businessImage:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=200&fit=crop",
    items: [
      {
        id: "ci1",
        product: mockProducts["1"][0],
        quantity: 2,
      },
      {
        id: "ci2",
        product: mockProducts["1"][1],
        quantity: 1,
      },
    ],
    status: "delivered",
    subtotal: 145,
    deliveryFee: 25,
    total: 170,
    paymentMethod: "card",
    deliveryAddress: "Calle Reforma 456, Col. Centro, San Cristóbal",
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: "o2",
    userId: "1",
    businessId: "4",
    businessName: "Mercado Don Pancho",
    businessImage:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&h=200&fit=crop",
    items: [
      {
        id: "ci3",
        product: mockProducts["4"][0],
        quantity: 1,
        unitAmount: 2,
        note: "Que estén maduros pero firmes",
      },
      {
        id: "ci4",
        product: mockProducts["4"][1],
        quantity: 1,
        unitAmount: 1,
        note: "Tamaño mediano",
      },
    ],
    status: "on_the_way",
    subtotal: 135,
    deliveryFee: 40,
    total: 175,
    paymentMethod: "cash",
    deliveryAddress: "Calle Reforma 456, Col. Centro, San Cristóbal",
    deliveryPersonId: "d1",
    deliveryPersonName: "Carlos Martínez",
    deliveryPersonPhone: "+58 317 111 2222",
    deliveryPersonLocation: {
      latitude: 7.7702,
      longitude: -72.2274,
    },
    customerLocation: {
      latitude: 7.7712,
      longitude: -72.2254,
    },
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    estimatedDelivery: new Date(Date.now() + 1800000).toISOString(),
  },
];

export const mockCarnivalEvents: CarnivalEvent[] = [
  {
    id: "e1",
    title: "Coronación de la Reina",
    description:
      "Gran ceremonia de coronación de la reina del Carnaval San Cristóbal 2026 con espectáculo de fuegos artificiales.",
    image:
      "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&h=400&fit=crop",
    date: "2026-02-14",
    time: "20:00",
    location: "Plaza Principal",
  },
  {
    id: "e2",
    title: "Desfile de Carros Alegóricos",
    description:
      "Colorido desfile con más de 20 carros alegóricos, comparsas y bandas de música.",
    image:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=400&fit=crop",
    date: "2026-02-15",
    time: "17:00",
    location: "Avenida Juárez",
  },
  {
    id: "e3",
    title: "Baile de Máscaras",
    description:
      "Tradicional baile de máscaras con música en vivo y concurso de disfraces.",
    image:
      "https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800&h=400&fit=crop",
    date: "2026-02-16",
    time: "21:00",
    location: "Centro de Convenciones",
  },
  {
    id: "e4",
    title: "Concierto Principal",
    description: "Gran concierto con artistas nacionales e internacionales.",
    image:
      "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=400&fit=crop",
    date: "2026-02-17",
    time: "19:00",
    location: "Estadio Municipal",
  },
];

export const mockAddresses: Address[] = [
  {
    id: "a1",
    label: "Casa",
    street: "Calle Mayor 12",
    city: "Soria",
    state: "Castilla y León",
    zipCode: "42001",
    isDefault: true,
    latitude: 41.7636,
    longitude: -2.4677,
  },
  {
    id: "a2",
    label: "Trabajo",
    street: "Calle Collado 5",
    city: "Soria",
    state: "Castilla y León",
    zipCode: "42002",
    isDefault: false,
    latitude: 41.765,
    longitude: -2.469,
  },
];

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function getSuggestedBusinesses(businesses: Business[]): Business[] {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 11) {
    return businesses.filter(
      (b) =>
        b.categories.some((c) => c.toLowerCase().includes("desayuno")) ||
        b.type === "market",
    );
  }

  if (hour >= 11 && hour < 15) {
    return businesses.filter((b) => b.type === "restaurant" && b.isOpen);
  }

  if (hour >= 15 && hour < 19) {
    return businesses.filter((b) => b.isOpen).slice(0, 4);
  }

  return businesses.filter(
    (b) =>
      b.type === "restaurant" &&
      b.isOpen &&
      !b.categories.some((c) => c.toLowerCase().includes("desayuno")),
  );
}
