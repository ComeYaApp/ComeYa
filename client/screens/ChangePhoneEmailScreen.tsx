import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

export default function ChangePhoneEmailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [phone, setPhone] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phoneVerificationCode, setPhoneVerificationCode] = useState("");
  const [isPhoneVerifying, setIsPhoneVerifying] = useState(false);
  const [isPhoneChanging, setIsPhoneChanging] = useState(false);
  const [isEmailChanging, setIsEmailChanging] = useState(false);
  const [phoneStep, setPhoneStep] = useState<"input" | "verify">("input");

  React.useLayoutEffect(() => {
    navigation.setOptions({ headerTitle: "Cambiar teléfono / correo" });
  }, [navigation]);

  const handleSendPhoneVerification = async () => {
    if (!phone.trim() || phone.trim() === user?.phone) {
      showToast("Ingresa un nuevo número de teléfono", "error");
      return;
    }
    setIsPhoneVerifying(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await apiRequest("POST", "/api/users/change-phone", {
        newPhone: phone.trim(),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Error enviando código");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhoneStep("verify");
      showToast("Código enviado al nuevo teléfono", "success");
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(error.message || "No se pudo enviar código", "error");
    } finally {
      setIsPhoneVerifying(false);
    }
  };

  const handleVerifyPhoneChange = async () => {
    if (!phoneVerificationCode.trim()) {
      showToast("Ingresa el código de verificación", "error");
      return;
    }
    setIsPhoneChanging(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await apiRequest("POST", "/api/users/verify-phone-change", {
        newPhone: phone.trim(),
        code: phoneVerificationCode.trim(),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Código incorrecto");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Teléfono actualizado correctamente", "success");
      navigation.goBack();
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(error.message || "No se pudo cambiar teléfono", "error");
    } finally {
      setIsPhoneChanging(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!email.trim() || email.trim() === user?.email) {
      showToast("Ingresa un nuevo correo electrónico", "error");
      return;
    }
    setIsEmailChanging(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await apiRequest("PUT", "/api/users/profile", {
        email: email.trim(),
        name: user?.name,
        phone: user?.phone,
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Error al actualizar correo");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Correo actualizado correctamente", "success");
      navigation.goBack();
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(error.message || "No se pudo cambiar correo", "error");
    } finally {
      setIsEmailChanging(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Spacing.lg, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View
          style={[
            styles.headerSection,
            { backgroundColor: theme.card },
            Shadows.md,
          ]}
        >
          <Feather name="phone" size={24} color={ComeYaColors.primary} />
          <ThemedText type="h3" style={{ textAlign: "center", marginTop: Spacing.sm }}>
            Cambiar teléfono y correo
          </ThemedText>
          <ThemedText
            type="caption"
            style={{ color: theme.textSecondary, textAlign: "center" }}
          >
            Actualiza tu información de contacto
          </ThemedText>
        </View>

        {/* Phone Section */}
        <View
          style={[
            styles.formSection,
            { backgroundColor: theme.card },
            Shadows.sm,
          ]}
        >
          <View style={styles.sectionHeader}>
            <Feather name="phone" size={20} color={ComeYaColors.primary} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              Cambiar teléfono
            </ThemedText>
          </View>

          {phoneStep === "input" ? (
            <>
              <View style={styles.formRow}>
                <ThemedText type="body" style={{ fontWeight: "600", color: theme.text }}>
                  Nuevo teléfono
                </ThemedText>
                <View style={styles.inputContainer}>
                  <Feather name="phone" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[
                      styles.input,
                      { color: theme.text, backgroundColor: theme.backgroundSecondary },
                    ]}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+34 6XX XXX XXX"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                  />
                </View>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Te enviaremos un código de verificación al nuevo número
                </ThemedText>
              </View>
              <Button
                onPress={handleSendPhoneVerification}
                disabled={isPhoneVerifying || !phone.trim() || phone.trim() === user?.phone}
                loading={isPhoneVerifying}
                style={styles.saveButton}
              >
                Enviar código
              </Button>
            </>
          ) : (
            <>
              <View style={styles.formRow}>
                <ThemedText type="body" style={{ fontWeight: "600", color: theme.text }}>
                  Código de verificación
                </ThemedText>
                <View style={styles.inputContainer}>
                  <Feather name="lock" size={20} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.backgroundSecondary },
                ]}
                value={phoneVerificationCode}
                onChangeText={setPhoneVerificationCode}
                placeholder="Ingresa el código enviado"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                autoCapitalize="none"
              />
                </View>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Te hemos enviado un código SMS al {phone}
                </ThemedText>
              </View>
              <Button
                onPress={handleVerifyPhoneChange}
                disabled={isPhoneChanging || !phoneVerificationCode.trim()}
                loading={isPhoneChanging}
                style={styles.saveButton}
              >
                Confirmar cambio
              </Button>
              <Pressable
                onPress={() => setPhoneStep("input")}
                style={styles.backButton}
              >
                <ThemedText type="caption" style={{ color: ComeYaColors.primary }}>
                  Cambiar número
                </ThemedText>
              </Pressable>
            </>
          )}
        </View>

        {/* Email Section */}
        <View
          style={[
            styles.formSection,
            { backgroundColor: theme.card },
            Shadows.sm,
          ]}
        >
          <View style={styles.sectionHeader}>
            <Feather name="mail" size={20} color={ComeYaColors.primary} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              Cambiar correo electrónico
            </ThemedText>
          </View>

          <View style={styles.formRow}>
            <ThemedText type="body" style={{ fontWeight: "600", color: theme.text }}>
              Nuevo correo electrónico
            </ThemedText>
            <View style={styles.inputContainer}>
              <Feather name="mail" size={20} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.backgroundSecondary },
                ]}
                value={email}
                onChangeText={setEmail}
                placeholder="tu@email.com"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Usaremos este correo para comunicaciones importantes
            </ThemedText>
          </View>
          <Button
            onPress={handleChangeEmail}
            disabled={isEmailChanging || !email.trim() || email.trim() === user?.email}
            loading={isEmailChanging}
            style={styles.saveButton}
          >
            Cambiar correo
          </Button>
        </View>

        {/* Footer */}
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + Spacing.lg,
              backgroundColor: theme.backgroundSecondary,
              borderTopColor: theme.border,
            },
          ]}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            style={[
              styles.cancelButton,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Feather name="arrow-left" size={16} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginLeft: 4 }}>
              Cancelar
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg },
  headerSection: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  formSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  formRow: {
    marginBottom: Spacing.lg,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: ComeYaColors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: "white",
    marginTop: Spacing.sm,
  },
  inputIcon: {
    marginRight: Spacing.md,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.sm,
  },
  saveButton: {
    width: "100%",
    marginTop: Spacing.md,
  },
  backButton: {
    alignItems: "center",
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
});