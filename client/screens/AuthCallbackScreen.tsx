import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@ComeYa_user";

export default function AuthCallbackScreen() {
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const token = params.get("token");
        const refresh = params.get("refresh");
        const role = params.get("role");
        const name = params.get("name") || "";

        if (!token || !role) {
          setError("Parámetros de autenticación inválidos.");
          return;
        }

        // Guardar con la misma estructura que usa AuthContext.loadUser()
        const userData = {
          token,
          refreshToken: refresh,
          role,
          name,
          phoneVerified: true,
          isActive: true,
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        await AsyncStorage.setItem("token", token);
        if (refresh) await AsyncStorage.setItem("refreshToken", refresh);

        // Recargar la app limpiando los params de la URL
        // AuthContext.loadUser() se ejecutará de nuevo y detectará el usuario
        window.location.replace("/");
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
      <ActivityIndicator size="large" color="#E60000" />
      <Text style={s.text}>Iniciando sesión...</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  text: { marginTop: 16, fontSize: 15, color: "#666" },
  error: { fontSize: 15, color: "#E60000", textAlign: "center", padding: 24 },
});
