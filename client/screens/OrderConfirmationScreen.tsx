import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";

type OrderConfirmationRouteProp = RouteProp<
  RootStackParamList,
  "OrderConfirmation"
>;
type OrderConfirmationNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "OrderConfirmation"
>;

export default function OrderConfirmationScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<OrderConfirmationNavigationProp>();
  const route = useRoute<OrderConfirmationRouteProp>();
  const { theme } = useTheme();
  const { showToast } = useToast();

  const { orderId, regretPeriodEndsAt } = route.params || {};

  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Redirect if no orderId
  React.useEffect(() => {
    if (!orderId) {
      console.error("No orderId provided to OrderConfirmationScreen");
      navigation.navigate("Main");
    }
  }, [orderId, navigation]);

  if (!orderId) {
    return null;
  }

  const pulseScale = useSharedValue(1);
  const progressWidth = useSharedValue(100);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, []);

  useEffect(() => {
    const endTime = new Date(regretPeriodEndsAt).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
      setSecondsRemaining(remaining);
      progressWidth.value = withTiming((remaining / 60) * 100, {
        duration: 1000,
      });

      if (remaining <= 0 && !isConfirmed) {
        confirmOrder();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [regretPeriodEndsAt, isConfirmed]);

  const confirmOrder = useCallback(async () => {
    if (isConfirmed) return;

    if (!orderId) {
      console.error("OrderId is undefined");
      showToast("Error: ID de pedido no válido", "error");
      return;
    }

    setIsConfirmed(true);

    try {
      await apiRequest("POST", `/api/orders/${orderId}/confirm`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Pedido confirmado y enviado al restaurante", "success");

      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [
            { name: "Main" },
            { name: "OrderTracking", params: { orderId } },
          ],
        });
      }, 1500);
    } catch (error) {
      console.error("Error confirming order:", error);
      setIsConfirmed(false);
    }
  }, [orderId, isConfirmed, navigation, showToast]);

  const handleCancelOrder = async () => {
    setIsCancelling(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      await apiRequest("POST", `/api/orders/${orderId}/cancel-regret`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Pedido cancelado sin penalización", "success");

      navigation.reset({
        index: 0,
        routes: [{ name: "Main" }],
      });
    } catch (error: any) {
      console.error("Error cancelling order:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast("No se pudo cancelar el pedido", "error");
      setIsCancelling(false);
    }
  };

  const handleSkipAndConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    confirmOrder();
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[styles.content, { paddingTop: insets.top + Spacing["3xl"] }]}
      >
        <Animated.View style={[styles.iconContainer, pulseStyle]}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: ComeYaColors.primary + "20" },
            ]}
          >
            <Feather name="check" size={48} color={ComeYaColors.primary} />
          </View>
        </Animated.View>

        <ThemedText type="h1" style={styles.title}>
          {isConfirmed ? "Pedido Confirmado" : "Pedido Recibido"}
        </ThemedText>

        {!isConfirmed ? (
          <>
            <ThemedText
              type="body"
              style={[styles.subtitle, { color: theme.textSecondary }]}
            >
              Tienes {secondsRemaining} segundos para cancelar sin penalización
            </ThemedText>

            <View
              style={[
                styles.timerCard,
                { backgroundColor: theme.card },
                Shadows.md,
              ]}
            >
              <View style={styles.timerHeader}>
                <Feather name="clock" size={20} color={ComeYaColors.primary} />
                <ThemedText
                  type="body"
                  style={{ marginLeft: Spacing.sm, fontWeight: "600" }}
                >
                  Tiempo de arrepentimiento
                </ThemedText>
              </View>

              <View style={styles.timerDisplay}>
                <ThemedText
                  type="h1"
                  style={{ color: ComeYaColors.primary, fontSize: 64 }}
                >
                  {secondsRemaining}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  segundos
                </ThemedText>
              </View>

              <View style={styles.progressBar}>
                <Animated.View style={[styles.progressFill, progressStyle]} />
              </View>

              <ThemedText
                type="caption"
                style={{
                  color: theme.textSecondary,
                  textAlign: "center",
                  marginTop: Spacing.md,
                }}
              >
                El restaurante aún no ha sido notificado. Puedes cancelar sin
                costo.
              </ThemedText>
            </View>

            <View style={styles.actions}>
              <Button
                variant="secondary"
                onPress={handleCancelOrder}
                disabled={isCancelling}
                style={styles.cancelButton}
              >
                {isCancelling ? (
                  <ActivityIndicator color={ComeYaColors.error} size="small" />
                ) : (
                  <>
                    <Feather name="x" size={20} color={ComeYaColors.error} />
                    <ThemedText
                      type="body"
                      style={{
                        color: ComeYaColors.error,
                        marginLeft: Spacing.sm,
                        fontWeight: "600",
                      }}
                    >
                      Cancelar ahora
                    </ThemedText>
                  </>
                )}
              </Button>

              <Pressable
                onPress={handleSkipAndConfirm}
                style={styles.skipButton}
              >
                <ThemedText
                  type="small"
                  style={{ color: ComeYaColors.primary }}
                >
                  Saltar y confirmar pedido
                </ThemedText>
                <Feather
                  name="arrow-right"
                  size={16}
                  color={ComeYaColors.primary}
                />
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.confirmedContent}>
            <ActivityIndicator color={ComeYaColors.primary} size="large" />
            <ThemedText
              type="body"
              style={{ color: theme.textSecondary, marginTop: Spacing.lg }}
            >
              Notificando al restaurante...
            </ThemedText>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.xl,
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: Spacing.xl,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  timerCard: {
    width: "100%",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  timerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  timerDisplay: {
    alignItems: "center",
  },
  progressBar: {
    width: "100%",
    height: 8,
    backgroundColor: "#E0E0E0",
    borderRadius: 4,
    marginTop: Spacing.lg,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: ComeYaColors.primary,
    borderRadius: 4,
  },
  actions: {
    width: "100%",
    alignItems: "center",
    gap: Spacing.lg,
  },
  cancelButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderColor: ComeYaColors.error,
    borderWidth: 2,
    backgroundColor: ComeYaColors.error + "10",
  },
  skipButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    padding: Spacing.md,
  },
  confirmedContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
