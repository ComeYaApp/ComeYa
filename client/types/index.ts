export type UserRole = "customer" | "business_owner" | "delivery_driver" | "admin" | "super_admin";

export interface User {
  id: string;
  email?: string;
  name: string;
  phone: string;
  avatar?: string;
  profileImage?: string;
  role: UserRole;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  biometricEnabled?: boolean;
  stripeCustomerId?: string;
  createdAt: string;
  isActive?: boolean;
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
  | "cancelled"
  | "refunded";

export interface Order {
  id: string;
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
  fundsReleased?: boolean;
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
