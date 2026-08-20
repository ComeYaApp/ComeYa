import React, { useState, useEffect } from "react";
import { View, StyleSheet, Alert, Pressable } from "react-native";
import { CameraView, Camera } from "expo-camera";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";

export default function QRScannerScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || processing) return;

    setScanned(true);
    setProcessing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      // El QR del cliente de recogida es un JSON: {orderId, pickupCode, type}
      let orderId = data;
      let pickupCode: string | null = null;
      try {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === "object" && parsed.orderId) {
          orderId = parsed.orderId;
          pickupCode = parsed.pickupCode || null;
        }
      } catch {
        // QR con orderId pelado: flujo anterior
      }

      if (pickupCode) {
        // Verificar el código de recogida de 6 dígitos contra el pedido
        const validateRes = await apiRequest(
          "POST",
          `/api/pickup/${orderId}/validate-code`,
          { code: pickupCode },
        );
        const validateData = await validateRes.json();
        if (!validateData.valid) {
          throw new Error("El código del QR no coincide con este pedido");
        }
        // Marcar como recogido (entrega en local completada)
        await apiRequest("POST", `/api/orders/${orderId}/mark-picked-up`, {
          code: pickupCode,
        });
        Alert.alert(
          "✅ Pedido recogido",
          `El pedido #${String(orderId).slice(-6)} ha sido entregado al cliente.`,
          [{ text: "OK", onPress: () => navigation.goBack() }],
        );
        return;
      }

      // Marcar pedido como entregado (QR con orderId directo)
      const response = await apiRequest(
        "PUT",
        `/api/orders/${orderId}/complete`,
        {},
      );
      const result = await response.json();

      if (result.success) {
        Alert.alert(
          "✅ Pedido Completado",
          `El pedido #${orderId.slice(-6)} ha sido marcado como entregado.`,
          [
            {
              text: "OK",
              onPress: () => navigation.goBack(),
            },
          ],
        );
      } else {
        throw new Error(result.message || "Error al completar pedido");
      }
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message ||
          "No se pudo completar el pedido. Verifica el código QR.",
        [
          {
            text: "Reintentar",
            onPress: () => {
              setScanned(false);
              setProcessing(false);
            },
          },
          {
            text: "Cancelar",
            onPress: () => navigation.goBack(),
            style: "cancel",
          },
        ],
      );
    }
  };

  if (hasPermission === null) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ThemedText>Solicitando permiso de cámara...</ThemedText>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
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
          Necesitas habilitar el permiso de cámara en la configuración de tu
          dispositivo.
        </ThemedText>
        <Pressable
          style={[styles.button, { backgroundColor: ComeYaColors.primary }]}
          onPress={() => navigation.goBack()}
        >
          <ThemedText style={{ color: "#FFF", fontWeight: "600" }}>
            Volver
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      >
        <View style={styles.overlay}>
          <Pressable
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <Feather name="x" size={24} color="#FFF" />
          </Pressable>

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
              Escanea el código QR
            </ThemedText>
            <ThemedText
              style={{
                color: "rgba(255,255,255,0.8)",
                textAlign: "center",
                marginTop: Spacing.sm,
              }}
            >
              Apunta la cámara al código QR del pedido del cliente
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
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
  button: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
});
