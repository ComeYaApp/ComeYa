import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY = "@ComeYa_user";

const ROLE_SCREEN: Record<string, string> = {
  customer:        "MainTabs",
  business_owner:  "BusinessDashboard",
  delivery_driver: "DriverDashboard",
  admin:           "AdminDashboard",
  super_admin:     "AdminDashboard",
};

export default function AuthCallbackScreen() {
  const navigation  = useNavigation<any>();
  const { updateUser } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        // Leer params de la URL (web)
        const params = new URLSearchParams(window.location.search);
        const token   = params.get("token");
        const refresh = params.get("refresh");
        const role    = params.get("role");
        const name    = params.get("name") || "";

        if (!token || !role) {
          setError("Parámetros de autenticación inválidos.");
          return;
        }

        // Guardar en AsyncStorage con la misma estructura que usa AuthContext
        const userData = { token, refreshToken: refresh, role, name, phoneVerified: true, isActive: true };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        await AsyncStorage.setItem("token", token);
        if (refresh) await AsyncStorage.setItem("refreshToken", refresh);

        // Actualizar contexto
        await updateUser(userData as any);

        // Limpiar URL y navegar
        window.history.replaceState({}, "", "/");
        const screen = ROLE_SCREEN[role] || "MainTabs";
        navigation.reset({ index: 0, routes: [{ name: screen }] });
      } catch (e: any) {
        setError("Error al iniciar sesión. Inténtalo de nuevo.");
      }
    })();
  }, []);

  if (error) {
    return (
      <View style={s.root}>
        <Text style={s.error}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ActivityIndicator size="large" color="#DC2626" />
      <Text style={s.text}>Iniciando sesión...</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  text:  { marginTop: 16, fontSize: 15, color: "#666" },
  error: { fontSize: 15, color: "#DC2626", textAlign: "center", padding: 24 },
});
