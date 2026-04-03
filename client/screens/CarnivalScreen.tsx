import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Modal,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  FadeIn,
  FadeInDown,
  SlideInRight,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { Badge } from "@/components/Badge";
import { ConfettiAnimation } from "@/components/ConfettiAnimation";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useToast } from "@/contexts/ToastContext";
import {
  carnavalEvents,
  categories,
  eventDays,
  getCategoryColor,
  CarnavalEvent,
} from "@/data/carnaval2025";

const carnavalLogo = require("../assets/carnaval-autlan-2026-logo.png");

type CarnivalScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Carnival"
>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const REMINDERS_KEY = "@ComeYa_carnival_reminders";

type ReminderResult = { success: boolean; message?: string };

async function scheduleEventReminders(
  event: CarnavalEvent,
): Promise<ReminderResult> {
  if (Platform.OS === "web") {
    return {
      success: false,
      message:
        "Los recordatorios solo funcionan en la app movil. Escanea el codigo QR con Expo Go.",
    };
  }

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    if (newStatus !== "granted") {
      return {
        success: false,
        message: "Necesitamos permiso para enviar notificaciones.",
      };
    }
  }

  const eventDateTime = parseEventDateTime(event.date, event.time);
  const oneHourBefore = new Date(eventDateTime.getTime() - 60 * 60 * 1000);
  const now = new Date();

  if (oneHourBefore <= now) {
    return {
      success: false,
      message: "Este evento ya esta muy cerca o ya paso.",
    };
  }

  const notificationIds: string[] = [];

  for (let i = 0; i < 3; i++) {
    const triggerTime = new Date(oneHourBefore.getTime() + i * 5 * 60 * 1000);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title:
          i === 0 ? "Recordatorio Carnaval 2026" : "Recordatorio (repetido)",
        body: `${event.title} comienza en ${60 - i * 5} minutos! Ubicacion: ${event.location}`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerTime,
      },
    });
    notificationIds.push(id);
  }

  const stored = await AsyncStorage.getItem(REMINDERS_KEY);
  const reminders = stored ? JSON.parse(stored) : {};
  reminders[event.id] = notificationIds;
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));

  return {
    success: true,
    message:
      "Recibiras 3 alertas: 1 hora antes, 55 min y 50 min antes del evento.",
  };
}

async function cancelEventReminders(eventId: string): Promise<void> {
  const stored = await AsyncStorage.getItem(REMINDERS_KEY);
  if (!stored) return;

  const reminders = JSON.parse(stored);
  const notificationIds = reminders[eventId];

  if (notificationIds) {
    for (const id of notificationIds) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
    delete reminders[eventId];
    await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
  }
}

async function isEventReminderSet(eventId: string): Promise<boolean> {
  const stored = await AsyncStorage.getItem(REMINDERS_KEY);
  if (!stored) return false;
  const reminders = JSON.parse(stored);
  return !!reminders[eventId];
}

function parseEventDateTime(date: string, time: string): Date {
  const [day, month] = date.split(" de ");
  const months: { [key: string]: number } = {
    enero: 0,
    febrero: 1,
    marzo: 2,
    abril: 3,
    mayo: 4,
    junio: 5,
    julio: 6,
    agosto: 7,
    septiembre: 8,
    octubre: 9,
    noviembre: 10,
    diciembre: 11,
  };
  const monthIndex = months[month.toLowerCase()] ?? 0;
  const dayNum = parseInt(day, 10);

  const timeParts = time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  let hours = 12;
  let minutes = 0;
  if (timeParts) {
    hours = parseInt(timeParts[1], 10);
    minutes = parseInt(timeParts[2], 10);
    if (timeParts[3]?.toUpperCase() === "PM" && hours !== 12) hours += 12;
    if (timeParts[3]?.toUpperCase() === "AM" && hours === 12) hours = 0;
  }

  return new Date(2026, monthIndex, dayNum, hours, minutes);
}

type ToastFn = (
  message: string,
  type: "success" | "error" | "info" | "warning",
) => void;

function EventCard({
  event,
  index,
  onPress,
  showToast,
}: {
  event: CarnavalEvent;
  index: number;
  onPress: () => void;
  showToast: ToastFn;
}) {
  const { theme } = useTheme();
  const categoryColor = getCategoryColor(event.category);
  const scale = useSharedValue(1);
  const [hasReminder, setHasReminder] = useState(false);
  const [isSettingReminder, setIsSettingReminder] = useState(false);

  useEffect(() => {
    isEventReminderSet(event.id).then(setHasReminder);
  }, [event.id]);

  const handleToggleReminder = async () => {
    setIsSettingReminder(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (hasReminder) {
      await cancelEventReminders(event.id);
      setHasReminder(false);
      showToast("Recordatorio cancelado", "info");
    } else {
      const result = await scheduleEventReminders(event);
      if (result.success) {
        setHasReminder(true);
        showToast(result.message || "Recordatorio programado", "success");
      } else if (result.message) {
        showToast(result.message, "warning");
      }
    }
    setIsSettingReminder(false);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleCardPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const hasImage = event.image && event.image.length > 0;

  return (
    <AnimatedPressable
      onPress={handleCardPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      entering={FadeInDown.delay(index * 50).springify()}
    >
      <Animated.View
        style={[
          styles.eventCard,
          { backgroundColor: theme.card },
          Shadows.md,
          animatedStyle,
        ]}
      >
        {hasImage ? (
          <View style={styles.eventImageContainer}>
            <Image
              source={
                typeof event.image === "string"
                  ? { uri: event.image }
                  : event.image
              }
              style={styles.eventImage}
              contentFit="cover"
              transition={300}
            />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.7)"]}
              style={styles.imageGradient}
            />
            <View style={styles.imageOverlay}>
              <View
                style={[styles.timeBadge, { backgroundColor: categoryColor }]}
              >
                <Feather name="clock" size={12} color="#FFFFFF" />
                <ThemedText type="small" style={styles.timeBadgeText}>
                  {event.time}
                </ThemedText>
              </View>
              <ThemedText type="h4" style={styles.imageTitle}>
                {event.title}
              </ThemedText>
            </View>
          </View>
        ) : (
          <View style={[styles.timeStrip, { backgroundColor: categoryColor }]}>
            <Feather name="clock" size={14} color="#FFFFFF" />
            <ThemedText type="body" style={styles.timeText}>
              {event.time}
            </ThemedText>
          </View>
        )}

        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            <Badge
              text={event.category}
              variant="secondary"
              style={{ backgroundColor: categoryColor + "20" }}
            />
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={12} color={theme.textSecondary} />
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, marginLeft: 4 }}
              >
                {event.location}
              </ThemedText>
            </View>
          </View>

          {!hasImage && (
            <ThemedText type="h4" style={{ marginTop: Spacing.xs }}>
              {event.title}
            </ThemedText>
          )}

          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
            numberOfLines={2}
          >
            {event.description}
          </ThemedText>

          <Pressable
            onPress={handleToggleReminder}
            disabled={isSettingReminder}
            style={[
              styles.reminderButton,
              {
                backgroundColor: hasReminder
                  ? ComeYaColors.carnival.pink
                  : ComeYaColors.primary,
                opacity: isSettingReminder ? 0.6 : 1,
              },
            ]}
          >
            <Feather
              name={hasReminder ? "bell-off" : "bell"}
              size={14}
              color="#FFFFFF"
            />
            <ThemedText type="small" style={styles.reminderButtonText}>
              {isSettingReminder
                ? "Configurando..."
                : hasReminder
                  ? "Cancelar recordatorio"
                  : "Recordar 1h antes"}
            </ThemedText>
          </Pressable>
        </View>
      </Animated.View>
    </AnimatedPressable>
  );
}

function DayHeader({ date, day }: { date: string; day: string }) {
  const { theme } = useTheme();

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("es-VE", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  return (
    <Animated.View
      entering={SlideInRight.springify()}
      style={[styles.dayHeader, { backgroundColor: theme.backgroundSecondary }]}
    >
      <View style={styles.dayHeaderIcon}>
        <Feather name="calendar" size={18} color={ComeYaColors.carnival.pink} />
      </View>
      <ThemedText
        type="h3"
        style={{
          color: ComeYaColors.primary,
          textTransform: "capitalize",
          flex: 1,
        }}
      >
        {formatDate(date)}
      </ThemedText>
    </Animated.View>
  );
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function CarnivalScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<CarnivalScreenNavigationProp>();
  const { theme } = useTheme();
  const { showToast } = useToast();

  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CarnavalEvent | null>(
    null,
  );
  const [showFlyerModal, setShowFlyerModal] = useState(false);

  const openFlyerModal = (event: CarnavalEvent) => {
    setSelectedEvent(event);
    setShowFlyerModal(true);
  };

  const closeFlyerModal = () => {
    setShowFlyerModal(false);
    setSelectedEvent(null);
  };

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const filteredEvents = useMemo(() => {
    let events = carnavalEvents;

    if (selectedCategory !== "Todos") {
      events = events.filter((e) => e.category === selectedCategory);
    }

    if (selectedDay) {
      events = events.filter((e) => e.date === selectedDay);
    }

    return events;
  }, [selectedCategory, selectedDay]);

  const groupedEvents = useMemo(() => {
    const groups: { date: string; day: string; events: CarnavalEvent[] }[] = [];

    filteredEvents.forEach((event) => {
      const existingGroup = groups.find((g) => g.date === event.date);
      if (existingGroup) {
        existingGroup.events.push(event);
      } else {
        groups.push({
          date: event.date,
          day: event.day,
          events: [event],
        });
      }
    });

    return groups.sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredEvents]);

  const handleCategorySelect = (cat: string) => {
    Haptics.selectionAsync();
    setSelectedCategory(cat);
  };

  const handleDaySelect = (day: string | null) => {
    Haptics.selectionAsync();
    setSelectedDay(day);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ConfettiAnimation
        isActive={showConfetti}
        onComplete={() => setShowConfetti(false)}
        particleCount={80}
      />

      <LinearGradient
        colors={[ComeYaColors.carnival.pink, "#9C27B0", "#6A1B9A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + Spacing.md }]}
      >
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            navigation.goBack();
          }}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </Pressable>

        <Animated.View
          entering={FadeIn.delay(200)}
          style={styles.headerTitleContainer}
        >
          <Image
            source={carnavalLogo}
            style={styles.carnavalLogo}
            contentFit="contain"
          />
        </Animated.View>

        <View style={{ width: 44 }} />
      </LinearGradient>

      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.daysScroll}
        >
          <Pressable
            onPress={() => handleDaySelect(null)}
            style={[
              styles.dayChip,
              {
                backgroundColor:
                  selectedDay === null ? ComeYaColors.primary : theme.card,
                ...Shadows.sm,
              },
            ]}
          >
            <Feather
              name="calendar"
              size={14}
              color={selectedDay === null ? "#FFFFFF" : theme.text}
            />
            <ThemedText
              type="small"
              style={{
                color: selectedDay === null ? "#FFFFFF" : theme.text,
                fontWeight: "600",
                marginLeft: 6,
              }}
            >
              Todos
            </ThemedText>
          </Pressable>
          {eventDays.map((day) => (
            <Pressable
              key={day.date}
              onPress={() => handleDaySelect(day.date)}
              style={[
                styles.dayChip,
                {
                  backgroundColor:
                    selectedDay === day.date ? ComeYaColors.primary : theme.card,
                  ...Shadows.sm,
                },
              ]}
            >
              <ThemedText
                type="small"
                style={{
                  color: selectedDay === day.date ? "#FFFFFF" : theme.text,
                  fontWeight: "600",
                }}
              >
                {day.label}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            const catColor =
              cat === "Todos" ? ComeYaColors.primary : getCategoryColor(cat);

            return (
              <Pressable
                key={cat}
                onPress={() => handleCategorySelect(cat)}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: isSelected ? catColor : "transparent",
                    borderColor: catColor,
                    borderWidth: 1.5,
                  },
                ]}
              >
                <ThemedText
                  type="small"
                  style={{
                    color: isSelected ? "#FFFFFF" : catColor,
                    fontWeight: "600",
                  }}
                >
                  {cat}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.resultsHeader}>
        <View style={styles.resultsCount}>
          <View
            style={[
              styles.countBadge,
              { backgroundColor: ComeYaColors.primary + "20" },
            ]}
          >
            <ThemedText
              type="body"
              style={{ color: ComeYaColors.primary, fontWeight: "700" }}
            >
              {filteredEvents.length}
            </ThemedText>
          </View>
          <ThemedText
            type="body"
            style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}
          >
            evento{filteredEvents.length !== 1 ? "s" : ""}
          </ThemedText>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {groupedEvents.length > 0 ? (
          groupedEvents.map((group, groupIndex) => (
            <View key={group.date}>
              <DayHeader date={group.date} day={group.day} />
              {group.events.map((event, eventIndex) => (
                <EventCard
                  key={event.id}
                  event={event}
                  index={groupIndex * 10 + eventIndex}
                  onPress={() => openFlyerModal(event)}
                  showToast={showToast}
                />
              ))}
            </View>
          ))
        ) : (
          <Animated.View
            entering={FadeIn}
            style={[
              styles.emptyState,
              { backgroundColor: theme.card },
              Shadows.sm,
            ]}
          >
            <Feather name="calendar" size={48} color={theme.textSecondary} />
            <ThemedText
              type="h4"
              style={{ color: theme.text, marginTop: Spacing.md }}
            >
              Sin eventos
            </ThemedText>
            <ThemedText
              type="small"
              style={{
                color: theme.textSecondary,
                marginTop: Spacing.xs,
                textAlign: "center",
              }}
            >
              No hay eventos para los filtros seleccionados
            </ThemedText>
          </Animated.View>
        )}

        <Animated.View
          entering={FadeInDown.delay(500)}
          style={[
            styles.infoCard,
            { backgroundColor: ComeYaColors.carnival.pink + "15" },
          ]}
        >
          <View style={styles.infoRow}>
            <View
              style={[
                styles.infoIcon,
                { backgroundColor: ComeYaColors.carnival.pink },
              ]}
            >
              <Feather name="info" size={16} color="#FFFFFF" />
            </View>
            <ThemedText
              type="small"
              style={{ marginLeft: Spacing.md, flex: 1, color: theme.text }}
            >
              Los eventos están sujetos a cambios. Consulta las redes sociales
              oficiales para información actualizada.
            </ThemedText>
          </View>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={showFlyerModal}
        transparent
        animationType="fade"
        onRequestClose={closeFlyerModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeFlyerModal} />
          <Animated.View
            entering={FadeInDown.springify()}
            style={[styles.flyerModal, { backgroundColor: theme.card }]}
          >
            <Pressable
              style={styles.modalCloseButton}
              onPress={closeFlyerModal}
            >
              <Feather name="x" size={24} color="#FFFFFF" />
            </Pressable>

            {selectedEvent?.image ? (
              <ScrollView
                style={styles.flyerScrollView}
                contentContainerStyle={styles.flyerScrollContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <Image
                  source={
                    typeof selectedEvent.image === "string"
                      ? { uri: selectedEvent.image }
                      : selectedEvent.image
                  }
                  style={styles.flyerImage}
                  contentFit="contain"
                  transition={300}
                />
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.9)"]}
                  style={styles.flyerGradient}
                />
                <View
                  style={[
                    styles.flyerInfo,
                    { paddingBottom: insets.bottom + Spacing.lg },
                  ]}
                >
                  <Badge
                    text={selectedEvent.category}
                    variant="primary"
                    style={{
                      backgroundColor: getCategoryColor(selectedEvent.category),
                      marginBottom: Spacing.sm,
                    }}
                  />
                  <ThemedText type="h2" style={styles.flyerTitle}>
                    {selectedEvent.title}
                  </ThemedText>
                  <View style={styles.flyerDetailRow}>
                    <Feather name="calendar" size={16} color="#FFFFFF" />
                    <ThemedText type="body" style={styles.flyerDetailText}>
                      {selectedEvent.date}
                    </ThemedText>
                  </View>
                  <View style={styles.flyerDetailRow}>
                    <Feather name="clock" size={16} color="#FFFFFF" />
                    <ThemedText type="body" style={styles.flyerDetailText}>
                      {selectedEvent.time}
                    </ThemedText>
                  </View>
                  <View style={styles.flyerDetailRow}>
                    <Feather name="map-pin" size={16} color="#FFFFFF" />
                    <ThemedText type="body" style={styles.flyerDetailText}>
                      {selectedEvent.location}
                    </ThemedText>
                  </View>
                  <ThemedText type="body" style={styles.flyerDescription}>
                    {selectedEvent.description}
                  </ThemedText>
                </View>
              </ScrollView>
            ) : (
              <View
                style={[
                  styles.noImageFlyer,
                  { paddingBottom: insets.bottom + Spacing.lg },
                ]}
              >
                <LinearGradient
                  colors={[
                    getCategoryColor(selectedEvent?.category || "Conciertos"),
                    "#6A1B9A",
                  ]}
                  style={styles.noImageGradient}
                >
                  <Feather
                    name="music"
                    size={64}
                    color="rgba(255,255,255,0.8)"
                  />
                </LinearGradient>
                <View style={styles.flyerInfo}>
                  <Badge
                    text={selectedEvent?.category || ""}
                    variant="primary"
                    style={{
                      backgroundColor: getCategoryColor(
                        selectedEvent?.category || "Conciertos",
                      ),
                      marginBottom: Spacing.sm,
                    }}
                  />
                  <ThemedText
                    type="h2"
                    style={{ color: theme.text, marginBottom: Spacing.md }}
                  >
                    {selectedEvent?.title}
                  </ThemedText>
                  <View
                    style={[
                      styles.flyerDetailRow,
                      { marginBottom: Spacing.xs },
                    ]}
                  >
                    <Feather
                      name="calendar"
                      size={16}
                      color={theme.textSecondary}
                    />
                    <ThemedText
                      type="body"
                      style={{
                        color: theme.textSecondary,
                        marginLeft: Spacing.sm,
                      }}
                    >
                      {selectedEvent?.date}
                    </ThemedText>
                  </View>
                  <View
                    style={[
                      styles.flyerDetailRow,
                      { marginBottom: Spacing.xs },
                    ]}
                  >
                    <Feather
                      name="clock"
                      size={16}
                      color={theme.textSecondary}
                    />
                    <ThemedText
                      type="body"
                      style={{
                        color: theme.textSecondary,
                        marginLeft: Spacing.sm,
                      }}
                    >
                      {selectedEvent?.time}
                    </ThemedText>
                  </View>
                  <View
                    style={[
                      styles.flyerDetailRow,
                      { marginBottom: Spacing.md },
                    ]}
                  >
                    <Feather
                      name="map-pin"
                      size={16}
                      color={theme.textSecondary}
                    />
                    <ThemedText
                      type="body"
                      style={{
                        color: theme.textSecondary,
                        marginLeft: Spacing.sm,
                      }}
                    >
                      {selectedEvent?.location}
                    </ThemedText>
                  </View>
                  <ThemedText type="body" style={{ color: theme.text }}>
                    {selectedEvent?.description}
                  </ThemedText>
                </View>
              </View>
            )}
          </Animated.View>
        </View>
      </Modal>
    </View>
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
    paddingBottom: Spacing.xl,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  headerTitleContainer: {
    alignItems: "center",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
  },
  headerYear: {
    color: ComeYaColors.carnival.gold,
    fontSize: 48,
    fontWeight: "800",
    textShadow: "0px 2px 4px rgba(0,0,0,0.3)",
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xs,
  },
  headerBadgeText: {
    color: "#FFFFFF",
    marginLeft: 6,
    fontWeight: "500",
  },
  filtersContainer: {
    paddingTop: Spacing.md,
  },
  daysScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  dayChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.xs,
  },
  categoriesScroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.xs,
  },
  resultsHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  resultsCount: {
    flexDirection: "row",
    alignItems: "center",
  },
  countBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: -Spacing.lg,
    marginBottom: Spacing.sm,
  },
  dayHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ComeYaColors.carnival.pink + "20",
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  eventCard: {
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  eventImageContainer: {
    height: 160,
    position: "relative",
  },
  eventImage: {
    width: "100%",
    height: "100%",
  },
  imageGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },
  imageOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: Spacing.md,
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.xs,
  },
  timeBadgeText: {
    color: "#FFFFFF",
    fontWeight: "600",
    marginLeft: 4,
  },
  imageTitle: {
    color: "#FFFFFF",
    textShadow: "0px 1px 2px rgba(0,0,0,0.5)",
  },
  timeStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    gap: 6,
  },
  timeText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  eventContent: {
    padding: Spacing.md,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.xl,
  },
  infoCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.xl,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  carnavalLogo: {
    width: 120,
    height: 120,
  },
  reminderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
    gap: 6,
  },
  reminderButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  flyerModal: {
    width: screenWidth * 0.92,
    maxHeight: screenHeight * 0.88,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  modalCloseButton: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  flyerScrollView: {
    flex: 1,
  },
  flyerScrollContent: {
    flexGrow: 1,
  },
  flyerImage: {
    width: "100%",
    aspectRatio: 3 / 4,
    minHeight: screenHeight * 0.5,
  },
  flyerGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 200,
  },
  flyerInfo: {
    padding: Spacing.lg,
  },
  flyerTitle: {
    color: "#FFFFFF",
    marginBottom: Spacing.md,
  },
  flyerDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  flyerDetailText: {
    color: "#FFFFFF",
    marginLeft: Spacing.sm,
  },
  flyerDescription: {
    color: "rgba(255,255,255,0.9)",
    marginTop: Spacing.md,
    lineHeight: 22,
  },
  noImageFlyer: {
    flex: 1,
  },
  noImageGradient: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
});
