import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Text,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/contexts/ToastContext";
import { apiRequest, getApiUrl, getAuthToken } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { WebLayout } from "@/components/WebLayout";

const PRIMARY = "#DC2626";
type Route = RouteProp<RootStackParamList, "PaymentProof">;

const METHOD_CONFIG: Record<
  string,
  {
    title: string;
    icon: string;
    color: string;
    instructions: string[];
    fields: { label: string; key: string; copyable: boolean }[];
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
      { label: "Número Bizum", key: "bizum", copyable: true },
      { label: "Titular", key: "titular", copyable: false },
    ],
  },
  sepa: {
    title: "Transferencia SEPA",
    icon: "credit-card",
    color: "#003087",
    instructions: [
      "Accede a tu banca online",
      "Realiza una transferencia al IBAN indicado",
      "Usa el número de pedido como concepto",
      "Las transferencias pueden tardar 1-2 días hábiles",
      "Sube el justificante",
    ],
    fields: [
      { label: "IBAN", key: "iban", copyable: true },
      { label: "Titular", key: "titular", copyable: true },
      { label: "Banco", key: "banco", copyable: false },
    ],
  },
  paypal: {
    title: "Pago con PayPal",
    icon: "dollar-sign",
    color: "#003087",
    instructions: [
      'Abre PayPal y selecciona "Enviar dinero"',
      "Envía el importe exacto al email indicado",
      "Usa el número de pedido como nota",
      "Sube la captura del comprobante",
    ],
    fields: [
      { label: "Email PayPal", key: "paypalEmail", copyable: true },
      { label: "Titular", key: "titular", copyable: false },
    ],
  },
};

export default function PaymentProofScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const { showToast } = useToast();

  const { orderId, amount, paymentMethod, subscriptionId } = route.params;
  const amountEur = (amount / 100).toFixed(2);
  const shortId = (subscriptionId || orderId).slice(-6).toUpperCase();

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const cardBg = isDark ? "#2a2a2a" : "#f9fafb";

  const cfg = METHOD_CONFIG[paymentMethod] || METHOD_CONFIG.bizum;

  const [payInfo, setPayInfo] = useState({
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
        if (d.success) setPayInfo(d);
      })
      .catch(() => {});
  }, []);

  const [proofImage, setProofImage] = useState<string | null>(null);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [senderName, setSenderName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [step, setStep] = useState<"main" | "success">("main");

  const handleCopy = (val: string, label: string) => {
    navigator.clipboard?.writeText(val).catch(() => {});
    showToast(`${label} copiado`, "success");
  };

  const handlePickImage = async () => {
    const { pickAndUploadImage } = await import("@/utils/uploadImageWeb");
    const url = await pickAndUploadImage("comprobantes");
    if (!url) return;
    setProofImage(url);
    setIsAnalyzing(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const r = await apiRequest("POST", "/api/payments/analyze-proof", {
          imageBase64: base64,
          expectedAmount: amount,
          paymentMethod,
        });
        const d = await r.json();
        if (d.success && d.extracted) {
          if (d.extracted.referenceNumber)
            setReferenceNumber(d.extracted.referenceNumber);
          if (d.extracted.senderName) setSenderName(d.extracted.senderName);
          setOcrDone(true);
          showToast("✅ Datos extraídos automáticamente", "success");
        }
      };
      reader.readAsDataURL(blob);
    } catch {
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
    try {
      const token = await getAuthToken();
      const formData = new FormData();
      const res = await fetch(proofImage);
      const blob = await res.blob();
      formData.append("file", blob, `proof_${orderId}.jpg`);
      const uploadRes = await fetch(
        `${getApiUrl()}/api/payments/upload-proof-image`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        },
      );
      const uploadData = await uploadRes.json();
      if (!uploadData.success) throw new Error(uploadData.error);
      // Include subscriptionId for subscription payments
      const submitData = subscriptionId
        ? {
            subscriptionId,
            imageUrl: uploadData.url,
            referenceNumber: referenceNumber.trim(),
            senderName: senderName.trim(),
            amount,
            paymentMethod,
          }
        : {
            orderId,
            imageUrl: uploadData.url,
            referenceNumber: referenceNumber.trim(),
            senderName: senderName.trim(),
            amount,
            paymentMethod,
          };

      const r = await apiRequest(
        "POST",
        subscriptionId
          ? "/api/subscriptions/submit-proof"
          : "/api/payments/submit-proof",
        submitData,
      );
      const d = await r.json();
      if (d.success) setStep("success");
      else throw new Error(d.error);
    } catch (e: any) {
      showToast(e.message || "Error al enviar comprobante", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "success") {
    return (
      <WebLayout>
        <View
          style={[
            s.root,
            {
              backgroundColor: bg,
              justifyContent: "center",
              alignItems: "center",
            },
          ]}
        >
          <View
            style={[
              s.successCard,
              { backgroundColor: card, borderColor: border },
            ]}
          >
            <View style={[s.successIcon, { backgroundColor: "#10B98120" }]}>
              <Feather name="check-circle" size={56} color="#10B981" />
            </View>
            <Text style={[s.successTitle, { color: text }]}>
              ¡Comprobante enviado!
            </Text>
            <Text style={[s.successSub, { color: sub }]}>
              Nuestro equipo lo verificará en los próximos minutos y tu pedido
              será confirmado.
            </Text>
            <View
              style={[
                s.infoBox,
                { backgroundColor: "#F59E0B15", borderColor: "#F59E0B30" },
              ]}
            >
              <Feather name="clock" size={16} color="#F59E0B" />
              <Text style={[s.infoBoxText, { color: sub }]}>
                Tiempo de verificación: 5-15 minutos en horario laboral
              </Text>
            </View>
            <Pressable
              onPress={() =>
                navigation.reset({
                  index: 0,
                  routes: [
                    { name: "Main" },
                    { name: "OrderTracking", params: { orderId } },
                  ],
                })
              }
              style={[s.primaryBtn, { backgroundColor: PRIMARY }]}
            >
              <Feather name="package" size={18} color="#fff" />
              <Text style={s.primaryBtnText}>Ver mi pedido</Text>
            </Pressable>
          </View>
        </View>
      </WebLayout>
    );
  }

  return (
    <WebLayout>
      <View style={[s.root, { backgroundColor: bg }]}>
        {/* Header */}
        <View
          style={[
            s.header,
            { backgroundColor: card, borderBottomColor: border },
          ]}
        >
          <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
            <Feather name="arrow-left" size={22} color={text} />
          </Pressable>
          <Text style={[s.headerTitle, { color: text }]}>{cfg.title}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={s.layout}>
          {/* Columna izquierda: instrucciones */}
          <ScrollView
            style={[s.leftCol, { borderRightColor: border }]}
            contentContainerStyle={s.leftContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Importe */}
            <View style={[s.amountCard, { backgroundColor: cfg.color }]}>
              <Text style={s.amountLabel}>Importe a transferir</Text>
              <Text style={s.amountValue}>€{amountEur}</Text>
              <View style={s.orderBadge}>
                <Text style={[s.orderBadgeText, { color: cfg.color }]}>
                  Pedido #{shortId}
                </Text>
              </View>
            </View>

            {/* Datos de pago */}
            <View
              style={[s.card, { backgroundColor: card, borderColor: border }]}
            >
              <View style={s.cardHeader}>
                <Feather name={cfg.icon as any} size={18} color={cfg.color} />
                <Text style={[s.cardTitle, { color: text }]}>
                  Datos de pago
                </Text>
              </View>
              {cfg.fields.map((f, i) => (
                <View
                  key={i}
                  style={[
                    s.fieldRow,
                    {
                      borderBottomColor: border,
                      borderBottomWidth: i < cfg.fields.length - 1 ? 1 : 0,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.fieldLabel, { color: sub }]}>
                      {f.label}
                    </Text>
                    <Text style={[s.fieldValue, { color: text }]}>
                      {(payInfo as any)[f.key] || "—"}
                    </Text>
                  </View>
                  {f.copyable && (
                    <Pressable
                      onPress={() =>
                        handleCopy((payInfo as any)[f.key], f.label)
                      }
                      style={[s.copyBtn, { backgroundColor: cfg.color + "15" }]}
                    >
                      <Feather name="copy" size={15} color={cfg.color} />
                    </Pressable>
                  )}
                </View>
              ))}
              <View
                style={[
                  s.fieldRow,
                  {
                    backgroundColor: "#F59E0B15",
                    borderRadius: 8,
                    marginTop: 8,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#F59E0B", fontSize: 12 }}>
                    ⚠️ Concepto / Referencia
                  </Text>
                  <Text style={[s.fieldValue, { color: text }]}>
                    COMEYA-{shortId}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleCopy(`COMEYA-${shortId}`, "Concepto")}
                  style={[s.copyBtn, { backgroundColor: "#F59E0B20" }]}
                >
                  <Feather name="copy" size={15} color="#F59E0B" />
                </Pressable>
              </View>
            </View>

            {/* Instrucciones */}
            <View
              style={[s.card, { backgroundColor: card, borderColor: border }]}
            >
              <View style={s.cardHeader}>
                <Feather name="list" size={18} color={PRIMARY} />
                <Text style={[s.cardTitle, { color: text }]}>Cómo pagar</Text>
              </View>
              {cfg.instructions.map((inst, i) => (
                <View key={i} style={s.instrRow}>
                  <View style={[s.stepBadge, { backgroundColor: PRIMARY }]}>
                    <Text style={s.stepNum}>{i + 1}</Text>
                  </View>
                  <Text style={[s.instrText, { color: sub }]}>{inst}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Columna derecha: upload */}
          <ScrollView
            style={s.rightCol}
            contentContainerStyle={s.rightContent}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[s.card, { backgroundColor: card, borderColor: border }]}
            >
              <View style={s.cardHeader}>
                <Feather name="upload" size={18} color={PRIMARY} />
                <Text style={[s.cardTitle, { color: text }]}>
                  Subir comprobante
                </Text>
              </View>

              {!proofImage ? (
                <Pressable
                  onPress={handlePickImage}
                  style={[
                    s.uploadArea,
                    { borderColor: border, backgroundColor: cardBg },
                  ]}
                >
                  <Feather name="image" size={36} color={sub} />
                  <Text style={[s.uploadText, { color: sub }]}>
                    Haz clic para seleccionar imagen
                  </Text>
                  <Text style={[s.uploadHint, { color: sub }]}>
                    JPG, PNG — máx. 10MB
                  </Text>
                </Pressable>
              ) : (
                <View style={s.previewWrap}>
                  <Image
                    source={{ uri: proofImage }}
                    style={s.preview}
                    contentFit="cover"
                  />
                  <Pressable
                    onPress={() => {
                      setProofImage(null);
                      setOcrDone(false);
                    }}
                    style={s.removePreview}
                  >
                    <Feather name="x" size={14} color="#fff" />
                  </Pressable>
                  {isAnalyzing && (
                    <View style={s.analyzingOverlay}>
                      <ActivityIndicator color="#fff" />
                      <Text
                        style={{ color: "#fff", marginTop: 6, fontSize: 13 }}
                      >
                        Analizando con IA...
                      </Text>
                    </View>
                  )}
                  {ocrDone && (
                    <View
                      style={[
                        s.ocrBadge,
                        {
                          backgroundColor: "#10B98115",
                          borderColor: "#10B98130",
                        },
                      ]}
                    >
                      <Feather name="zap" size={13} color="#10B981" />
                      <Text
                        style={{
                          color: "#10B981",
                          fontSize: 12,
                          fontWeight: "600",
                          marginLeft: 4,
                        }}
                      >
                        Datos extraídos automáticamente
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View style={{ marginTop: 20, gap: 12 }}>
                <View>
                  <Text style={[s.inputLabel, { color: sub }]}>
                    Número de referencia / localizador *
                  </Text>
                  <TextInput
                    value={referenceNumber}
                    onChangeText={setReferenceNumber}
                    placeholder="Ej: 2024042112345678"
                    placeholderTextColor={sub}
                    style={[
                      s.input,
                      {
                        backgroundColor: cardBg,
                        borderColor: referenceNumber ? PRIMARY : border,
                        color: text,
                      },
                    ]}
                  />
                </View>
                <View>
                  <Text style={[s.inputLabel, { color: sub }]}>
                    Nombre del titular que realiza el pago
                  </Text>
                  <TextInput
                    value={senderName}
                    onChangeText={setSenderName}
                    placeholder="Tu nombre completo"
                    placeholderTextColor={sub}
                    style={[
                      s.input,
                      {
                        backgroundColor: cardBg,
                        borderColor: senderName ? PRIMARY : border,
                        color: text,
                      },
                    ]}
                  />
                </View>
              </View>

              <Pressable
                onPress={handleSubmit}
                disabled={
                  isSubmitting || !proofImage || !referenceNumber.trim()
                }
                style={[
                  s.primaryBtn,
                  {
                    backgroundColor:
                      proofImage && referenceNumber.trim() ? PRIMARY : border,
                    marginTop: 20,
                    opacity: isSubmitting ? 0.7 : 1,
                  },
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="send" size={18} color="#fff" />
                    <Text style={s.primaryBtnText}>Enviar comprobante</Text>
                  </>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </WebLayout>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  layout: { flex: 1, flexDirection: "row" },
  leftCol: { flex: 1, borderRightWidth: 1 },
  leftContent: { padding: 28, paddingBottom: 60 },
  rightCol: { width: 420 },
  rightContent: { padding: 28, paddingBottom: 60 },
  amountCard: {
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    marginBottom: 20,
  },
  amountLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    marginBottom: 6,
  },
  amountValue: { color: "#fff", fontSize: 48, fontWeight: "800" },
  orderBadge: {
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 12,
  },
  orderBadgeText: { fontSize: 13, fontWeight: "700" },
  card: { borderRadius: 14, borderWidth: 1, padding: 18, marginBottom: 16 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  fieldRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  fieldLabel: { fontSize: 12, marginBottom: 2 },
  fieldValue: { fontSize: 15, fontWeight: "700" },
  copyBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  instrRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  stepNum: { color: "#fff", fontSize: 12, fontWeight: "700" },
  instrText: { flex: 1, fontSize: 14, lineHeight: 20 },
  uploadArea: {
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed" as any,
    padding: 40,
    alignItems: "center",
    gap: 8,
  },
  uploadText: { fontSize: 15, fontWeight: "600" },
  uploadHint: { fontSize: 12 },
  previewWrap: {
    position: "relative" as any,
    borderRadius: 12,
    overflow: "hidden" as any,
  },
  preview: { width: "100%", height: 220, borderRadius: 12 },
  removePreview: {
    position: "absolute" as any,
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
  ocrBadge: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  inputLabel: { fontSize: 12, marginBottom: 6 },
  input: {
    height: 46,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginVertical: 16,
  },
  infoBoxText: { flex: 1, fontSize: 13 },
  successCard: {
    width: 440,
    borderRadius: 20,
    borderWidth: 1,
    padding: 36,
    alignItems: "center",
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  successTitle: { fontSize: 24, fontWeight: "800", marginBottom: 10 },
  successSub: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
  },
});
