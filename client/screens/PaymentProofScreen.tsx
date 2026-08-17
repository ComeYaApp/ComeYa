import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Alert,
  Linking,
  Platform,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  ComeYaColors,
  Spacing,
  BorderRadius,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, "PaymentProof">;

const PAYMENT_INFO: Record<
  string,
  {
    title: string;
    icon: string;
    color: string;
    instructions: string[];
    fields: { label: string; value: string; copyable: boolean }[];
  }
> = {
  bizum: {
    title: "Pago con Bizum",
    icon: "smartphone",
    color: "#00ADEF",
    instructions: [
      "Abre tu app bancaria y selecciona Bizum",
      "Envía el importe exacto al número indicado",
      "Usa el número de pedido como concepto",
      "Sube la captura de pantalla del comprobante",
    ],
    fields: [
      { label: "Número Bizum", value: "600 000 000", copyable: true },
      { label: "Titular", value: "ComeYa S.L.", copyable: false },
    ],
  },
  sepa: {
    title: "Transferencia SEPA",
    icon: "credit-card",
    color: "#003087",
    instructions: [
      "Accede a tu banca online o app bancaria",
      "Realiza una transferencia al IBAN indicado",
      "Usa el número de pedido como concepto/referencia",
      "Las transferencias pueden tardar 1-2 días hábiles",
      "Sube el justificante de la transferencia",
    ],
    fields: [
      { label: "IBAN", value: "ES00 0000 0000 0000 0000 0000", copyable: true },
      { label: "Titular", value: "ComeYa S.L.", copyable: true },
      { label: "Banco", value: "Banco Santander", copyable: false },
    ],
  },
  paypal: {
    title: "Pago con PayPal",
    icon: "dollar-sign",
    color: "#003087",
    instructions: [
      "Abre PayPal y selecciona 'Enviar dinero'",
      "Envía el importe exacto al email indicado",
      "Usa el número de pedido como nota",
      "Sube la captura del comprobante de PayPal",
    ],
    fields: [
      { label: "Email PayPal", value: "pagos@comeya.es", copyable: true },
      { label: "Titular", value: "ComeYa S.L.", copyable: false },
    ],
  },
};

export default function PaymentProofScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { theme } = useTheme();
  const { showToast } = useToast();

  const { orderId, amount, paymentMethod, subscriptionId } = route.params;
  const amountEur = (amount / 100).toFixed(2);
  const shortId = subscriptionId
    ? subscriptionId.slice(-6).toUpperCase()
    : orderId.slice(-6).toUpperCase();

  const [paymentInfo, setPaymentInfo] = useState({
    bizum: "600 000 000",
    iban: "ES00 0000 0000 0000 0000 0000",
    paypalEmail: "pagos@comeya.es",
    titular: "ComeYa S.L.",
    banco: "Banco Santander",
  });

  useEffect(() => {
    apiRequest("GET", "/api/payments/info")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setPaymentInfo(d);
      })
      .catch(() => {});
  }, []);

  const config = React.useMemo(() => {
    const map: Record<string, any> = {
      bizum: {
        ...PAYMENT_INFO.bizum,
        fields: [
          {
            label: "N\u00famero Bizum",
            value: paymentInfo.bizum,
            copyable: true,
          },
          { label: "Titular", value: paymentInfo.titular, copyable: false },
        ],
      },
      sepa: {
        ...PAYMENT_INFO.sepa,
        fields: [
          { label: "IBAN", value: paymentInfo.iban, copyable: true },
          { label: "Titular", value: paymentInfo.titular, copyable: true },
          { label: "Banco", value: paymentInfo.banco, copyable: false },
        ],
      },
      paypal: {
        ...PAYMENT_INFO.paypal,
        fields: [
          {
            label: "Email PayPal",
            value: paymentInfo.paypalEmail,
            copyable: true,
          },
          { label: "Titular", value: paymentInfo.titular, copyable: false },
        ],
      },
    };
    return map[paymentMethod] || PAYMENT_INFO.bizum;
  }, [paymentMethod, paymentInfo]);

  const [proofImage, setProofImage] = useState<string | null>(null);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [senderName, setSenderName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [step, setStep] = useState<"instructions" | "upload" | "success">(
    "instructions",
  );

  const handleCopy = (text: string, label: string) => {
    try {
      require("react-native").Clipboard.setString(text);
    } catch {}
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast(`${label} copiado`, "success");
  };

  const handlePickImage = async () => {
    // En web usar input file nativo
    if (Platform.OS === "web") {
      const { pickAndUploadImage } = await import("@/utils/uploadImageWeb");
      const url = await pickAndUploadImage("comprobantes");
      if (url) {
        setProofImage(url);
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(",")[1];
            analyzeWithOCR(base64);
          };
          reader.readAsDataURL(blob);
        } catch {}
      }
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permiso requerido",
        "Necesitamos acceso a tu galería para subir el comprobante.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setProofImage(result.assets[0].uri);
      analyzeWithOCR(result.assets[0].base64 || "");
    }
  };

  const handleTakePhoto = async () => {
    // En web usar input file con capture
    if (Platform.OS === "web") {
      const { captureFromCamera } = await import("@/utils/uploadImageWeb");
      const url = await captureFromCamera("comprobantes");
      if (url) {
        setProofImage(url);
        // Obtener base64 para OCR
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(",")[1];
            analyzeWithOCR(base64);
          };
          reader.readAsDataURL(blob);
        } catch {}
      }
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso requerido", "Necesitamos acceso a tu cámara.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setProofImage(result.assets[0].uri);
      analyzeWithOCR(result.assets[0].base64 || "");
    }
  };

  const analyzeWithOCR = async (base64: string) => {
    if (!base64) return;
    setIsAnalyzing(true);
    try {
      const res = await apiRequest("POST", "/api/payments/analyze-proof", {
        imageBase64: base64,
        expectedAmount: amount,
        paymentMethod,
      });
      const data = await res.json();
      if (data.success && data.extracted) {
        setOcrResult(data.extracted);
        if (data.extracted.referenceNumber)
          setReferenceNumber(data.extracted.referenceNumber);
        if (data.extracted.senderName) setSenderName(data.extracted.senderName);
        showToast("✅ Comprobante analizado automáticamente", "success");
      }
    } catch {
      // OCR falla silenciosamente, el usuario puede rellenar manualmente
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    if (!proofImage) {
      showToast("Sube una foto del comprobante", "error");
      return;
    }
    if (!referenceNumber.trim()) {
      showToast("Ingresa el número de referencia", "error");
      return;
    }

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const formData = new FormData();
      formData.append("file", {
        uri: proofImage,
        type: "image/jpeg",
        name: `proof_${subscriptionId || orderId}.jpg`,
      } as any);

      const { getApiUrl, getAuthToken } = await import("@/lib/query-client");
      const token = await getAuthToken();
      const uploadRes = await fetch(
        `${getApiUrl()}/api/payments/upload-proof-image`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        },
      );
      const uploadData = await uploadRes.json();
      if (!uploadData.success)
        throw new Error(uploadData.error || "Error al subir imagen");
      const imageUrl = uploadData.url;

      if (subscriptionId) {
        // Flujo suscripción
        const res = await apiRequest(
          "POST",
          "/api/subscriptions/submit-proof",
          {
            subscriptionId,
            imageUrl,
            referenceNumber: referenceNumber.trim(),
            senderName: senderName.trim(),
            amount,
            paymentMethod,
          },
        );
        const data = await res.json();
        if (!data.success)
          throw new Error(data.error || "Error al enviar comprobante");
      } else {
        // Flujo pedido normal
        const res = await apiRequest("POST", "/api/payments/submit-proof", {
          orderId,
          imageUrl,
          referenceNumber: referenceNumber.trim(),
          senderName: senderName.trim(),
          amount,
          paymentMethod,
        });
        const data = await res.json();
        if (!data.success)
          throw new Error(data.error || "Error al enviar comprobante");
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("success");
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(error.message || "Error al enviar comprobante", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoToTracking = () => {
    navigation.reset({
      index: 0,
      routes: [
        { name: "Main" },
        { name: "OrderTracking", params: { orderId } },
      ],
    });
  };

  // STEP: SUCCESS
  if (step === "success") {
    const isSubscription = !!subscriptionId;
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      >
        <View style={[styles.successContainer]}>
          <View
            style={[
              styles.successIcon,
              { backgroundColor: ComeYaColors.success + "20" },
            ]}
          >
            <Feather
              name="check-circle"
              size={64}
              color={ComeYaColors.success}
            />
          </View>
          <ThemedText
            type="h2"
            style={{ textAlign: "center", marginTop: Spacing.xl }}
          >
            {isSubscription ? "¡Comprobante enviado!" : "¡Comprobante enviado!"}
          </ThemedText>
          <ThemedText
            type="body"
            style={{
              color: theme.textSecondary,
              textAlign: "center",
              marginTop: Spacing.md,
              lineHeight: 22,
            }}
          >
            {isSubscription
              ? "Hemos recibido tu comprobante. Tu suscripción se activará en cuanto nuestro equipo lo verifique (5-15 min)."
              : "Hemos recibido tu comprobante de pago. Nuestro equipo lo verificará en los próximos minutos y tu pedido será confirmado."}
          </ThemedText>
          <View
            style={[
              styles.infoBox,
              { backgroundColor: theme.card, marginTop: Spacing.xl },
            ]}
          >
            <Feather name="clock" size={18} color={ComeYaColors.warning} />
            <ThemedText
              type="small"
              style={{
                color: theme.textSecondary,
                marginLeft: Spacing.sm,
                flex: 1,
              }}
            >
              Tiempo de verificación: 5-15 minutos en horario laboral
            </ThemedText>
          </View>
          <Pressable
            onPress={() =>
              isSubscription
                ? navigation.navigate("Subscriptions")
                : handleGoToTracking()
            }
            style={[
              styles.primaryBtn,
              { backgroundColor: ComeYaColors.primary, marginTop: Spacing.xl },
            ]}
          >
            <Feather
              name={isSubscription ? "star" : "package"}
              size={20}
              color="#fff"
            />
            <ThemedText
              type="body"
              style={{
                color: "#fff",
                fontWeight: "700",
                marginLeft: Spacing.sm,
              }}
            >
              {isSubscription ? "Ver mi suscripción" : "Ver mi pedido"}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing.md,
            backgroundColor: theme.card,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">{config.title}</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Importe */}
        <View style={[styles.amountCard, { backgroundColor: config.color }]}>
          <ThemedText type="caption" style={{ color: "rgba(255,255,255,0.8)" }}>
            Importe a transferir
          </ThemedText>
          <ThemedText
            style={{ color: "#fff", fontSize: 48, fontWeight: "800" }}
          >
            {amountEur} €
          </ThemedText>
          <View style={styles.orderIdBadge}>
            <ThemedText
              type="caption"
              style={{ color: config.color, fontWeight: "700" }}
            >
              Pedido #{shortId}
            </ThemedText>
          </View>
        </View>

        {/* Datos de pago */}
        <View
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <View style={styles.sectionHeader}>
            <Feather name={config.icon as any} size={20} color={config.color} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              Datos de pago
            </ThemedText>
          </View>
          {config.fields.map((field, i) => (
            <View
              key={i}
              style={[
                styles.fieldRow,
                {
                  borderBottomColor: theme.border,
                  borderBottomWidth: i < config.fields.length - 1 ? 1 : 0,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  {field.label}
                </ThemedText>
                <ThemedText
                  type="body"
                  style={{ fontWeight: "700", marginTop: 2 }}
                >
                  {field.value}
                </ThemedText>
              </View>
              {field.copyable && (
                <Pressable
                  onPress={() => handleCopy(field.value, field.label)}
                  style={[
                    styles.copyBtn,
                    { backgroundColor: config.color + "15" },
                  ]}
                >
                  <Feather name="copy" size={16} color={config.color} />
                </Pressable>
              )}
            </View>
          ))}
          {/* Concepto */}
          <View
            style={[
              styles.fieldRow,
              {
                backgroundColor: ComeYaColors.warning + "15",
                borderRadius: BorderRadius.md,
                marginTop: Spacing.sm,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <ThemedText
                type="caption"
                style={{ color: ComeYaColors.warning }}
              >
                ⚠️ Concepto / Referencia
              </ThemedText>
              <ThemedText
                type="body"
                style={{ fontWeight: "800", marginTop: 2 }}
              >
                COMEYA-{shortId}
              </ThemedText>
            </View>
            <Pressable
              onPress={() => handleCopy(`COMEYA-${shortId}`, "Concepto")}
              style={[
                styles.copyBtn,
                { backgroundColor: ComeYaColors.warning + "20" },
              ]}
            >
              <Feather name="copy" size={16} color={ComeYaColors.warning} />
            </Pressable>
          </View>
        </View>

        {/* Instrucciones */}
        <View
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <View style={styles.sectionHeader}>
            <Feather name="list" size={20} color={ComeYaColors.primary} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              Cómo pagar
            </ThemedText>
          </View>
          {config.instructions.map((instruction, i) => (
            <View key={i} style={styles.instructionRow}>
              <View
                style={[
                  styles.stepBadge,
                  { backgroundColor: ComeYaColors.primary },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{ color: "#fff", fontWeight: "700", fontSize: 11 }}
                >
                  {i + 1}
                </ThemedText>
              </View>
              <ThemedText
                type="body"
                style={{
                  flex: 1,
                  marginLeft: Spacing.md,
                  color: theme.textSecondary,
                  lineHeight: 20,
                }}
              >
                {instruction}
              </ThemedText>
            </View>
          ))}
        </View>

        {/* Subir comprobante */}
        <View
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <View style={styles.sectionHeader}>
            <Feather name="upload" size={20} color={ComeYaColors.primary} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              Subir comprobante
            </ThemedText>
          </View>

          {!proofImage ? (
            <View style={styles.uploadButtons}>
              <Pressable
                onPress={handleTakePhoto}
                style={[
                  styles.uploadBtn,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Feather name="camera" size={28} color={ComeYaColors.primary} />
                <ThemedText
                  type="small"
                  style={{
                    color: theme.text,
                    marginTop: Spacing.xs,
                    fontWeight: "600",
                  }}
                >
                  Tomar foto
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={handlePickImage}
                style={[
                  styles.uploadBtn,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Feather name="image" size={28} color={ComeYaColors.primary} />
                <ThemedText
                  type="small"
                  style={{
                    color: theme.text,
                    marginTop: Spacing.xs,
                    fontWeight: "600",
                  }}
                >
                  Galería
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <View>
              <View style={styles.imagePreviewContainer}>
                <Image
                  source={{ uri: proofImage }}
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
                <Pressable
                  onPress={() => {
                    setProofImage(null);
                    setOcrResult(null);
                  }}
                  style={styles.removeImageBtn}
                >
                  <Feather name="x" size={16} color="#fff" />
                </Pressable>
                {isAnalyzing && (
                  <View style={styles.analyzingOverlay}>
                    <ActivityIndicator color="#fff" />
                    <ThemedText
                      type="caption"
                      style={{ color: "#fff", marginTop: 4 }}
                    >
                      Analizando...
                    </ThemedText>
                  </View>
                )}
              </View>
              {ocrResult && (
                <View
                  style={[
                    styles.ocrResult,
                    {
                      backgroundColor: ComeYaColors.success + "15",
                      borderColor: ComeYaColors.success,
                    },
                  ]}
                >
                  <Feather name="zap" size={16} color={ComeYaColors.success} />
                  <ThemedText
                    type="caption"
                    style={{
                      color: ComeYaColors.success,
                      marginLeft: Spacing.xs,
                      fontWeight: "600",
                    }}
                  >
                    Datos extraídos automáticamente con IA
                  </ThemedText>
                </View>
              )}
            </View>
          )}

          {/* Campos manuales */}
          <View style={{ marginTop: Spacing.lg }}>
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}
            >
              Número de referencia / localizador *
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: referenceNumber
                    ? ComeYaColors.primary
                    : theme.border,
                  color: theme.text,
                },
              ]}
              value={referenceNumber}
              onChangeText={setReferenceNumber}
              placeholder="Ej: 2024042112345678"
              placeholderTextColor={theme.textSecondary}
            />
            <ThemedText
              type="caption"
              style={{
                color: theme.textSecondary,
                marginBottom: Spacing.xs,
                marginTop: Spacing.md,
              }}
            >
              Nombre del titular que realiza el pago
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: senderName ? ComeYaColors.primary : theme.border,
                  color: theme.text,
                },
              ]}
              value={senderName}
              onChangeText={setSenderName}
              placeholder="Tu nombre completo"
              placeholderTextColor={theme.textSecondary}
            />
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.card,
            borderTopColor: theme.border,
            paddingBottom: insets.bottom + Spacing.md,
          },
        ]}
      >
        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting || !proofImage || !referenceNumber.trim()}
          style={[
            styles.primaryBtn,
            {
              backgroundColor:
                proofImage && referenceNumber.trim()
                  ? ComeYaColors.primary
                  : theme.border,
              opacity: isSubmitting ? 0.7 : 1,
            },
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="send" size={20} color="#fff" />
              <ThemedText
                type="body"
                style={{
                  color: "#fff",
                  fontWeight: "700",
                  marginLeft: Spacing.sm,
                }}
              >
                Enviar comprobante
              </ThemedText>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  amountCard: {
    margin: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
  },
  orderIdBadge: {
    backgroundColor: "#fff",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  section: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  copyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  instructionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  uploadButtons: { flexDirection: "row", gap: Spacing.md },
  uploadBtn: {
    flex: 1,
    height: 100,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePreviewContainer: {
    position: "relative",
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  imagePreview: { width: "100%", height: 200, borderRadius: BorderRadius.lg },
  removeImageBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  ocrResult: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
  },
  footer: { padding: Spacing.lg, borderTopWidth: 1 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    width: "100%",
  },
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
  },
});
