import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

// Carga jsQR dinámicamente para decodificar QR desde el canvas
async function loadJsQR(): Promise<any> {
  if ((window as any).jsQR) return (window as any).jsQR;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
    script.onload = () => resolve((window as any).jsQR);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function QRScannerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanInterval = useRef<any>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [jsQR, setJsQR] = useState<any>(null);

  useEffect(() => {
    loadJsQR()
      .then(setJsQR)
      .catch(() => setHasPermission(false));
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setHasPermission(true);
    } catch {
      setHasPermission(false);
    }
  };

  const stopCamera = () => {
    clearInterval(scanInterval.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  // Escanear QR del frame del video
  useEffect(() => {
    if (!jsQR || !hasPermission) return;
    scanInterval.current = setInterval(() => {
      if (scanned || !videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        handleQRDetected(code.data);
      }
    }, 300);
    return () => clearInterval(scanInterval.current);
  }, [jsQR, hasPermission, scanned]);

  const handleQRDetected = async (data: string) => {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);
    stopCamera();

    try {
      const orderId = data;
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
          [{ text: "OK", onPress: () => navigation.goBack() }],
        );
      } else {
        throw new Error(result.message || "Error al completar pedido");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "No se pudo completar el pedido.", [
        {
          text: "Reintentar",
          onPress: () => {
            setScanned(false);
            setProcessing(false);
            startCamera();
          },
        },
        {
          text: "Cancelar",
          onPress: () => navigation.goBack(),
          style: "cancel",
        },
      ]);
    }
  };

  if (hasPermission === false) {
    return (
      <View
        style={[
          s.container,
          { backgroundColor: theme.backgroundRoot, paddingTop: insets.top },
        ]}
      >
        <Feather name="camera-off" size={64} color={theme.textSecondary} />
        <ThemedText
          type="h3"
          style={{ marginTop: Spacing.lg, textAlign: "center" }}
        >
          Sin acceso a la cámara
        </ThemedText>
        <ThemedText
          type="body"
          style={{
            marginTop: Spacing.sm,
            textAlign: "center",
            color: theme.textSecondary,
          }}
        >
          Permite el acceso a la cámara en tu navegador para escanear el QR.
        </ThemedText>
        <Pressable
          style={[s.btn, { backgroundColor: ComeYaColors.primary }]}
          onPress={() => navigation.goBack()}
        >
          <ThemedText style={{ color: "#fff", fontWeight: "600" }}>
            Volver
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Video de la cámara */}
      <video
        ref={videoRef}
        style={
          {
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          } as any
        }
        playsInline
        muted
      />
      {/* Canvas oculto para procesar frames */}
      <canvas ref={canvasRef} style={{ display: "none" } as any} />

      {/* Overlay */}
      <View style={s.overlay}>
        {/* Botón cerrar */}
        <Pressable
          style={[s.closeBtn, { top: insets.top + Spacing.md }]}
          onPress={() => {
            stopCamera();
            navigation.goBack();
          }}
        >
          <Feather name="x" size={24} color="#fff" />
        </Pressable>

        {/* Marco de escaneo */}
        <View style={s.scanFrame}>
          <View style={[s.corner, s.tl]} />
          <View style={[s.corner, s.tr]} />
          <View style={[s.corner, s.bl]} />
          <View style={[s.corner, s.br]} />
          {/* Línea animada */}
          {!processing && <View style={s.scanLine} />}
        </View>

        {/* Instrucciones */}
        <View style={s.instructions}>
          {processing ? (
            <>
              <ActivityIndicator size="large" color="#fff" />
              <ThemedText
                type="h4"
                style={{ color: "#fff", marginTop: Spacing.md }}
              >
                Procesando...
              </ThemedText>
            </>
          ) : (
            <>
              <ThemedText
                type="h3"
                style={{ color: "#fff", textAlign: "center" }}
              >
                Escanea el código QR
              </ThemedText>
              <ThemedText
                type="body"
                style={{
                  color: "rgba(255,255,255,0.8)",
                  textAlign: "center",
                  marginTop: Spacing.sm,
                }}
              >
                Apunta la cámara al código QR del pedido del cliente
              </ThemedText>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  } as any,
  closeBtn: {
    position: "absolute",
    right: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: 260,
    height: 260,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  corner: {
    position: "absolute",
    width: 44,
    height: 44,
    borderColor: ComeYaColors.primary,
  },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: BorderRadius.lg,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: BorderRadius.lg,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: BorderRadius.lg,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: BorderRadius.lg,
  },
  scanLine: {
    position: "absolute",
    left: 4,
    right: 4,
    height: 2,
    backgroundColor: ComeYaColors.primary,
    opacity: 0.8,
  },
  instructions: {
    position: "absolute",
    bottom: -120,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
  },
  btn: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
});
