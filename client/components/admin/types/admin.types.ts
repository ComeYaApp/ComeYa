export interface DashboardMetrics {
  ordersToday: number;
  cancelledToday: number;
  cancellationRate: number | string;
  avgDeliveryTime: number;
  driversOnline: number;
  totalDrivers: number;
  pausedBusinesses: number;
  totalBusinesses: number;
  timestamp: string;
}

export interface ActiveOrder {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  customer: { id: string; name: string };
  business: {
    id: string;
    name: string;
    latitude: string | null;
    longitude: string | null;
  };
  deliveryAddress: {
    latitude: string | null;
    longitude: string | null;
    address: string;
  };
  driver: { id: string; name: string; isOnline: boolean } | null;
}

export interface OnlineDriver {
  id: string;
  name: string;
  isOnline: boolean;
  lastActiveAt: string | null;
  location: { latitude: string; longitude: string; updatedAt: string } | null;
  activeOrder: string | null;
}

export interface AdminLog {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userRole: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  completedOrders: number;
  usersByRole: {
    customers: number;
    businesses: number;
    delivery: number;
    admins: number;
  };
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface AdminOrder {
  id: string;
  userId: string;
  businessId: string;
  businessName: string;
  businessImage: string | null;
  customerName: string;
  customerPhone: string;
  status: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  deliveryAddress: string;
  deliveryLatitude: string | null;
  deliveryLongitude: string | null;
  items: string;
  notes: string | null;
  createdAt: string;
  estimatedDelivery: string | null;
  deliveredAt: string | null;
  deliveryPersonId: string | null;
  platformFee: number | null;
  businessEarnings: number | null;
  deliveryEarnings: number | null;
}

export interface Business {
  id: string;
  name: string;
  type: string;
  description: string;
  image: string;
  address: string;
  phone: string;
  isActive: boolean;
  deliveryFee: number;
  minOrderAmount: number;
  customCommission: number | null;
  ownerId?: string;
  verificationStatus?: "pending" | "verified" | "rejected" | null;
}

export interface Product {
  id: string;
  businessId: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  isAvailable: boolean;
  isWeightBased: boolean;
  weightUnit: string | null;
  pricePerUnit: number | null;
}

export interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isOnline: boolean;
  isApproved: boolean;
  strikes: number;
  totalDeliveries: number;
  rating: number | null;
  createdAt: string;
}

export interface Wallet {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  balance: number;
  pendingBalance: number;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  status: string;
  bankName: string | null;
  accountNumber: string | null;
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  minOrderAmount: number | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  lastMessageAt: string | null;
}

export interface DeliveryZone {
  id: string;
  name: string;
  baseFee: number;
  pricePerKm: number;
  minOrderAmount: number;
  isActive: boolean;
}

export interface SystemSetting {
  key: string;
  value: string;
  description: string;
}

export interface TabProps {
  theme: any;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}
