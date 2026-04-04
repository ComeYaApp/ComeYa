import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Image, TextInput, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";

const BANCOS = [
  { id: "banesco", name: "Banesco" },
  { id: "bdv", name: "Banco de Venezuela" },
  { id: "mercantil", name: "Mercantil" },
  { id: "provincial", name: "BBVA Provincial" },
  { id: "bicentenario", name: "Bicentenario" },
];

export default function PagoMovilPaymentScreen({ route }: any) {
  const { orderId, reference, amount, ComeYa } = route.params;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { showToast } = useToast();

  const [clientPhone, setClientPhone] = useState("");
  const [clientBank, setClientBank] = useState("banesco");
  const [pagoMovilCedula, setPagoMovilCedula] = useState("");
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);

  // Pre-llenar con cuenta guardada del cliente
  useEffect(() => {
    apiRequest("GET", "/api/payouts/accounts").then(async res => {
      const data = await res.json();
      const acc = data.accounts?.find((a: any) => a.method === "pago_movil");
      if (acc) {
        if (acc.pagoMovilPhone) setClientPhone(acc.pagoMovilPhone);
        if (acc.pagoMovilBank) setClientBank(acc.pagoMovilBank);
        if (acc.pagoMovilCedula) setPagoMovilCedula(acc.pagoMovilCedula);
      }
    }).catch(() => {});
  }, []);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setProofImage(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setIsOcrLoading(true);
      try {
        const formData = new FormData();
        
        // Convertir URI a Blob para web
        const response = await fetch(uri);
        const blob = await response.blob();
        const filename = uri.split("/").pop() || 'proof.jpg';
        
        formData.append("proof", blob, filename);
        
        // Obtener token de autenticación
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const token = await AsyncStorage.getItem('token');
        console.log('🔑 OCR Token:', token?.substring(0, 20) + '...');
        
        const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/digital-payments/ocr`, {
          method: "POST",
          body: formData,
          headers: { 
            "Authorization": `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (data.success && data.extracted) {
          if (data.extracted.phone) setClientPhone(data.extracted.phone);
          if (data.extracted.bank) {
            const bankMatch = BANCOS.find(b =>
              data.extracted.bank.toLowerCase().includes(b.id) ||
              b.name.toLowerCase().includes(data.extracted.bank.toLowerCase())
            );
            if (bankMatch) setClientBank(bankMatch.id);
          }
          if (data.extracted.phone || data.extracted.bank) {
            showToast("Datos extraídos del comprobante ✨", "success");
          }
        }
      } catch {
        // OCR falla silenciosamente
      } finally {
        setIsOcrLoading(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!clientPhone || clientPhone.length < 11) {
      showToast("Ingresa tu teléfono completo (11 dígitos)", "error");
      return;
    }

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const formData = new FormData();
      formData.append("reference", reference);
      formData.append("clientPhone", clientPhone);
      formData.append("clientBank", clientBank);
      formData.append("amount", String(amount));

      if (proofImage) {
        // Convertir URI a Blob para web
        const response = await fetch(proofImage);
        const blob = await response.blob();
        const filename = proofImage.split("/").pop() || 'proof.jpg';
        
        formData.append("proof", blob, filename);
      }

      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const token = await AsyncStorage.getItem('token');

      await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/pago-movil/submit/${orderId}`, {
        method: "POST",
        body: formData,
        headers: { 
          "Authorization": `Bearer ${token}`,
        },
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Comprobante enviado. Verificaremos tu pago pronto.", "success");

      const regretPeriodEndsAt = new Date(Date.now() + 60000).toISOString();

      navigation.reset({
        index: 0,
        routes: [
          { name: "Main" as never },
          { name: "OrderConfirmation" as never, params: { orderId, regretPeriodEndsAt } },
        ],
      });
    } catch (error) {
      console.error("Error submitting payment:", error);
      showToast("Error al enviar comprobante", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Pago Móvil</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.card, { backgroundColor: theme.card }, Shadows.md]}>
          <View style={styles.amountBox}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Monto a pagar
            </ThemedText>
            <ThemedText type="hero" style={{ color: ComeYaColors.primary }}>
              €{amount.toFixed(2)}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}>
          <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
            📱 Datos para transferir
          </ThemedText>
          <View style={styles.infoRow}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>Teléfono:</ThemedText>
            <ThemedText type="body" style={{ fontWeight: "600" }}>{ComeYa?.phone || 'N/A'}</ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>Banco:</ThemedText>
            <ThemedText type="body" style={{ fontWeight: "600" }}>{ComeYa?.bankName || 'N/A'}</ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>Cédula:</ThemedText>
            <ThemedText type="body" style={{ fontWeight: "600" }}>{ComeYa?.cedula || 'N/A'}</ThemedText>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>Referencia:</ThemedText>
            <ThemedText type="body" style={{ fontWeight: "700", color: ComeYaColors.primary }}>
              {reference}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}>
          <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
            Tus datos
          </ThemedText>
          
          <ThemedText type="small" style={{ marginBottom: Spacing.xs, fontWeight: "600" }}>
            Tu teléfono (origen)
          </ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
            value={clientPhone}
            onChangeText={setClientPhone}
            placeholder="04XX-XXX-XXXX"
            placeholderTextColor={theme.textSecondary}
            keyboardType="phone-pad"
            maxLength={15}
          />

          <ThemedText type="small" style={{ marginTop: Spacing.md, marginBottom: Spacing.xs, fontWeight: "600" }}>
            Tu banco
          </ThemedText>
          <View style={styles.bankGrid}>
            {BANCOS.map((banco) => (
              <Pressable
                key={banco.id}
                onPress={() => {
                  setClientBank(banco.id);
                  Haptics.selectionAsync();
                }}
                style={[
                  styles.bankChip,
                  {
                    backgroundColor: clientBank === banco.id ? ComeYaColors.primary : theme.backgroundSecondary,
                    borderColor: clientBank === banco.id ? ComeYaColors.primary : theme.border,
                  },
                ]}
              >
                <ThemedText
                  type="small"
                  style={{
                    color: clientBank === banco.id ? "#FFF" : theme.text,
                    fontWeight: clientBank === banco.id ? "600" : "400",
                  }}
                >
                  {banco.name}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <ThemedText type="small" style={{ marginTop: Spacing.md, marginBottom: Spacing.xs, fontWeight: "600" }}>
            Comprobante (opcional)
          </ThemedText>
          {proofImage ? (
            <View style={styles.imagePreview}>
              <Image source={{ uri: proofImage }} style={styles.image} />
              {isOcrLoading && (
                <View style={styles.ocrOverlay}>
                  <ActivityIndicator color="#FFF" />
                  <ThemedText type="small" style={{ color: "#FFF", marginTop: 4 }}>Leyendo comprobante...</ThemedText>
                </View>
              )}
              <Pressable onPress={() => setProofImage(null)} style={styles.removeImageButton}>
                <Feather name="x" size={20} color="#FFF" />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={handlePickImage} style={[styles.uploadButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
              <Feather name="camera" size={24} color={ComeYaColors.primary} />
              <ThemedText type="body" style={{ color: ComeYaColors.primary, marginTop: Spacing.xs }}>
                Subir foto del comprobante
              </ThemedText>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.card, paddingBottom: insets.bottom + Spacing.lg }]}>
        <Button onPress={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator color="#FFF" /> : "Confirmar pago"}
        </Button>
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
    paddingBottom: Spacing.lg,
  },
  backButton: { width: 44, height: 44, justifyContent: "center" },
  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing.lg },
  card: { padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  amountBox: { alignItems: "center", paddingVertical: Spacing.lg },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  input: {
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  bankGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  bankChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  uploadButton: {
    height: 120,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePreview: { position: "relative", height: 200, borderRadius: BorderRadius.md, overflow: "hidden" },
  image: { width: "100%", height: "100%", resizeMode: "cover" },
  ocrOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  removeImageButton: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  footer: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.1)" },
});
