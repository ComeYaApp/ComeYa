import React, { useState, useEffect } from "react";
import { displayOrderNumber } from "@/utils/orderNumber";
import { View, StyleSheet, Alert, Pressable, TextInput } from "react-native";
import { CameraView, Camera } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

export default function PickupScannerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const [mode, setMode] = useState<"scan" | "manual">("scan");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  const finishPickup = async (orderId: string, pickupCode: string | null) => {
    try {
      if (pickupCode) {
        const validateRes = await apiRequest(
          "POST",
          `/api/pickup/${orderId}/validate-code`,
          { code: pickupCode },
        );
        const validateData = await validateRes.json();
        if (!validateData.valid) {
          throw new Error("El código del QR no coincide con este pedido");
        }
      }
      await apiRequest("POST", `/api/orders/${orderId}/mark-picked-up`, {
        code: pickupCode,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("🎉 ¡Listo!", "Pedido marcado como recogido", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
      return true;
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "No se pudo confirmar la entrega",
      );
      return false;
    }
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      // El QR del cliente de recogida es un JSON: {orderId, pickupCode, type}
      let orderId: string | null = null;
      let pickupCode: string | null = null;
      try {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === "object" && parsed.orderId) {
          orderId = parsed.orderId;
          pickupCode = parsed.pickupCode || null;
        }
      } catch {
        // QR con contenido plano: no es un QR de recogida válido
      }

      if (!orderId || !pickupCode) {
        throw new Error(
          "QR no válido para recogida. Pide al cliente el código de 6 dígitos.",
        );
      }

      const ok = await finishPickup(orderId, pickupCode);
      if (!ok) {
        setScanned(false);
        setProcessing(false);
      }
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "No se pudo procesar el QR",
        [{ text: "Reintentar", onPress: () => setScanned(false) }],
      );
      setProcessing(false);
    }
  };

  const validateCode = async () => {
    if (code.length !== 6) {
      Alert.alert("Error", "El código debe tener 6 dígitos");
      return;
    }

    setLoading(true);
    try {
      // Buscar pedido por código
      const response = await apiRequest("GET", "/api/business/orders");
      const data = await response.json();

      if (data.success) {
        const order = data.orders.find((o: any) => o.pickupCode === code);

        if (!order) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(
            "❌ Código inválido",
            "No se encontró ningún pedido con este código",
          );
          return;
        }

        if (!["ready", "on_the_way", "picked_up"].includes(order.status)) {
          Alert.alert(
            "⚠️ Pedido no listo",
            "Este pedido aún no está listo para recoger",
          );
          return;
        }

        // Confirmar entrega
        Alert.alert(
          "✅ Código válido",
          `Pedido #${order.id.slice(-6)}\nCliente: ${order.customer?.name || "N/A"}\n\n¿Confirmar entrega?`,
          [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Confirmar",
              onPress: async () => {
                try {
                  await apiRequest(
                    "POST",
                    `/api/orders/${order.id}/mark-picked-up`,
                    { code },
                  );
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success,
                  );
                  Alert.alert("🎉 ¡Listo!", "Pedido marcado como recogido");
                  setCode("");
                  navigation.goBack();
                } catch (error) {
                  Alert.alert("Error", "No se pudo confirmar la entrega");
                }
              },
            },
          ],
        );
      }
    } catch (error) {
      Alert.alert("Error", "No se pudo validar el código");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Escanear Código</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      {/* Selector de modo: escanear QR o ingresar código */}
      <View style={styles.modeSelector}>
        {(
          [
            { key: "scan", label: "Escanear QR", icon: "camera" },
            { key: "manual", label: "Código", icon: "hash" },
          ] as const
        ).map((m) => {
          const active = mode === m.key;
          return (
            <Pressable
              key={m.key}
              onPress={() => {
                setMode(m.key);
                setScanned(false);
              }}
              style={[
                styles.modeButton,
                {
                  backgroundColor: active
                    ? ComeYaColors.primary
                    : theme.backgroundSecondary,
                },
              ]}
            >
              <Feather
                name={m.icon}
                size={16}
                color={active ? "#FFF" : theme.text}
              />
              <ThemedText
                type="small"
                style={{
                  color: active ? "#FFF" : theme.text,
                  marginLeft: Spacing.xs,
                  fontWeight: "600",
                }}
              >
                {m.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {mode === "scan" ? (
        <View style={styles.scanContainer}>
          {hasPermission === null ? (
            <View style={styles.scanFallback}>
              <ThemedText type="body">
                Solicitando permiso de cámara...
              </ThemedText>
            </View>
          ) : hasPermission === false ? (
            <View style={styles.scanFallback}>
              <Feather name="camera-off" size={64} color={theme.textSecondary} />
              <ThemedText
                type="h3"
                style={{ marginTop: Spacing.lg, textAlign: "center" }}
              >
                Sin acceso a la cámara
              </ThemedText>
              <ThemedText
                style={{
                  marginTop: Spacing.sm,
                  textAlign: "center",
                  color: theme.textSecondary,
                }}
              >
                Habilita el permiso de cámara o usa el código de 6 dígitos.
              </ThemedText>
              <Pressable
                style={[
                  styles.switchModeButton,
                  { backgroundColor: ComeYaColors.primary },
                ]}
                onPress={() => setMode("manual")}
              >
                <ThemedText style={{ color: "#FFF", fontWeight: "600" }}>
                  Ingresar código manualmente
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <CameraView
              style={styles.camera}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            >
              <View style={styles.overlay}>
                <View style={styles.scanArea}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                </View>

                <View style={styles.instructions}>
                  <ThemedText
                    type="h3"
                    style={{ color: "#FFF", textAlign: "center" }}
                  >
                    Escanea el QR del cliente
                  </ThemedText>
                  <ThemedText
                    style={{
                      color: "rgba(255,255,255,0.8)",
                      textAlign: "center",
                      marginTop: Spacing.sm,
                    }}
                  >
                    El cliente lo tiene en el seguimiento de su pedido
                  </ThemedText>
                </View>

                {processing && (
                  <View style={styles.processingOverlay}>
                    <ThemedText type="h3" style={{ color: "#FFF" }}>
                      Procesando...
                    </ThemedText>
                  </View>
                )}
              </View>
            </CameraView>
          )}
        </View>
      ) : (
        <View style={styles.content}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: ComeYaColors.primary + "20" },
            ]}
          >
            <Feather name="hash" size={64} color={ComeYaColors.primary} />
          </View>

          <ThemedText
            type="h3"
            style={{ textAlign: "center", marginTop: Spacing.xl }}
          >
            Ingresa el código de recogida
          </ThemedText>

          <ThemedText
            type="body"
            style={{
              color: theme.textSecondary,
              textAlign: "center",
              marginTop: Spacing.sm,
            }}
          >
            El cliente te mostrará un código de 6 dígitos
          </ThemedText>

          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="000000"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            maxLength={6}
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundSecondary,
                color: theme.text,
                borderColor:
                  code.length === 6 ? ComeYaColors.success : theme.border,
              },
            ]}
            autoFocus
          />

          <Button
            onPress={validateCode}
            disabled={code.length !== 6 || loading}
            style={{ marginTop: Spacing.xl }}
          >
            {loading ? "Validando..." : "Validar Código"}
          </Button>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  modeSelector: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  modeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  scanContainer: {
    flex: 1,
  },
  scanFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  switchModeButton: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  camera: {
    flex: 1,
    width: "100%",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  scanArea: {
    width: 250,
    height: 250,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderColor: ComeYaColors.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: BorderRadius.lg,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: BorderRadius.lg,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: BorderRadius.lg,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: BorderRadius.lg,
  },
  instructions: {
    position: "absolute",
    bottom: 100,
    paddingHorizontal: Spacing.xl,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    width: "100%",
    fontSize: 32,
    fontFamily: "monospace",
    textAlign: "center",
    letterSpacing: 8,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    marginTop: Spacing.xl,
  },
});
