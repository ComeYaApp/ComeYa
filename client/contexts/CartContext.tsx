import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Cart, CartItem, Product } from "@/types";
import * as Haptics from "expo-haptics";

interface CartContextType {
  cart: Cart | null;
  itemCount: number;
  subtotal: number;
  addToCart: (
    product: Product,
    businessId: string,
    businessName: string,
    quantity: number,
    note?: string,
    unitAmount?: number,
  ) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  updateNote: (itemId: string, note: string) => Promise<void>;
  clearCart: () => Promise<void>;
  isProductInCart: (productId: string) => boolean;
  getCartItem: (productId: string) => CartItem | undefined;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_KEY = "@ComeYa_cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    try {
      const stored = await AsyncStorage.getItem(CART_KEY);
      if (stored) {
        setCart(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Error loading cart:", error);
    }
  };

  const saveCart = async (newCart: Cart | null) => {
    try {
      if (newCart && newCart.items.length > 0) {
        await AsyncStorage.setItem(CART_KEY, JSON.stringify(newCart));
      } else {
        await AsyncStorage.removeItem(CART_KEY);
      }
      setCart(newCart);
    } catch (error) {
      console.error("Error saving cart:", error);
    }
  };

  const addToCart = async (
    product: Product,
    businessId: string,
    businessName: string,
    quantity: number,
    note?: string,
    unitAmount?: number,
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const newItem: CartItem = {
      id: Date.now().toString(),
      product,
      quantity,
      note,
      unitAmount,
    };

    if (!cart || cart.businessId !== businessId) {
      await saveCart({
        businessId,
        businessName,
        items: [newItem],
      });
    } else {
      const existingIndex = cart.items.findIndex(
        (item) => item.product.id === product.id,
      );

      if (existingIndex >= 0) {
        const updatedItems = [...cart.items];
        updatedItems[existingIndex] = {
          ...updatedItems[existingIndex],
          quantity: updatedItems[existingIndex].quantity + quantity,
          note: note || updatedItems[existingIndex].note,
        };
        await saveCart({ ...cart, items: updatedItems });
      } else {
        await saveCart({ ...cart, items: [...cart.items, newItem] });
      }
    }
  };

  const removeFromCart = async (itemId: string) => {
    if (!cart) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const updatedItems = cart.items.filter((item) => item.id !== itemId);
    if (updatedItems.length === 0) {
      await saveCart(null);
    } else {
      await saveCart({ ...cart, items: updatedItems });
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (!cart) return;

    if (quantity <= 0) {
      await removeFromCart(itemId);
      return;
    }

    const updatedItems = cart.items.map((item) =>
      item.id === itemId ? { ...item, quantity } : item,
    );
    await saveCart({ ...cart, items: updatedItems });
  };

  const updateNote = async (itemId: string, note: string) => {
    if (!cart) return;

    const updatedItems = cart.items.map((item) =>
      item.id === itemId ? { ...item, note } : item,
    );
    await saveCart({ ...cart, items: updatedItems });
  };

  const clearCart = async () => {
    await saveCart(null);
  };

  const isProductInCart = (productId: string) => {
    return cart?.items.some((item) => item.product.id === productId) || false;
  };

  const getCartItem = (productId: string) => {
    return cart?.items.find((item) => item.product.id === productId);
  };

  const itemCount =
    cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;

  const subtotal =
    cart?.items.reduce((sum, item) => {
      if (item.product.isWeightBased && item.unitAmount) {
        return sum + item.product.price * item.unitAmount * item.quantity;
      }
      return sum + item.product.price * item.quantity;
    }, 0) || 0;

  return (
    <CartContext.Provider
      value={{
        cart,
        itemCount,
        subtotal,
        addToCart,
        removeFromCart,
        updateQuantity,
        updateNote,
        clearCart,
        isProductInCart,
        getCartItem,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
