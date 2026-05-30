import {
  users,
  addresses,
  orders,
  businesses,
  wallets,
  transactions,
  type User,
  type InsertUser,
  type Address,
  type InsertAddress,
  type Order,
  type InsertOrder,
  type Business,
  type InsertBusiness,
  type Wallet,
  type InsertWallet,
  type Transaction,
  type InsertTransaction,
} from "@shared/schema-mysql";
import { eq, sql, desc, asc, and, isNull } from "drizzle-orm";
import { db } from "./db";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

  getAddresses(userId: string): Promise<Address[]>;
  createAddress(address: InsertAddress): Promise<Address>;

  getOrders(userId: string): Promise<Order[]>;
  getAllOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, updates: Partial<Order>): Promise<Order | undefined>;

  getProduct(productId: string): Promise<any>;
  listProducts(
    active?: boolean,
    limit?: number,
    offset?: number,
  ): Promise<any[]>;
  listProductsWithPrices(
    active?: boolean,
    limit?: number,
    offset?: number,
  ): Promise<any[]>;
  getPrice(priceId: string): Promise<any>;
  listPrices(active?: boolean, limit?: number, offset?: number): Promise<any[]>;
  getPricesForProduct(productId: string): Promise<any[]>;
  getSubscription(subscriptionId: string): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(
    id: string,
    updates: Partial<User>,
  ): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getAddresses(userId: string): Promise<Address[]> {
    return await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, userId))
      .orderBy(desc(addresses.createdAt));
  }

  async createAddress(insertAddress: InsertAddress): Promise<Address> {
    const [address] = await db
      .insert(addresses)
      .values(insertAddress)
      .returning();
    return address;
  }

  async getAddress(id: string): Promise<Address | undefined> {
    const [address] = await db
      .select()
      .from(addresses)
      .where(eq(addresses.id, id));
    return address;
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<void> {
    await db
      .update(addresses)
      .set({ isDefault: false })
      .where(eq(addresses.userId, userId));
    await db
      .update(addresses)
      .set({ isDefault: true })
      .where(eq(addresses.id, addressId));
  }

  async deleteAddress(id: string): Promise<void> {
    await db.delete(addresses).where(eq(addresses.id, id));
  }

  async getOrders(userId: string): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));
  }

  async getAllOrders(): Promise<Order[]> {
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const [order] = await db.insert(orders).values(insertOrder).returning();
    return order;
  }

  async updateOrder(
    id: string,
    updates: Partial<Order>,
  ): Promise<Order | undefined> {
    const [order] = await db
      .update(orders)
      .set(updates)
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  async getProduct(productId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE id = ${productId}`,
    );
    return (result as unknown as any[])?.[0] || null;
  }

  async listProducts(active = true, limit = 20, offset = 0) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE active = ${active} LIMIT ${limit} OFFSET ${offset}`,
    );
    return (result as unknown as any[]) || [];
  }

  async listProductsWithPrices(active = true, limit = 20, offset = 0) {
    const result = await db.execute(
      sql`
        WITH paginated_products AS (
          SELECT id, name, description, metadata, active
          FROM stripe.products
          WHERE active = ${active}
          ORDER BY id
          LIMIT ${limit} OFFSET ${offset}
        )
        SELECT 
          p.id as product_id,
          p.name as product_name,
          p.description as product_description,
          p.active as product_active,
          p.metadata as product_metadata,
          pr.id as price_id,
          pr.unit_amount,
          pr.currency,
          pr.recurring,
          pr.active as price_active,
          pr.metadata as price_metadata
        FROM paginated_products p
        LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        ORDER BY p.id, pr.unit_amount
      `,
    );
    return (result as unknown as any[]) || [];
  }

  async getPrice(priceId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.prices WHERE id = ${priceId}`,
    );
    return (result as unknown as any[])?.[0] || null;
  }

  async listPrices(active = true, limit = 20, offset = 0) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.prices WHERE active = ${active} LIMIT ${limit} OFFSET ${offset}`,
    );
    return (result as unknown as any[]) || [];
  }

  async getPricesForProduct(productId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.prices WHERE product = ${productId} AND active = true`,
    );
    return (result as unknown as any[]) || [];
  }

  async getSubscription(subscriptionId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`,
    );
    return (result as unknown as any[])?.[0] || null;
  }

  async getCarnivalEvents(): Promise<CarnivalEvent[]> {
    return db
      .select()
      .from(carnivalEvents)
      .where(eq(carnivalEvents.isActive, true))
      .orderBy(asc(carnivalEvents.sortOrder), asc(carnivalEvents.date));
  }

  async getAllCarnivalEvents(): Promise<CarnivalEvent[]> {
    return db
      .select()
      .from(carnivalEvents)
      .orderBy(asc(carnivalEvents.sortOrder), asc(carnivalEvents.date));
  }

  async getCarnivalEvent(id: string): Promise<CarnivalEvent | undefined> {
    const [event] = await db
      .select()
      .from(carnivalEvents)
      .where(eq(carnivalEvents.id, id));
    return event;
  }

  async createCarnivalEvent(
    event: InsertCarnivalEvent,
  ): Promise<CarnivalEvent> {
    const [newEvent] = await db
      .insert(carnivalEvents)
      .values(event)
      .returning();
    return newEvent;
  }

  async updateCarnivalEvent(
    id: string,
    updates: Partial<CarnivalEvent>,
  ): Promise<CarnivalEvent | undefined> {
    const [updated] = await db
      .update(carnivalEvents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(carnivalEvents.id, id))
      .returning();
    return updated;
  }

  async deleteCarnivalEvent(id: string): Promise<boolean> {
    const result = await db
      .delete(carnivalEvents)
      .where(eq(carnivalEvents.id, id));
    return true;
  }

  // ============================================
  // BUSINESS OPERATIONS
  // ============================================

  async getBusinesses(type?: string): Promise<Business[]> {
    if (type) {
      return db
        .select()
        .from(businesses)
        .where(and(eq(businesses.isActive, true), eq(businesses.type, type)));
    }
    return db.select().from(businesses).where(eq(businesses.isActive, true));
  }

  async getAllBusinesses(): Promise<Business[]> {
    return db.select().from(businesses);
  }

  async getBusinessById(id: string): Promise<Business | undefined> {
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, id));
    return business;
  }

  async getBusinessByOwnerId(ownerId: string): Promise<Business | undefined> {
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerId, ownerId));
    return business;
  }

  async createBusiness(data: InsertBusiness): Promise<Business> {
    const [business] = await db.insert(businesses).values(data).returning();
    return business;
  }

  async updateBusiness(
    id: string,
    updates: Partial<Business>,
  ): Promise<Business | undefined> {
    const [business] = await db
      .update(businesses)
      .set(updates)
      .where(eq(businesses.id, id))
      .returning();
    return business;
  }

  async updateBusinessRating(businessId: string): Promise<void> {
    const businessReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.businessId, businessId));
    const validRatings = businessReviews
      .filter((r) => r.businessRating)
      .map((r) => r.businessRating!);
    if (validRatings.length > 0) {
      const avgRating = Math.round(
        (validRatings.reduce((a, b) => a + b, 0) / validRatings.length) * 10,
      );
      await db
        .update(businesses)
        .set({ rating: avgRating, totalRatings: validRatings.length })
        .where(eq(businesses.id, businessId));
    }
  }

  // ============================================
  // PRODUCT OPERATIONS
  // ============================================

  async getProductsByBusiness(businessId: string): Promise<Product[]> {
    return db
      .select()
      .from(products)
      .where(eq(products.businessId, businessId))
      .orderBy(asc(products.sortOrder));
  }

  async createProduct(data: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(data).returning();
    return product;
  }

  async updateProduct(
    id: string,
    updates: Partial<Product>,
  ): Promise<Product | undefined> {
    const [product] = await db
      .update(products)
      .set(updates)
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  async deleteProduct(id: string): Promise<boolean> {
    await db.delete(products).where(eq(products.id, id));
    return true;
  }

  // ============================================
  // ORDER OPERATIONS FOR BUSINESS/DELIVERY
  // ============================================

  async getOrdersByBusiness(businessId: string): Promise<Order[]> {
    return db
      .select()
      .from(orders)
      .where(eq(orders.businessId, businessId))
      .orderBy(desc(orders.createdAt));
  }

  async getOrdersByDeliveryPerson(deliveryPersonId: string): Promise<Order[]> {
    return db
      .select()
      .from(orders)
      .where(eq(orders.deliveryPersonId, deliveryPersonId))
      .orderBy(desc(orders.createdAt));
  }

  async getAvailableDeliveryOrders(): Promise<Order[]> {
    return db
      .select()
      .from(orders)
      .where(and(eq(orders.status, "ready"), isNull(orders.deliveryPersonId)))
      .orderBy(desc(orders.createdAt));
  }

  async updateOrderStatus(
    orderId: string,
    status: string,
    deliveryPersonId?: string,
  ): Promise<Order | undefined> {
    const updates: Partial<Order> = { status };
    if (deliveryPersonId) {
      updates.deliveryPersonId = deliveryPersonId;
    }
    const [order] = await db
      .update(orders)
      .set(updates)
      .where(eq(orders.id, orderId))
      .returning();
    return order;
  }

  async assignDeliveryPerson(
    orderId: string,
    deliveryPersonId: string,
  ): Promise<Order | undefined> {
    const [order] = await db
      .update(orders)
      .set({ deliveryPersonId })
      .where(eq(orders.id, orderId))
      .returning();
    return order;
  }

  async addOrderStatusHistory(
    orderId: string,
    status: string,
    note?: string,
  ): Promise<OrderStatusHistory> {
    const [history] = await db
      .insert(orderStatusHistory)
      .values({ orderId, status, note })
      .returning();
    return history;
  }

  // ============================================
  // REVIEW OPERATIONS
  // ============================================

  async createReview(data: InsertReview): Promise<Review> {
    const [review] = await db.insert(reviews).values(data).returning();
    return review;
  }

  async getBusinessReviews(businessId: string): Promise<Review[]> {
    return db
      .select()
      .from(reviews)
      .where(eq(reviews.businessId, businessId))
      .orderBy(desc(reviews.createdAt));
  }

  async getOrderReview(orderId: string): Promise<Review | undefined> {
    const [review] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.orderId, orderId));
    return review;
  }

  // ============================================
  // COUPON OPERATIONS
  // ============================================

  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [coupon] = await db
      .select()
      .from(coupons)
      .where(eq(coupons.code, code.toUpperCase()));
    return coupon;
  }

  async createCoupon(data: InsertCoupon): Promise<Coupon> {
    const [coupon] = await db
      .insert(coupons)
      .values({ ...data, code: data.code.toUpperCase() })
      .returning();
    return coupon;
  }

  async getAllCoupons(): Promise<Coupon[]> {
    return db.select().from(coupons).orderBy(desc(coupons.createdAt));
  }

  async incrementCouponUsage(couponId: string): Promise<void> {
    await db
      .update(coupons)
      .set({ usedCount: sql`COALESCE(${coupons.usedCount}, 0) + 1` })
      .where(eq(coupons.id, couponId));
  }

  // ============================================
  // SUPPORT TICKET OPERATIONS
  // ============================================

  async createSupportTicket(data: InsertSupportTicket): Promise<SupportTicket> {
    const [ticket] = await db.insert(supportTickets).values(data).returning();
    return ticket;
  }

  async getUserSupportTickets(userId: string): Promise<SupportTicket[]> {
    return db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt));
  }

  async getSupportTicketWithMessages(
    ticketId: string,
  ): Promise<
    { ticket: SupportTicket; messages: SupportMessage[] } | undefined
  > {
    const [ticket] = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, ticketId));
    if (!ticket) return undefined;
    const messages = await db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.ticketId, ticketId))
      .orderBy(asc(supportMessages.createdAt));
    return { ticket, messages };
  }

  async addSupportMessage(
    ticketId: string,
    senderId: string,
    message: string,
    isStaff: boolean,
  ): Promise<SupportMessage> {
    const [msg] = await db
      .insert(supportMessages)
      .values({ ticketId, senderId, message, isStaff })
      .returning();
    await db
      .update(supportTickets)
      .set({ updatedAt: new Date() })
      .where(eq(supportTickets.id, ticketId));
    return msg;
  }

  async updateSupportTicketStatus(
    ticketId: string,
    status: string,
  ): Promise<SupportTicket | undefined> {
    const [ticket] = await db
      .update(supportTickets)
      .set({ status, updatedAt: new Date() })
      .where(eq(supportTickets.id, ticketId))
      .returning();
    return ticket;
  }

  // ============ DELIVERY LOCATIONS ============

  async updateDeliveryLocation(
    deliveryPersonId: string,
    latitude: string,
    longitude: string,
    isOnline: boolean = true,
  ): Promise<DeliveryLocation> {
    const existing = await db
      .select()
      .from(deliveryLocations)
      .where(eq(deliveryLocations.deliveryPersonId, deliveryPersonId));
    if (existing.length > 0) {
      const [updated] = await db
        .update(deliveryLocations)
        .set({ latitude, longitude, isOnline, lastUpdated: new Date() })
        .where(eq(deliveryLocations.deliveryPersonId, deliveryPersonId))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(deliveryLocations)
      .values({ deliveryPersonId, latitude, longitude, isOnline })
      .returning();
    return created;
  }

  async getDeliveryLocation(
    deliveryPersonId: string,
  ): Promise<DeliveryLocation | undefined> {
    const [location] = await db
      .select()
      .from(deliveryLocations)
      .where(eq(deliveryLocations.deliveryPersonId, deliveryPersonId));
    return location;
  }

  async getOnlineDeliveryPersons(): Promise<DeliveryLocation[]> {
    return db
      .select()
      .from(deliveryLocations)
      .where(eq(deliveryLocations.isOnline, true));
  }

  // ============ FAVORITES ============

  async getUserFavorites(userId: string): Promise<Favorite[]> {
    return db
      .select()
      .from(favorites)
      .where(eq(favorites.userId, userId))
      .orderBy(desc(favorites.createdAt));
  }

  async addFavorite(
    userId: string,
    businessId?: string,
    productId?: string,
  ): Promise<Favorite> {
    const [favorite] = await db
      .insert(favorites)
      .values({ userId, businessId, productId })
      .returning();
    return favorite;
  }

  async removeFavorite(id: string): Promise<void> {
    await db.delete(favorites).where(eq(favorites.id, id));
  }

  // ============ SCHEDULED ORDERS ============

  async getScheduledOrders(userId: string): Promise<ScheduledOrder[]> {
    return db
      .select()
      .from(scheduledOrders)
      .where(eq(scheduledOrders.userId, userId))
      .orderBy(asc(scheduledOrders.scheduledDate));
  }

  async createScheduledOrder(data: any): Promise<ScheduledOrder> {
    const [order] = await db.insert(scheduledOrders).values(data).returning();
    return order;
  }

  async confirmScheduledOrder(id: string): Promise<ScheduledOrder | undefined> {
    const [order] = await db
      .update(scheduledOrders)
      .set({ status: "confirmed", confirmedAt: new Date() })
      .where(eq(scheduledOrders.id, id))
      .returning();
    return order;
  }

  async cancelScheduledOrder(id: string): Promise<void> {
    await db
      .update(scheduledOrders)
      .set({ status: "cancelled" })
      .where(eq(scheduledOrders.id, id));
  }

  // ============ RECURRING ORDERS ============

  async getRecurringOrders(userId: string): Promise<RecurringOrder[]> {
    return db
      .select()
      .from(recurringOrders)
      .where(eq(recurringOrders.userId, userId));
  }

  async createRecurringOrder(data: any): Promise<RecurringOrder> {
    const [order] = await db.insert(recurringOrders).values(data).returning();
    return order;
  }

  async updateRecurringOrder(
    id: string,
    data: any,
  ): Promise<RecurringOrder | undefined> {
    const [order] = await db
      .update(recurringOrders)
      .set(data)
      .where(eq(recurringOrders.id, id))
      .returning();
    return order;
  }

  async deleteRecurringOrder(id: string): Promise<void> {
    await db
      .update(recurringOrders)
      .set({ isActive: false })
      .where(eq(recurringOrders.id, id));
  }

  // ============ ORDER CHAT ============

  async getOrderChatMessages(orderId: string): Promise<OrderChat[]> {
    return db
      .select()
      .from(orderChats)
      .where(eq(orderChats.orderId, orderId))
      .orderBy(asc(orderChats.createdAt));
  }

  async sendChatMessage(
    orderId: string,
    senderId: string,
    receiverId: string,
    message: string,
  ): Promise<OrderChat> {
    const [chatMsg] = await db
      .insert(orderChats)
      .values({ orderId, senderId, receiverId, message })
      .returning();
    return chatMsg;
  }

  // ============ TIPS ============

  async addTip(
    orderId: string,
    userId: string,
    deliveryPersonId: string,
    amount: number,
  ): Promise<Tip> {
    const [tip] = await db
      .insert(tips)
      .values({ orderId, userId, deliveryPersonId, amount })
      .returning();
    return tip;
  }

  // ============ DELIVERY EARNINGS ============

  async getDeliveryEarnings(
    deliveryPersonId: string,
  ): Promise<DeliveryEarning[]> {
    return db
      .select()
      .from(deliveryEarnings)
      .where(eq(deliveryEarnings.deliveryPersonId, deliveryPersonId))
      .orderBy(desc(deliveryEarnings.createdAt));
  }

  async getDeliveryStats(deliveryPersonId: string): Promise<{
    totalDeliveries: number;
    totalEarnings: number;
    totalTips: number;
  }> {
    const earnings = await this.getDeliveryEarnings(deliveryPersonId);
    const totalDeliveries = earnings.length;
    const totalEarnings = earnings.reduce((sum, e) => sum + e.deliveryFee, 0);
    const totalTips = earnings.reduce((sum, e) => sum + (e.tipAmount || 0), 0);
    return { totalDeliveries, totalEarnings, totalTips };
  }

  async recordDeliveryEarning(
    deliveryPersonId: string,
    orderId: string,
    deliveryFee: number,
    tipAmount: number = 0,
  ): Promise<DeliveryEarning> {
    const [earning] = await db
      .insert(deliveryEarnings)
      .values({ deliveryPersonId, orderId, deliveryFee, tipAmount })
      .returning();
    return earning;
  }

  // ============ HELPER ============

  async getOrderById(orderId: string): Promise<Order | undefined> {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId));
    return order;
  }

  // ============ MÓDULO 1: WALLETS Y TRANSACCIONES ============

  async getWallet(userId: string): Promise<Wallet | undefined> {
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId));
    return wallet;
  }

  async getWalletById(walletId: string): Promise<Wallet | undefined> {
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.id, walletId));
    return wallet;
  }

  async createWallet(userId: string): Promise<Wallet> {
    const [wallet] = await db.insert(wallets).values({ userId }).returning();
    return wallet;
  }

  async getOrCreateWallet(userId: string): Promise<Wallet> {
    const existing = await this.getWallet(userId);
    if (existing) return existing;
    return this.createWallet(userId);
  }

  async updateWalletBalance(
    walletId: string,
    amount: number,
    type: "add" | "subtract" | "set",
  ): Promise<Wallet | undefined> {
    const wallet = await this.getWalletById(walletId);
    if (!wallet) return undefined;

    let newBalance = wallet.balance;
    if (type === "add") newBalance += amount;
    else if (type === "subtract") newBalance -= amount;
    else newBalance = amount;

    const [updated] = await db
      .update(wallets)
      .set({
        balance: newBalance,
        totalEarned:
          type === "add" ? wallet.totalEarned + amount : wallet.totalEarned,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, walletId))
      .returning();
    return updated;
  }

  async createTransaction(data: InsertTransaction): Promise<Transaction> {
    const [tx] = await db.insert(transactions).values(data).returning();
    return tx;
  }

  async getTransactions(
    walletId: string,
    limit: number = 50,
  ): Promise<Transaction[]> {
    return db
      .select()
      .from(transactions)
      .where(eq(transactions.walletId, walletId))
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
  }

  async getTransactionsByOrder(orderId: string): Promise<Transaction[]> {
    return db
      .select()
      .from(transactions)
      .where(eq(transactions.orderId, orderId))
      .orderBy(desc(transactions.createdAt));
  }

  async updateTransaction(
    id: string,
    data: Partial<Transaction>,
  ): Promise<Transaction | undefined> {
    const [tx] = await db
      .update(transactions)
      .set(data)
      .where(eq(transactions.id, id))
      .returning();
    return tx;
  }

  // ============ COMISIONES ============

  async getCommissionSettings(): Promise<CommissionSetting | undefined> {
    const [settings] = await db
      .select()
      .from(commissionSettings)
      .where(eq(commissionSettings.isActive, true))
      .limit(1);
    return settings;
  }

  async createCommissionSettings(
    data: Partial<CommissionSetting>,
  ): Promise<CommissionSetting> {
    const [settings] = await db
      .insert(commissionSettings)
      .values({
        name: data.name || "default",
        platformPercent: data.platformPercent || 15,
        businessPercent: data.businessPercent || 70,
        deliveryPercent: data.deliveryPercent || 15,
      })
      .returning();
    return settings;
  }

  async updateCommissionSettings(
    id: string,
    data: Partial<CommissionSetting>,
  ): Promise<CommissionSetting | undefined> {
    const [settings] = await db
      .update(commissionSettings)
      .set(data)
      .where(eq(commissionSettings.id, id))
      .returning();
    return settings;
  }

  // ============ RETIROS ============

  async createWithdrawalRequest(
    data: InsertWithdrawalRequest,
  ): Promise<WithdrawalRequest> {
    const [request] = await db
      .insert(withdrawalRequests)
      .values(data)
      .returning();
    return request;
  }

  async getWithdrawalRequests(userId: string): Promise<WithdrawalRequest[]> {
    return db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.userId, userId))
      .orderBy(desc(withdrawalRequests.createdAt));
  }

  async getAllWithdrawalRequests(
    status?: string,
  ): Promise<WithdrawalRequest[]> {
    if (status) {
      return db
        .select()
        .from(withdrawalRequests)
        .where(eq(withdrawalRequests.status, status))
        .orderBy(desc(withdrawalRequests.createdAt));
    }
    return db
      .select()
      .from(withdrawalRequests)
      .orderBy(desc(withdrawalRequests.createdAt));
  }

  async updateWithdrawalRequest(
    id: string,
    data: Partial<WithdrawalRequest>,
  ): Promise<WithdrawalRequest | undefined> {
    const [request] = await db
      .update(withdrawalRequests)
      .set(data)
      .where(eq(withdrawalRequests.id, id))
      .returning();
    return request;
  }

  // ============ MÓDULO 2: REGLAS DE CANCELACIÓN ============

  async getCancellationRules(): Promise<CancellationRule[]> {
    return db
      .select()
      .from(cancellationRules)
      .orderBy(asc(cancellationRules.orderStatus));
  }

  async getCancellationRule(
    orderStatus: string,
  ): Promise<CancellationRule | undefined> {
    const [rule] = await db
      .select()
      .from(cancellationRules)
      .where(eq(cancellationRules.orderStatus, orderStatus));
    return rule;
  }

  async createCancellationRule(
    data: Partial<CancellationRule>,
  ): Promise<CancellationRule> {
    const [rule] = await db
      .insert(cancellationRules)
      .values({
        orderStatus: data.orderStatus!,
        canCancel: data.canCancel ?? true,
        penaltyPercent: data.penaltyPercent ?? 0,
        refundPercent: data.refundPercent ?? 100,
        description: data.description,
      })
      .returning();
    return rule;
  }

  async updateCancellationRule(
    id: string,
    data: Partial<CancellationRule>,
  ): Promise<CancellationRule | undefined> {
    const [rule] = await db
      .update(cancellationRules)
      .set(data)
      .where(eq(cancellationRules.id, id))
      .returning();
    return rule;
  }

  // ============ PENALIZACIONES ============

  async createPenalty(data: Partial<Penalty>): Promise<Penalty> {
    const [penalty] = await db
      .insert(penalties)
      .values({
        userId: data.userId!,
        orderId: data.orderId,
        type: data.type!,
        amount: data.amount!,
        reason: data.reason!,
        status: data.status || "applied",
      })
      .returning();
    return penalty;
  }

  async getPenalties(userId: string): Promise<Penalty[]> {
    return db
      .select()
      .from(penalties)
      .where(eq(penalties.userId, userId))
      .orderBy(desc(penalties.createdAt));
  }

  async waivePenalty(
    penaltyId: string,
    waivedBy: string,
    reason: string,
  ): Promise<Penalty | undefined> {
    const [penalty] = await db
      .update(penalties)
      .set({ status: "waived", waivedBy, waivedReason: reason })
      .where(eq(penalties.id, penaltyId))
      .returning();
    return penalty;
  }

  // ============ MÓDULO 3: PROBLEMAS DE PEDIDOS ============

  async createOrderIssue(data: InsertOrderIssue): Promise<OrderIssue> {
    const [issue] = await db.insert(orderIssues).values(data).returning();
    return issue;
  }

  async getOrderIssue(id: string): Promise<OrderIssue | undefined> {
    const [issue] = await db
      .select()
      .from(orderIssues)
      .where(eq(orderIssues.id, id));
    return issue;
  }

  async getOrderIssues(orderId: string): Promise<OrderIssue[]> {
    return db
      .select()
      .from(orderIssues)
      .where(eq(orderIssues.orderId, orderId))
      .orderBy(desc(orderIssues.createdAt));
  }

  async getUserIssues(userId: string): Promise<OrderIssue[]> {
    return db
      .select()
      .from(orderIssues)
      .where(eq(orderIssues.reporterId, userId))
      .orderBy(desc(orderIssues.createdAt));
  }

  async getAllOrderIssues(status?: string): Promise<OrderIssue[]> {
    if (status) {
      return db
        .select()
        .from(orderIssues)
        .where(eq(orderIssues.status, status))
        .orderBy(desc(orderIssues.createdAt));
    }
    return db.select().from(orderIssues).orderBy(desc(orderIssues.createdAt));
  }

  async updateOrderIssue(
    id: string,
    data: Partial<OrderIssue>,
  ): Promise<OrderIssue | undefined> {
    const [issue] = await db
      .update(orderIssues)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(orderIssues.id, id))
      .returning();
    return issue;
  }

  async addIssuePhoto(
    issueId: string,
    photoUrl: string,
    uploadedBy: string,
  ): Promise<IssuePhoto> {
    const [photo] = await db
      .insert(issuePhotos)
      .values({ issueId, photoUrl, uploadedBy })
      .returning();
    return photo;
  }

  async getIssuePhotos(issueId: string): Promise<IssuePhoto[]> {
    return db
      .select()
      .from(issuePhotos)
      .where(eq(issuePhotos.issueId, issueId));
  }

  // ============ MÓDULO 4: ZONAS DE ENTREGA ============

  async getDeliveryZones(businessId: string): Promise<DeliveryZone[]> {
    return db
      .select()
      .from(deliveryZones)
      .where(eq(deliveryZones.businessId, businessId))
      .orderBy(asc(deliveryZones.radiusKm));
  }

  async createDeliveryZone(data: InsertDeliveryZone): Promise<DeliveryZone> {
    const [zone] = await db.insert(deliveryZones).values(data).returning();
    return zone;
  }

  async updateDeliveryZone(
    id: string,
    data: Partial<DeliveryZone>,
  ): Promise<DeliveryZone | undefined> {
    const [zone] = await db
      .update(deliveryZones)
      .set(data)
      .where(eq(deliveryZones.id, id))
      .returning();
    return zone;
  }

  async deleteDeliveryZone(id: string): Promise<void> {
    await db.delete(deliveryZones).where(eq(deliveryZones.id, id));
  }

  // ============ ASIGNACIONES DE ENTREGA ============

  async createDeliveryAssignment(
    orderId: string,
    estimatedMinutes?: number,
  ): Promise<DeliveryAssignment> {
    const [assignment] = await db
      .insert(deliveryAssignments)
      .values({
        orderId,
        estimatedMinutes,
        status: "pending",
      })
      .returning();
    return assignment;
  }

  async getDeliveryAssignment(
    orderId: string,
  ): Promise<DeliveryAssignment | undefined> {
    const [assignment] = await db
      .select()
      .from(deliveryAssignments)
      .where(eq(deliveryAssignments.orderId, orderId));
    return assignment;
  }

  async updateDeliveryAssignment(
    id: string,
    data: Partial<DeliveryAssignment>,
  ): Promise<DeliveryAssignment | undefined> {
    const [assignment] = await db
      .update(deliveryAssignments)
      .set(data)
      .where(eq(deliveryAssignments.id, id))
      .returning();
    return assignment;
  }

  // Alias para getDeliveryAssignment
  async getOrderAssignment(
    orderId: string,
  ): Promise<DeliveryAssignment | undefined> {
    return this.getDeliveryAssignment(orderId);
  }

  // Obtener asignación activa de un repartidor
  async getDriverActiveAssignment(
    driverId: string,
  ): Promise<DeliveryAssignment | undefined> {
    const [assignment] = await db
      .select()
      .from(deliveryAssignments)
      .where(
        and(
          eq(deliveryAssignments.deliveryPersonId, driverId),
          sql`${deliveryAssignments.status} IN ('accepted', 'picked_up', 'on_the_way')`,
        ),
      );
    return assignment;
  }

  async findNearestDeliveryPersons(
    businessLat: number,
    businessLng: number,
    radiusKm: number = 5,
  ): Promise<DeliveryLocation[]> {
    const onlineDrivers = await this.getOnlineDeliveryPersons();
    return onlineDrivers
      .filter((driver) => {
        const driverLat = parseFloat(driver.latitude);
        const driverLng = parseFloat(driver.longitude);
        const distance = this.calculateDistance(
          businessLat,
          businessLng,
          driverLat,
          driverLng,
        );
        return distance <= radiusKm;
      })
      .sort((a, b) => {
        const distA = this.calculateDistance(
          businessLat,
          businessLng,
          parseFloat(a.latitude),
          parseFloat(a.longitude),
        );
        const distB = this.calculateDistance(
          businessLat,
          businessLng,
          parseFloat(b.latitude),
          parseFloat(b.longitude),
        );
        return distA - distB;
      });
  }

  // Haversine formula to calculate distance in km
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async calculateDeliveryFee(
    distanceKm: number,
    baseFee?: number,
    feePerKm?: number,
  ): Promise<number> {
    const { getSettingValue } = await import("./systemSettingsService");
    const actualBaseFee =
      baseFee ?? (await getSettingValue("delivery_base_fee", 300));
    const actualFeePerKm =
      feePerKm ?? (await getSettingValue("delivery_fee_per_km", 50));
    return actualBaseFee + Math.ceil(distanceKm) * actualFeePerKm;
  }

  // ============ MÓDULO FINANZAS: RETENCIÓN DE FONDOS ============

  // Crear retención de fondos para una orden (anti-fraude)
  async createHeldFund(data: {
    orderId: string;
    businessWalletId?: string;
    deliveryWalletId?: string;
    businessAmount: number;
    deliveryAmount: number;
    platformAmount: number;
    releaseAfter?: Date;
  }): Promise<HeldFund> {
    const [held] = await db
      .insert(heldFunds)
      .values({
        orderId: data.orderId,
        businessWalletId: data.businessWalletId,
        deliveryWalletId: data.deliveryWalletId,
        businessAmount: data.businessAmount,
        deliveryAmount: data.deliveryAmount,
        platformAmount: data.platformAmount,
        status: "held",
        releaseAfter: data.releaseAfter,
      })
      .returning();
    return held;
  }

  // Obtener fondos retenidos por orden
  async getHeldFundByOrder(orderId: string): Promise<HeldFund | undefined> {
    const [held] = await db
      .select()
      .from(heldFunds)
      .where(eq(heldFunds.orderId, orderId));
    return held;
  }

  // Obtener todos los fondos retenidos pendientes
  async getPendingHeldFunds(): Promise<HeldFund[]> {
    return db
      .select()
      .from(heldFunds)
      .where(eq(heldFunds.status, "held"))
      .orderBy(asc(heldFunds.createdAt));
  }

  // Liberar fondos retenidos (mover de pendingBalance a balance)
  async releaseHeldFund(
    orderId: string,
    releasedBy?: string,
  ): Promise<HeldFund | undefined> {
    const held = await this.getHeldFundByOrder(orderId);
    if (!held || held.status !== "held") return undefined;

    // Actualizar billetera del negocio
    if (held.businessWalletId && held.businessAmount > 0) {
      const businessWallet = await this.getWalletById(held.businessWalletId);
      if (businessWallet) {
        await db
          .update(wallets)
          .set({
            balance: businessWallet.balance + held.businessAmount,
            pendingBalance: businessWallet.pendingBalance - held.businessAmount,
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, held.businessWalletId));
      }
    }

    // Actualizar billetera del repartidor
    if (held.deliveryWalletId && held.deliveryAmount > 0) {
      const deliveryWallet = await this.getWalletById(held.deliveryWalletId);
      if (deliveryWallet) {
        await db
          .update(wallets)
          .set({
            balance: deliveryWallet.balance + held.deliveryAmount,
            pendingBalance: deliveryWallet.pendingBalance - held.deliveryAmount,
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, held.deliveryWalletId));
      }
    }

    // Marcar fondos como liberados
    const [updated] = await db
      .update(heldFunds)
      .set({
        status: "released",
        releasedAt: new Date(),
        releasedBy: releasedBy || null,
      })
      .where(eq(heldFunds.orderId, orderId))
      .returning();

    return updated;
  }

  // Marcar fondos como en disputa
  async markHeldFundDisputed(orderId: string): Promise<HeldFund | undefined> {
    const [updated] = await db
      .update(heldFunds)
      .set({
        status: "disputed",
      })
      .where(eq(heldFunds.orderId, orderId))
      .returning();
    return updated;
  }

  // Reembolsar fondos retenidos (para disputas)
  async refundHeldFund(
    orderId: string,
    refundBusiness: boolean,
    refundDelivery: boolean,
  ): Promise<HeldFund | undefined> {
    const held = await this.getHeldFundByOrder(orderId);
    if (!held) return undefined;

    // Si NO se reembolsa, los fondos pasan de pendingBalance a balance (el negocio/repartidor los conserva)
    // Si SÍ se reembolsa, los fondos se restan de pendingBalance sin pasar a balance

    if (held.businessWalletId) {
      const businessWallet = await this.getWalletById(held.businessWalletId);
      if (businessWallet) {
        if (!refundBusiness) {
          // Negocio conserva el dinero - mover a balance
          await db
            .update(wallets)
            .set({
              balance: businessWallet.balance + held.businessAmount,
              pendingBalance:
                businessWallet.pendingBalance - held.businessAmount,
              updatedAt: new Date(),
            })
            .where(eq(wallets.id, held.businessWalletId));
        } else {
          // Reembolso al cliente - solo quitar de pendingBalance
          await db
            .update(wallets)
            .set({
              pendingBalance:
                businessWallet.pendingBalance - held.businessAmount,
              updatedAt: new Date(),
            })
            .where(eq(wallets.id, held.businessWalletId));
        }
      }
    }

    if (held.deliveryWalletId) {
      const deliveryWallet = await this.getWalletById(held.deliveryWalletId);
      if (deliveryWallet) {
        if (!refundDelivery) {
          // Repartidor conserva el dinero
          await db
            .update(wallets)
            .set({
              balance: deliveryWallet.balance + held.deliveryAmount,
              pendingBalance:
                deliveryWallet.pendingBalance - held.deliveryAmount,
              updatedAt: new Date(),
            })
            .where(eq(wallets.id, held.deliveryWalletId));
        } else {
          // Reembolso - quitar de pendingBalance
          await db
            .update(wallets)
            .set({
              pendingBalance:
                deliveryWallet.pendingBalance - held.deliveryAmount,
              updatedAt: new Date(),
            })
            .where(eq(wallets.id, held.deliveryWalletId));
        }
      }
    }

    const [updated] = await db
      .update(heldFunds)
      .set({
        status: "refunded",
        releasedAt: new Date(),
      })
      .where(eq(heldFunds.orderId, orderId))
      .returning();

    return updated;
  }

  // Agregar dinero al pendingBalance (en lugar de balance directo)
  async addToPendingBalance(
    walletId: string,
    amount: number,
  ): Promise<Wallet | undefined> {
    const wallet = await this.getWalletById(walletId);
    if (!wallet) return undefined;

    const [updated] = await db
      .update(wallets)
      .set({
        pendingBalance: wallet.pendingBalance + amount,
        totalEarned: wallet.totalEarned + amount,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, walletId))
      .returning();

    return updated;
  }

  // Obtener fotos de prueba de entrega (del repartidor)
  async getDeliveryProofPhotos(orderId: string): Promise<IssuePhoto[]> {
    // Buscar fotos subidas por el repartidor para este pedido
    const order = await this.getOrder(orderId);
    if (!order || !order.deliveryPersonId) return [];

    // Buscar en issue_photos donde uploadedBy sea el repartidor
    const photos = await db
      .select()
      .from(issuePhotos)
      .innerJoin(orderIssues, eq(issuePhotos.issueId, orderIssues.id))
      .where(
        and(
          eq(orderIssues.orderId, orderId),
          eq(issuePhotos.uploadedBy, order.deliveryPersonId),
        ),
      );

    return photos.map((p) => p.issue_photos);
  }

  // Contar disputas perdidas por usuario (para penalizaciones por reincidencia)
  async countLostDisputes(userId: string): Promise<number> {
    // Contar issues donde el usuario fue el repartidor/negocio y la resolución fue a favor del cliente
    const ordersAsDelivery = await db
      .select()
      .from(orders)
      .where(eq(orders.deliveryPersonId, userId));

    let lostCount = 0;
    for (const order of ordersAsDelivery) {
      const issues = await db
        .select()
        .from(orderIssues)
        .where(
          and(
            eq(orderIssues.orderId, order.id),
            eq(orderIssues.status, "resolved"),
          ),
        );

      for (const issue of issues) {
        if (
          issue.resolution === "refund_full" ||
          issue.resolution === "refund_partial"
        ) {
          lostCount++;
        }
      }
    }

    return lostCount;
  }

  // ============ INTELIGENCIA OPERATIVA: REPARTIDORES ============

  // Registrar actividad del repartidor
  async logDriverActivity(
    driverId: string,
    action: string,
    orderId?: string,
    lat?: string,
    lng?: string,
    metadata?: string,
  ): Promise<DriverActivity> {
    const [activity] = await db
      .insert(driverActivity)
      .values({
        driverId,
        action,
        orderId,
        latitude: lat,
        longitude: lng,
        metadata,
      })
      .returning();
    return activity;
  }

  // Obtener última actividad del repartidor
  async getLastDriverActivity(
    driverId: string,
  ): Promise<DriverActivity | undefined> {
    const [activity] = await db
      .select()
      .from(driverActivity)
      .where(eq(driverActivity.driverId, driverId))
      .orderBy(desc(driverActivity.createdAt))
      .limit(1);
    return activity;
  }

  // Obtener repartidores inactivos (sin actividad en X días)
  async getInactiveDrivers(daysSinceLastActivity: number = 7): Promise<User[]> {
    const cutoffDate = new Date(
      Date.now() - daysSinceLastActivity * 24 * 60 * 60 * 1000,
    );

    // Obtener todos los repartidores activos
    const allDrivers = await db
      .select()
      .from(users)
      .where(and(eq(users.role, "delivery"), eq(users.isActive, true)));

    const inactiveDrivers: User[] = [];
    for (const driver of allDrivers) {
      const lastActivity = await this.getLastDriverActivity(driver.id);
      if (!lastActivity || new Date(lastActivity.createdAt!) < cutoffDate) {
        inactiveDrivers.push(driver);
      }
    }

    return inactiveDrivers;
  }

  // Registrar rechazo de pedido
  async recordDriverRejection(
    driverId: string,
    orderId: string,
    reason?: string,
  ): Promise<{
    rejection: DriverRejection;
    consecutiveCount: number;
    strikeAssigned: boolean;
  }> {
    // Obtener el último rechazo para calcular consecutivos
    const [lastRejection] = await db
      .select()
      .from(driverRejections)
      .where(eq(driverRejections.driverId, driverId))
      .orderBy(desc(driverRejections.createdAt))
      .limit(1);

    // Verificar si el último rechazo fue hace menos de 1 hora (considerado consecutivo)
    let consecutiveCount = 1;
    if (lastRejection) {
      const hoursSinceLastRejection =
        (Date.now() - new Date(lastRejection.createdAt!).getTime()) /
        (1000 * 60 * 60);
      if (hoursSinceLastRejection < 1) {
        consecutiveCount = lastRejection.consecutiveCount + 1;
      }
    }

    // Registrar el rechazo
    const [rejection] = await db
      .insert(driverRejections)
      .values({
        driverId,
        orderId,
        reason,
        consecutiveCount,
      })
      .returning();

    // Si son 3 rechazos consecutivos, asignar strike
    let strikeAssigned = false;
    if (consecutiveCount >= 3) {
      await this.assignDriverStrike(
        driverId,
        "consecutive_rejections",
        orderId,
      );
      strikeAssigned = true;

      // Resetear contador de rechazos consecutivos
      await db
        .update(driverRejections)
        .set({ consecutiveCount: 0 })
        .where(eq(driverRejections.driverId, driverId));
    }

    // Registrar actividad
    await this.logDriverActivity(
      driverId,
      "order_rejected",
      orderId,
      undefined,
      undefined,
      JSON.stringify({ reason, consecutive: consecutiveCount }),
    );

    return { rejection, consecutiveCount, strikeAssigned };
  }

  // Obtener strikes activos del repartidor
  async getDriverStrikes(
    driverId: string,
    activeOnly: boolean = true,
  ): Promise<DriverStrike[]> {
    if (activeOnly) {
      return db
        .select()
        .from(driverStrikes)
        .where(
          and(
            eq(driverStrikes.driverId, driverId),
            eq(driverStrikes.isActive, true),
          ),
        )
        .orderBy(desc(driverStrikes.createdAt));
    }
    return db
      .select()
      .from(driverStrikes)
      .where(eq(driverStrikes.driverId, driverId))
      .orderBy(desc(driverStrikes.createdAt));
  }

  // Asignar strike al repartidor
  async assignDriverStrike(
    driverId: string,
    reason: string,
    orderId?: string,
  ): Promise<{
    strike: DriverStrike;
    totalStrikes: number;
    accountDeactivated: boolean;
  }> {
    const existingStrikes = await this.getDriverStrikes(driverId, true);
    const strikeNumber = existingStrikes.length + 1;

    // Crear strike (expira en 30 días)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const [strike] = await db
      .insert(driverStrikes)
      .values({
        driverId,
        reason,
        orderId,
        strikeNumber,
        expiresAt,
      })
      .returning();

    // Si son 3 strikes, desactivar cuenta
    let accountDeactivated = false;
    if (strikeNumber >= 3) {
      await db
        .update(users)
        .set({ isActive: false })
        .where(eq(users.id, driverId));
      accountDeactivated = true;
    }

    return { strike, totalStrikes: strikeNumber, accountDeactivated };
  }

  // Perdonar/anular strike
  async waiveDriverStrike(
    strikeId: string,
    waivedBy: string,
    reason: string,
  ): Promise<DriverStrike | undefined> {
    const [strike] = await db
      .update(driverStrikes)
      .set({
        isActive: false,
        waivedBy,
        waivedAt: new Date(),
        waivedReason: reason,
      })
      .where(eq(driverStrikes.id, strikeId))
      .returning();
    return strike;
  }

  // Limpiar strikes expirados
  async cleanExpiredStrikes(): Promise<number> {
    const now = new Date();
    const result = await db
      .update(driverStrikes)
      .set({ isActive: false })
      .where(
        and(
          eq(driverStrikes.isActive, true),
          sql`${driverStrikes.expiresAt} < ${now}`,
        ),
      )
      .returning();
    return result.length;
  }

  // ============ CONTROL OPERATIVO DE NEGOCIOS ============

  // Obtener pedidos activos de un negocio
  async getActiveOrdersCount(businessId: string): Promise<number> {
    const activeStatuses = [
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "picked_up",
    ];
    const activeOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.businessId, businessId),
          sql`${orders.status} IN ('pending', 'confirmed', 'preparing', 'ready', 'picked_up')`,
        ),
      );
    return activeOrders.length;
  }

  // Obtener pedidos atrasados de un negocio (más de X minutos desde creación sin entregar)
  async getDelayedOrdersCount(
    businessId: string,
    delayMinutes: number = 60,
  ): Promise<number> {
    const cutoffTime = new Date(Date.now() - delayMinutes * 60 * 1000);
    const delayedOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.businessId, businessId),
          sql`${orders.status} IN ('pending', 'confirmed', 'preparing', 'ready')`,
          sql`${orders.createdAt} < ${cutoffTime}`,
        ),
      );
    return delayedOrders.length;
  }

  // Pausar negocio automáticamente
  async pauseBusiness(
    businessId: string,
    reason: string,
    pauseMinutes?: number,
  ): Promise<Business | undefined> {
    const pausedUntil = pauseMinutes
      ? new Date(Date.now() + pauseMinutes * 60 * 1000)
      : null;
    const [business] = await db
      .update(businesses)
      .set({
        isPaused: true,
        pauseReason: reason,
        pausedAt: new Date(),
        pausedUntil,
      })
      .where(eq(businesses.id, businessId))
      .returning();
    return business;
  }

  // Reanudar negocio
  async resumeBusiness(businessId: string): Promise<Business | undefined> {
    const [business] = await db
      .update(businesses)
      .set({
        isPaused: false,
        pauseReason: null,
        pausedAt: null,
        pausedUntil: null,
      })
      .where(eq(businesses.id, businessId))
      .returning();
    return business;
  }

  // Verificar si negocio puede aceptar más pedidos
  async canBusinessAcceptOrders(businessId: string): Promise<{
    canAccept: boolean;
    reason?: string;
    activeOrders: number;
    maxOrders: number;
    delayedOrders: number;
  }> {
    const business = await this.getBusinessById(businessId);
    if (!business) {
      return {
        canAccept: false,
        reason: "Negocio no encontrado",
        activeOrders: 0,
        maxOrders: 0,
        delayedOrders: 0,
      };
    }

    if (!business.isActive) {
      return {
        canAccept: false,
        reason: "Negocio inactivo",
        activeOrders: 0,
        maxOrders: business.maxSimultaneousOrders || 10,
        delayedOrders: 0,
      };
    }

    if (!business.isOpen) {
      return {
        canAccept: false,
        reason: "Negocio cerrado",
        activeOrders: 0,
        maxOrders: business.maxSimultaneousOrders || 10,
        delayedOrders: 0,
      };
    }

    if (business.isPaused) {
      // Verificar si la pausa ya expiró
      if (business.pausedUntil && new Date(business.pausedUntil) < new Date()) {
        // Auto-reanudar si autoResumeEnabled
        if (business.autoResumeEnabled) {
          await this.resumeBusiness(businessId);
        }
      } else {
        return {
          canAccept: false,
          reason: `Negocio pausado: ${business.pauseReason}`,
          activeOrders: 0,
          maxOrders: business.maxSimultaneousOrders || 10,
          delayedOrders: 0,
        };
      }
    }

    const activeOrders = await this.getActiveOrdersCount(businessId);
    const maxOrders = business.maxSimultaneousOrders || 10;
    const delayedOrders = await this.getDelayedOrdersCount(businessId);

    // Verificar límite de pedidos simultáneos
    if (activeOrders >= maxOrders) {
      return {
        canAccept: false,
        reason: "Límite de pedidos alcanzado",
        activeOrders,
        maxOrders,
        delayedOrders,
      };
    }

    // Verificar pedidos atrasados
    if (delayedOrders >= 3) {
      // Auto-pausar negocio
      await this.pauseBusiness(businessId, "delayed_orders", 30); // Pausar por 30 minutos
      return {
        canAccept: false,
        reason: "Negocio pausado por pedidos atrasados",
        activeOrders,
        maxOrders,
        delayedOrders,
      };
    }

    return { canAccept: true, activeOrders, maxOrders, delayedOrders };
  }

  // ============================================
  // ADMIN LOGS - AUDITORÍA
  // ============================================

  async createAdminLog(log: {
    userId?: string;
    userEmail?: string;
    userRole?: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AdminLog> {
    const [created] = await db.insert(adminLogs).values(log).returning();
    return created;
  }

  async getAdminLogs(
    limit: number = 100,
    offset: number = 0,
  ): Promise<AdminLog[]> {
    return db
      .select()
      .from(adminLogs)
      .orderBy(desc(adminLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getAdminLogsByUser(userId: string): Promise<AdminLog[]> {
    return db
      .select()
      .from(adminLogs)
      .where(eq(adminLogs.userId, userId))
      .orderBy(desc(adminLogs.createdAt));
  }

  async getAdminLogsByResource(resource: string): Promise<AdminLog[]> {
    return db
      .select()
      .from(adminLogs)
      .where(eq(adminLogs.resource, resource))
      .orderBy(desc(adminLogs.createdAt));
  }

  // ============================================
  // RATE LIMITING
  // ============================================

  async checkRateLimit(
    ipAddress: string,
    endpoint: string,
    maxRequests: number = 100,
    windowMinutes: number = 1,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    // Buscar registro existente
    const [existing] = await db
      .select()
      .from(rateLimits)
      .where(
        and(
          eq(rateLimits.ipAddress, ipAddress),
          eq(rateLimits.endpoint, endpoint),
        ),
      );

    if (!existing) {
      // Crear nuevo registro
      await db.insert(rateLimits).values({
        ipAddress,
        endpoint,
        requestCount: 1,
        windowStart: new Date(),
      });
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: new Date(Date.now() + windowMinutes * 60 * 1000),
      };
    }

    // Verificar si está bloqueado
    if (
      existing.blocked &&
      existing.blockedUntil &&
      new Date(existing.blockedUntil) > new Date()
    ) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(existing.blockedUntil),
      };
    }

    // Verificar si la ventana expiró
    if (new Date(existing.windowStart!) < windowStart) {
      // Reiniciar contador
      await db
        .update(rateLimits)
        .set({
          requestCount: 1,
          windowStart: new Date(),
          blocked: false,
          blockedUntil: null,
        })
        .where(eq(rateLimits.id, existing.id));
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: new Date(Date.now() + windowMinutes * 60 * 1000),
      };
    }

    // Incrementar contador
    const newCount = existing.requestCount + 1;

    if (newCount > maxRequests) {
      // Bloquear IP
      const blockedUntil = new Date(Date.now() + 15 * 60 * 1000); // Bloquear por 15 minutos
      await db
        .update(rateLimits)
        .set({ requestCount: newCount, blocked: true, blockedUntil })
        .where(eq(rateLimits.id, existing.id));
      return { allowed: false, remaining: 0, resetAt: blockedUntil };
    }

    await db
      .update(rateLimits)
      .set({ requestCount: newCount })
      .where(eq(rateLimits.id, existing.id));

    return {
      allowed: true,
      remaining: maxRequests - newCount,
      resetAt: new Date(
        new Date(existing.windowStart!).getTime() + windowMinutes * 60 * 1000,
      ),
    };
  }

  async getRateLimitStats(): Promise<{
    blockedIPs: number;
    totalRequests: number;
  }> {
    const blocked = await db
      .select()
      .from(rateLimits)
      .where(eq(rateLimits.blocked, true));
    const all = await db.select().from(rateLimits);
    const totalRequests = all.reduce((sum, r) => sum + r.requestCount, 0);
    return { blockedIPs: blocked.length, totalRequests };
  }

  // ============================================
  // MÉTRICAS PARA DASHBOARD
  // ============================================

  async getTodayOrdersCount(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(sql`${orders.createdAt} >= ${todayStr}::timestamp`);

    return Number(result[0]?.count || 0);
  }

  async getTodayCancelledOrdersCount(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(
        and(
          sql`${orders.createdAt} >= ${todayStr}::timestamp`,
          eq(orders.status, "cancelled"),
        ),
      );

    return Number(result[0]?.count || 0);
  }

  async getAverageDeliveryTime(): Promise<number> {
    // Calcular tiempo promedio de los últimos 7 días
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoStr = weekAgo.toISOString();

    const deliveredOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.status, "delivered"),
          sql`${orders.createdAt} >= ${weekAgoStr}::timestamp`,
        ),
      );

    if (deliveredOrders.length === 0) return 0;

    // Calcular tiempo promedio basado en estimatedDelivery vs deliveredAt
    let totalMinutes = 0;
    let validOrders = 0;

    for (const order of deliveredOrders) {
      if (order.deliveredAt && order.createdAt) {
        const diffMs =
          new Date(order.deliveredAt).getTime() -
          new Date(order.createdAt).getTime();
        const diffMinutes = diffMs / (1000 * 60);
        if (diffMinutes > 0 && diffMinutes < 180) {
          // Ignorar tiempos anormales
          totalMinutes += diffMinutes;
          validOrders++;
        }
      }
    }

    return validOrders > 0 ? Math.round(totalMinutes / validOrders) : 30; // Default 30 minutos
  }

  async getOnlineDrivers(): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(
        and(
          eq(users.role, "delivery"),
          eq(users.isOnline, true),
          eq(users.isActive, true),
        ),
      );
  }

  async getActiveOrdersForMap(): Promise<Order[]> {
    return db
      .select()
      .from(orders)
      .where(
        sql`${orders.status} IN ('pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'on_the_way')`,
      );
  }
}

export const storage = new DatabaseStorage();
