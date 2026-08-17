import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import DateTimePicker from "@react-native-community/datetimepicker";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/contexts/ToastContext";

type ScheduleOrderRouteProp = RouteProp<RootStackParamList, "ScheduleOrder">;
type ScheduleOrderNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "ScheduleOrder"
>;

export default function ScheduleOrderScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigation = useNavigation<ScheduleOrderNavigationProp>();
  const route = useRoute<ScheduleOrderRouteProp>();
  const queryClient = useQueryClient();

  const { businessId, businessName, items, subtotal } = route.params || {};

  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [notes, setNotes] = useState("");

  const daysOfWeek = [
    { id: 0, label: "Dom", full: "Domingo" },
    { id: 1, label: "Lun", full: "Lunes" },
    { id: 2, label: "Mar", full: "Martes" },
    { id: 3, label: "Mie", full: "Miércoles" },
    { id: 4, label: "Jue", full: "Jueves" },
    { id: 5, label: "Vie", full: "Viernes" },
    { id: 6, label: "Sab", full: "Sábado" },
  ];

  const toggleDay = (dayId: number) => {
    Haptics.selectionAsync();
    if (recurringDays.includes(dayId)) {
      setRecurringDays(recurringDays.filter((d) => d !== dayId));
    } else {
      setRecurringDays([...recurringDays, dayId]);
    }
  };

  const createScheduledOrderMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/scheduled-orders", {
        userId: user?.id,
        businessId,
        items: items || [],
        scheduledFor: scheduledDate.toISOString(),
        notes,
      });
      return response.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(
        `Pedido programado para ${scheduledDate.toLocaleDateString("es-VE")}`,
        "success",
      );
      navigation.goBack();
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-orders"] });
    },
    onError: () => {
      showToast("No se pudo programar el pedido", "error");
    },
  });

  const createRecurringOrderMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/recurring-orders", {
        userId: user?.id,
        businessId,
        items: JSON.stringify(items),
        daysOfWeek: JSON.stringify(recurringDays),
        scheduledTime: scheduledDate.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        notes,
      });
      return response.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const selectedDays = recurringDays
        .sort()
        .map((d) => daysOfWeek.find((day) => day.id === d)?.full)
        .join(", ");
      showToast(`Pedido recurrente creado: cada ${selectedDays}`, "success");
      navigation.goBack();
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-orders"] });
    },
    onError: () => {
      showToast("No se pudo crear el pedido recurrente", "error");
    },
  });

  const handleSchedule = () => {
    if (isRecurring && recurringDays.length === 0) {
      showToast("Por favor selecciona al menos un día de la semana", "warning");
      return;
    }

    if (isRecurring) {
      createRecurringOrderMutation.mutate();
    } else {
      createScheduledOrderMutation.mutate();
    }
  };

  const minDate = new Date();
  minDate.setHours(minDate.getHours() + 1);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Programar Pedido</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.delay(100)}
          style={[styles.card, { backgroundColor: theme.card }, Shadows.md]}
        >
          <View style={styles.businessInfo}>
            <Feather
              name="shopping-bag"
              size={24}
              color={ComeYaColors.primary}
            />
            <View style={{ marginLeft: Spacing.md }}>
              <ThemedText type="h4">{businessName || "Negocio"}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {items?.length || 0} productos
              </ThemedText>
            </View>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(200)}
          style={[styles.card, { backgroundColor: theme.card }, Shadows.md]}
        >
          <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
            Tipo de pedido
          </ThemedText>

          <View style={styles.toggleRow}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setIsRecurring(false);
              }}
              style={[
                styles.toggleButton,
                {
                  backgroundColor: !isRecurring
                    ? ComeYaColors.primary
                    : theme.backgroundSecondary,
                  borderColor: !isRecurring
                    ? ComeYaColors.primary
                    : "transparent",
                },
              ]}
            >
              <Feather
                name="calendar"
                size={18}
                color={!isRecurring ? "#FFFFFF" : theme.text}
              />
              <ThemedText
                type="body"
                style={{
                  color: !isRecurring ? "#FFFFFF" : theme.text,
                  marginLeft: Spacing.sm,
                }}
              >
                Una vez
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setIsRecurring(true);
              }}
              style={[
                styles.toggleButton,
                {
                  backgroundColor: isRecurring
                    ? ComeYaColors.primary
                    : theme.backgroundSecondary,
                  borderColor: isRecurring
                    ? ComeYaColors.primary
                    : "transparent",
                },
              ]}
            >
              <Feather
                name="repeat"
                size={18}
                color={isRecurring ? "#FFFFFF" : theme.text}
              />
              <ThemedText
                type="body"
                style={{
                  color: isRecurring ? "#FFFFFF" : theme.text,
                  marginLeft: Spacing.sm,
                }}
              >
                Recurrente
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>

        {isRecurring ? (
          <Animated.View
            entering={FadeInDown.delay(300)}
            style={[styles.card, { backgroundColor: theme.card }, Shadows.md]}
          >
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
              Días de la semana
            </ThemedText>
            <View style={styles.daysRow}>
              {daysOfWeek.map((day) => (
                <Pressable
                  key={day.id}
                  onPress={() => toggleDay(day.id)}
                  style={[
                    styles.dayButton,
                    {
                      backgroundColor: recurringDays.includes(day.id)
                        ? ComeYaColors.primary
                        : theme.backgroundSecondary,
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: recurringDays.includes(day.id)
                        ? "#FFFFFF"
                        : theme.text,
                      fontWeight: "600",
                    }}
                  >
                    {day.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        ) : (
          <Animated.View
            entering={FadeInDown.delay(300)}
            style={[styles.card, { backgroundColor: theme.card }, Shadows.md]}
          >
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
              Fecha de entrega
            </ThemedText>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={[
                styles.dateButton,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Feather name="calendar" size={20} color={ComeYaColors.primary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.md }}>
                {scheduledDate.toLocaleDateString("es-VE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </ThemedText>
              <Feather
                name="chevron-right"
                size={20}
                color={theme.textSecondary}
                style={{ marginLeft: "auto" }}
              />
            </Pressable>
          </Animated.View>
        )}

        <Animated.View
          entering={FadeInDown.delay(400)}
          style={[styles.card, { backgroundColor: theme.card }, Shadows.md]}
        >
          <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
            Hora de entrega
          </ThemedText>
          <Pressable
            onPress={() => setShowTimePicker(true)}
            style={[
              styles.dateButton,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <Feather name="clock" size={20} color={ComeYaColors.primary} />
            <ThemedText type="body" style={{ marginLeft: Spacing.md }}>
              {scheduledDate.toLocaleTimeString("es-VE", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </ThemedText>
            <Feather
              name="chevron-right"
              size={20}
              color={theme.textSecondary}
              style={{ marginLeft: "auto" }}
            />
          </Pressable>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(500)}
          style={[styles.card, { backgroundColor: theme.card }, Shadows.md]}
        >
          <View style={styles.infoRow}>
            <Feather name="info" size={18} color={theme.textSecondary} />
            <ThemedText
              type="caption"
              style={{
                color: theme.textSecondary,
                marginLeft: Spacing.sm,
                flex: 1,
              }}
            >
              {isRecurring
                ? "Recibirás una notificación 1 hora antes de cada pedido programado para confirmar"
                : "Tu pedido será procesado automáticamente en la fecha y hora seleccionada"}
            </ThemedText>
          </View>
        </Animated.View>
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}
      >
        <Pressable
          onPress={handleSchedule}
          disabled={
            createScheduledOrderMutation.isPending ||
            createRecurringOrderMutation.isPending
          }
          style={[
            styles.scheduleButton,
            {
              backgroundColor: ComeYaColors.primary,
              opacity:
                createScheduledOrderMutation.isPending ||
                createRecurringOrderMutation.isPending
                  ? 0.6
                  : 1,
            },
          ]}
        >
          <Feather
            name={isRecurring ? "repeat" : "calendar"}
            size={20}
            color="#FFFFFF"
          />
          <ThemedText
            type="h4"
            style={{ color: "#FFFFFF", marginLeft: Spacing.sm }}
          >
            {isRecurring ? "Crear pedido recurrente" : "Programar pedido"}
          </ThemedText>
        </Pressable>
      </View>

      {showDatePicker ? (
        <DateTimePicker
          value={scheduledDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={minDate}
          onChange={(_event: unknown, date?: Date) => {
            setShowDatePicker(false);
            if (date) {
              const newDate = new Date(scheduledDate);
              newDate.setFullYear(
                date.getFullYear(),
                date.getMonth(),
                date.getDate(),
              );
              setScheduledDate(newDate);
            }
          }}
        />
      ) : null}

      {showTimePicker ? (
        <DateTimePicker
          value={scheduledDate}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_event: unknown, date?: Date) => {
            setShowTimePicker(false);
            if (date) {
              const newDate = new Date(scheduledDate);
              newDate.setHours(date.getHours(), date.getMinutes());
              setScheduledDate(newDate);
            }
          }}
        />
      ) : null}
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
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  businessInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  toggleRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  scheduleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
});
