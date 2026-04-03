import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type VerifyEmailScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "VerifyEmail">;
};

export default function VerifyEmailScreen({
  navigation,
}: VerifyEmailScreenProps) {
  const { theme } = useTheme();
  const { verifyEmail, resendVerification, pendingVerificationEmail, user } =
    useAuth();
  const insets = useSafeAreaInsets();

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleCodeChange = (value: string, index: number) => {
    if (value.length > 1) {
      const digits = value.slice(0, 6 - index).split("");
      const newCode = [...code];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newCode[index + i] = digit;
        }
      });
      setCode(newCode);
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
    } else {
      const newCode = [...code];
      newCode[index] = value;
      setCode(newCode);
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
    setError("");
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setError("Ingresa el código completo");
      return;
    }

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await verifyEmail(fullCode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(error.message || "Código inválido o expirado");
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;

    setIsResending(true);
    try {
      await resendVerification();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCountdown(60);
      setError("");
    } catch (error) {
      setError("Error al reenviar el código");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + Spacing["3xl"],
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>

        <View style={styles.header}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: ComeYaColors.primaryLight },
            ]}
          >
            <Feather name="mail" size={40} color={ComeYaColors.primary} />
          </View>
          <ThemedText type="hero" style={styles.title}>
            Verifica tu email
          </ThemedText>
          <ThemedText
            type="body"
            style={{ color: theme.textSecondary, textAlign: "center" }}
          >
            Enviamos un código de 6 dígitos a{"\n"}
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              {pendingVerificationEmail || user?.email}
            </ThemedText>
          </ThemedText>
        </View>

        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[
                styles.codeInput,
                {
                  backgroundColor: theme.card,
                  borderColor: error
                    ? "#F44336"
                    : digit
                      ? ComeYaColors.primary
                      : theme.border,
                  color: theme.text,
                },
              ]}
              value={digit}
              onChangeText={(value) => handleCodeChange(value, index)}
              onKeyPress={({ nativeEvent }) =>
                handleKeyPress(nativeEvent.key, index)
              }
              keyboardType="number-pad"
              maxLength={6}
              selectTextOnFocus
              autoFocus={index === 0}
            />
          ))}
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={16} color="#F44336" />
            <ThemedText type="small" style={styles.errorText}>
              {error}
            </ThemedText>
          </View>
        ) : null}

        <Button
          onPress={handleVerify}
          disabled={isLoading}
          style={styles.verifyButton}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            "Verificar"
          )}
        </Button>

        <View style={styles.resendContainer}>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            ¿No recibiste el código?{" "}
          </ThemedText>
          {countdown > 0 ? (
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Reenviar en {countdown}s
            </ThemedText>
          ) : (
            <Pressable onPress={handleResend} disabled={isResending}>
              {isResending ? (
                <ActivityIndicator size="small" color={ComeYaColors.primary} />
              ) : (
                <ThemedText
                  type="body"
                  style={{ color: ComeYaColors.primary, fontWeight: "600" }}
                >
                  Reenviar
                </ThemedText>
              )}
            </Pressable>
          )}
        </View>

        <ThemedText
          type="caption"
          style={[styles.expiryNote, { color: theme.textSecondary }]}
        >
          El código expira en 10 minutos
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  codeContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "700",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  errorText: {
    color: "#F44336",
    marginLeft: Spacing.xs,
  },
  verifyButton: {
    marginBottom: Spacing.xl,
  },
  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  expiryNote: {
    textAlign: "center",
  },
});
