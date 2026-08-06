import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "system" | "light" | "dark";

interface DeliveryFeesConfig {
  tier1: number; // 0-2 km
  tier2: number; // 2-3 km
  tier3: number; // 3-4 km
  extraPerKm: number; // > 4 km
}

interface AppSettings {
  carnivalEnabled: boolean;
  notificationsEnabled: boolean;
  themeMode: ThemeMode;
  // Configuraciones desde admin panel
  commission: number; // Porcentaje de comisión (ej: 15)
  deliveryFees: DeliveryFeesConfig;
  minimumOrder: number; // Pedido mínimo en euros
  serviceFee: number; // Tarifa de servicio en euros
  deliveryZone: {
    name: string;
    radius: number;
    baseFee: number;
    active: boolean;
  } | null;
}

interface AppContextType {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const SETTINGS_KEY = "@ComeYa_settings";

const defaultSettings: AppSettings = {
  carnivalEnabled: true,
  notificationsEnabled: false,
  themeMode: "system",
  commission: 15,
  deliveryFees: {
    tier1: 2.5,
    tier2: 4.0,
    tier3: 5.0,
    extraPerKm: 1.0,
  },
  minimumOrder: 5,
  serviceFee: 1,
  deliveryZone: {
    name: "Soria",
    radius: 8,
    baseFee: 2.5,
    active: true,
  },
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        setSettings({ ...defaultSettings, ...JSON.parse(stored) });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const updateSettings = async (updates: Partial<AppSettings>) => {
    const updated = { ...settings, ...updates };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    setSettings(updated);
  };

  const setThemeMode = async (mode: ThemeMode) => {
    await updateSettings({ themeMode: mode });
  };

  return (
    <AppContext.Provider
      value={{
        settings,
        updateSettings,
        themeMode: settings.themeMode,
        setThemeMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}

export function useAppSafe() {
  const context = useContext(AppContext);
  return context;
}
