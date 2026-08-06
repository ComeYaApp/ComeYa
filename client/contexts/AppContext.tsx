import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "system" | "light" | "dark";

interface AppSettings {
  carnivalEnabled: boolean;
  notificationsEnabled: boolean;
  themeMode: ThemeMode;
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
