export type UserRole =
  | "customer"
  | "business_owner"
  | "delivery_driver"
  | "admin"
  | "super_admin";

export interface User {
  id: string;
  email?: string;
  name: string;
  phone: string;
  avatar?: string;
  profileImage?: string;
  dni?: string;
  address?: string;
  role: UserRole;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  biometricEnabled?: boolean;
  stripeCustomerId?: string;
  createdAt: string;
  isActive?: boolean;
  verificationStatus?: string;
  token?: string; // JWT token for authentication
  preferences?: {
    theme: "light" | "dark" | "system";
    accentColor: string;
  };
}

export interface Business {
  id: string;
  name: string;
  description: string;
  type: "restaurant" | "market";
  profileImage: string;
  bannerImage: string;
  rating: number;
  reviewCount: number;
  deliveryTime: string;
  deliveryFee: number;
  minimumOrder: number;
  isOpen: boolean;
  openingHours: {
    day: string;
    open: string;
    close: string;
  }[];
  address: string;
  phone: string;
  categories: string[];
  featured: boolean;
  distance?: number;
  latitude?: number;
  longitude?: number;
  reservationsEnabled?: boolean;
  deliveryEnabled?: boolean;
}

export interface Product {
  id: string;
  businessId: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  available: boolean;
  isWeightBased: boolean;
  unit?: string;
  requiresNote: boolean;
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  note?: string;
  unitAmount?: number;
}

export interface Cart {
  businessId: string;
  businessName: string;
  items: CartItem[];
}

export type OrderStatus =
  | "pending"
  | "accepted"
  | "confirmed"
  | "preparing"
  | "ready"
  | "assigned_driver"
  | "picked_up"
  | "on_the_way"
  | "in_transit"
  | "arriving"
  | "delivered"
  | "completed"
  | "payment_failed"
  | "cancelled"
  | "refunded";

export interface Order {
  id: string;
  /** Número secuencial público con formato #CY000001 */
  orderNumber?: number;
  userId: string;
  businessId: string;
  businessName: string;
  businessImage: string;
  items: CartItem[];
  status: OrderStatus;
  subtotal: number;
  productosBase?: number;
  nemyCommission?: number;
  deliveryFee: number;
  total: number;
  paymentMethod: "card";
  orderType?: "delivery" | "pickup";
  deliveryAddress: string;
  deliveryPersonId?: string;
  deliveryPersonName?: string;
  deliveryPersonPhone?: string;
  deliveryPersonLocation?: {
    latitude: number;
    longitude: number;
  };
  customerLocation?: {
    latitude: number;
    longitude: number;
  };
  createdAt: string;
  estimatedDelivery?: string;
  notes?: string;
  confirmedByCustomer?: boolean;
  confirmedByCustomerAt?: string;
  /** Pedido pagado (esperando aceptación del negocio) */
  paidAt?: string | null;
  fundsReleased?: boolean;
  /** Si el cliente ya dejó reseña (oculta el botón de valorar) */
  hasReview?: boolean;
  /** Preferencia de indisponibilidad: "refund" | "call" | "substitute" */
  substitutionPreference?: string;
  /** Preferencias por producto {productId: "refund"|"call"|"substitute"} */
  itemSubstitutionPreferences?: Record<string, string> | string | null;
  /** Fecha programada de entrega (pedidos programados) */
  scheduledFor?: string | null;
}

export interface CarnivalEvent {
  id: string;
  title: string;
  description: string;
  image: string;
  date: string;
  time: string;
  location: string;
}

export interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  isDefault: boolean;
  latitude?: number;
  longitude?: number;
}
