import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "./AuthContext";

export interface Business {
  id: string;
  name: string;
  description?: string;
  type?: string;
  image?: string;
  address?: string;
  phone?: string;
  isOpen?: boolean;
  isPaused?: boolean;
  categories?: string;
  rating?: number;
  totalRatings?: number;
  deliveryFee?: number;
  minOrder?: number;
  deliveryTime?: string;
}

interface BusinessStats {
  pendingOrders: number;
  todayOrders: number;
  todayRevenue: number;
}

interface BusinessContextType {
  businesses: Business[];
  selectedBusiness: Business | null;
  isLoading: boolean;
  selectBusiness: (business: Business | null) => void;
  loadBusinesses: () => Promise<void>;
  createBusiness: (data: Partial<Business>) => Promise<Business>;
  updateBusiness: (id: string, data: Partial<Business>) => Promise<void>;
  deleteBusiness: (id: string) => Promise<void>;
  getBusinessStats: (businessId: string) => Promise<BusinessStats>;
}

const BusinessContext = createContext<BusinessContextType | undefined>(
  undefined,
);

const SELECTED_BUSINESS_KEY = "@ComeYa_selected_business";

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);

  const loadBusinesses = useCallback(async () => {
    if (!user || user.role !== "business_owner") {
      setBusinesses([]);
      setSelectedBusiness(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest("GET", "/api/business/my-businesses");

      // Handle 404 gracefully - user might not have businesses yet
      if (response.status === 404) {
        console.log("No businesses found for user");
        setBusinesses([]);
        setSelectedBusiness(null);
        return;
      }

      const data = await response.json();

      if (data.success && data.businesses) {
        setBusinesses(data.businesses);

        const savedId = await AsyncStorage.getItem(SELECTED_BUSINESS_KEY);
        if (savedId) {
          const saved = data.businesses.find((b: Business) => b.id === savedId);
          if (saved) {
            setSelectedBusiness(saved);
          } else if (data.businesses.length > 0) {
            setSelectedBusiness(data.businesses[0]);
          }
        } else if (data.businesses.length > 0) {
          setSelectedBusiness(data.businesses[0]);
        }
      } else {
        // No businesses found
        setBusinesses([]);
        setSelectedBusiness(null);
      }
    } catch (error) {
      console.log("Error loading businesses (user may not have any):", error);
      setBusinesses([]);
      setSelectedBusiness(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === "business_owner") {
      loadBusinesses();
    }
  }, [user?.id, user?.role]);

  const selectBusiness = async (business: Business | null) => {
    setSelectedBusiness(business);
    if (business) {
      await AsyncStorage.setItem(SELECTED_BUSINESS_KEY, business.id);
    } else {
      await AsyncStorage.removeItem(SELECTED_BUSINESS_KEY);
    }
  };

  const createBusiness = async (data: Partial<Business>): Promise<Business> => {
    const response = await apiRequest("POST", "/api/business/create", data);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Error al crear negocio");
    }

    await loadBusinesses();
    return result.business;
  };

  const updateBusiness = async (id: string, data: Partial<Business>) => {
    const response = await apiRequest("PUT", `/api/business/${id}`, data);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Error al actualizar negocio");
    }

    await loadBusinesses();
  };

  const deleteBusiness = async (id: string) => {
    const response = await apiRequest("DELETE", `/api/business/${id}`);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Error al eliminar negocio");
    }

    if (selectedBusiness?.id === id) {
      const remaining = businesses.filter((b) => b.id !== id);
      setSelectedBusiness(remaining.length > 0 ? remaining[0] : null);
    }

    await loadBusinesses();
  };

  const getBusinessStats = async (
    businessId: string,
  ): Promise<BusinessStats> => {
    const response = await apiRequest(
      "GET",
      `/api/business/${businessId}/stats`,
    );
    const data = await response.json();

    return {
      pendingOrders: data.pendingOrders || 0,
      todayOrders: data.todayOrders || 0,
      todayRevenue: data.todayRevenue || 0,
    };
  };

  return (
    <BusinessContext.Provider
      value={{
        businesses,
        selectedBusiness,
        isLoading,
        selectBusiness,
        loadBusinesses,
        createBusiness,
        updateBusiness,
        deleteBusiness,
        getBusinessStats,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error("useBusiness must be used within a BusinessProvider");
  }
  return context;
}
