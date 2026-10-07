import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Modal,
  ActivityIndicator,
  TextInput,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";

interface Business {
  id: string;
  name: string;
  image?: string;
  address?: string;
}

interface Shift {
  open: string;
  close: string;
}

interface DayHours {
  day: string;
  dayKey: string;
  isOpen: boolean;
  morning: Shift;
  hasEvening: boolean;
  evening: Shift;
}

const DAYS: { key: string; label: string }[] = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miércoles" },
  { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
];

const DEFAULT_HOURS: DayHours[] = DAYS.map((d) => ({
  day: d.label,
  dayKey: d.key,
  isOpen: d.key !== "sunday",
  morning: { open: "09:00", close: "16:00" },
  hasEvening: false,
  evening: { open: "20:00", close: "23:00" },
}));

const timeToMin = (t: string): number => {
  const [h, m] = t.split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
};

const shiftRange = (s: Shift) => `${s.open} – ${s.close}`;

const dayPreview = (h: DayHours): string => {
  if (!h.isOpen) return "Cerrado";
  const parts = [shiftRange(h.morning)];
  if (h.hasEvening) parts.push(shiftRange(h.evening));
  return parts.join(" · ");
};

const isOvernightShift = (s: Shift) => timeToMin(s.close) <= timeToMin(s.open);

const eveningOverlaps = (h: DayHours): boolean => {
  if (!h.isOpen || !h.hasEvening) return false;
  if (isOvernightShift(h.morning) || isOvernightShift(h.evening)) return false;
  return (
    timeToMin(h.evening.open) < timeToMin(h.morning.close) &&
    timeToMin(h.evening.close) > timeToMin(h.morning.open)
  );
};

const dayWarnings = (h: DayHours): string[] => {
  if (!h.isOpen) return [];
  const warnings: string[] = [];
  if (isOvernightShift(h.morning) || (h.hasEvening && isOvernightShift(h.evening)))
    warnings.push("Horario nocturno: las reservas se generan hasta las 24:00.");
  if (eveningOverlaps(h))
    warnings.push("El turno de noche se solapa con el de mañana.");
  return warnings;
};

export default function BusinessHoursScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const routeBusinessId = route.params?.businessId as string | undefined;
  const { theme } = useTheme();
  const { showToast } = useToast();

  const [myBusinesses, setMyBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);

  const [hours, setHours] = useState<DayHours[]>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Último estado guardado, para detectar cambios sin guardar
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const dirty = savedSnapshot !== "" && JSON.stringify(hours) !== savedSnapshot;

  // Time picker modal
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{
    dayIndex: number;
    shift: "morning" | "evening";
    field: "open" | "close";
  } | null>(null);
  const [pickerValue, setPickerValue] = useState("09:00");
  const [pickerDate, setPickerDate] = useState(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  });

  useEffect(() => {
    loadMyBusinesses();
  }, []);

  const loadMyBusinesses = async () => {
    try {
      const res = await apiRequest("GET", "/api/business/my-businesses");
      const data = await res.json();
      if (data.success && data.businesses) {
        setMyBusinesses(data.businesses);
        if (data.businesses.length > 0) {
          // Si venimos de "Configurar reservas" con un negocio concreto,
          // seleccionamos ese (si sigue perteneciendo al usuario)
          const fromRoute =
            routeBusinessId &&
            data.businesses.some((b: Business) => b.id === routeBusinessId)
              ? routeBusinessId
              : undefined;
          setSelectedBusinessId(fromRoute || data.businesses[0].id);
        }
      }
    } catch (e) {
      console.error("Error loading businesses:", e);
    } finally {
      setLoadingBusinesses(false);
    }
  };

  useEffect(() => {
    if (selectedBusinessId) {
      loadHours();
    }
  }, [selectedBusinessId]);

  const loadHours = async () => {
    if (!selectedBusinessId) return;
    setLoading(true);
    try {
      const res = await apiRequest(
        "GET",
        `/api/business/hours?businessId=${selectedBusinessId}`,
      );
      const data = await res.json();
      if (data.success && data.hours) {
        const parsed: DayHours[] = DAYS.map((d) => {
          const v = data.hours[d.key];
          if (!v || v.closed) {
            return {
              ...DEFAULT_HOURS.find((x) => x.dayKey === d.key)!,
              isOpen: false,
            };
          }
          return {
            day: d.label,
            dayKey: d.key,
            isOpen: true,
            morning: { open: v.open || "09:00", close: v.close || "16:00" },
            hasEvening: !!v.eveningOpen,
            evening: {
              open: v.eveningOpen || "20:00",
              close: v.eveningClose || "23:00",
            },
          };
        });
        setHours(parsed);
        setSavedSnapshot(JSON.stringify(parsed));
      }
    } catch (e) {
      console.error("Error loading hours:", e);
    } finally {
      setLoading(false);
    }
  };

  const update = (index: number, patch: Partial<DayHours>) => {
    setHours((prev) =>
      prev.map((h, i) => (i === index ? { ...h, ...patch } : h)),
    );
  };

  const updateShift = (
    index: number,
    shift: "morning" | "evening",
    field: "open" | "close",
    value: string,
  ) => {
    setHours((prev) =>
      prev.map((h, i) => {
        if (i !== index) return h;
        return { ...h, [shift]: { ...h[shift], [field]: value } };
      }),
    );
  };

  const openPicker = (
    dayIndex: number,
    shift: "morning" | "evening",
    field: "open" | "close",
  ) => {
    const current = hours[dayIndex][shift][field];
    setPickerTarget({ dayIndex, shift, field });
    setPickerValue(current);
    const [hRaw, mRaw] = current.split(":");
    const d = new Date();
    d.setHours(parseInt(hRaw, 10) || 0, parseInt(mRaw, 10) || 0, 0, 0);
    setPickerDate(d);
    setPickerVisible(true);
    Haptics.selectionAsync();
  };

  const confirmPicker = () => {
    if (!pickerTarget) return;
    // Validar formato HH:MM
    const normalized = normalizeTimeInput(pickerValue);
    updateShift(
      pickerTarget.dayIndex,
      pickerTarget.shift,
      pickerTarget.field,
      normalized,
    );
    setPickerVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Normaliza el input del usuario a HH:MM válido (tolera horas a medias,
  // ej. "21:3" → 21:03, "9" → 09:00)
  const normalizeTimeInput = (raw: string): string => {
    const [hPart, mPart] = raw.replace(/[^0-9:]/g, "").split(":");
    let h = parseInt(hPart || "0", 10);
    if (!Number.isFinite(h)) h = 0;
    h = Math.min(Math.max(h, 0), 23);
    let m = parseInt((mPart || "").slice(0, 2), 10);
    if (!Number.isFinite(m)) m = 0;
    m = Math.min(Math.max(m, 0), 59);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  // Android: reloj nativo en diálogo (evita el spinner embebido, que salta
  // al re-renderizar mientras se gira)
  const openNativeClock = () => {
    DateTimePickerAndroid.open({
      value: pickerDate,
      mode: "time",
      is24Hour: true,
      onChange: (event: any, date?: Date) => {
        if (event.type === "set" && date && pickerTarget) {
          const hh = String(date.getHours()).padStart(2, "0");
          const mm = String(date.getMinutes()).padStart(2, "0");
          updateShift(
            pickerTarget.dayIndex,
            pickerTarget.shift,
            pickerTarget.field,
            `${hh}:${mm}`,
          );
          setPickerVisible(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      },
    });
  };

  // Copia el horario de un día origen a varios días destino
  const copyFromDay = (sourceKey: string, targetKeys: string[]) => {
    const source = hours.find((h) => h.dayKey === sourceKey);
    if (!source) return;
    setHours((prev) =>
      prev.map((h) =>
        targetKeys.includes(h.dayKey)
          ? {
              ...h,
              isOpen: source.isOpen,
              morning: { ...source.morning },
              hasEvening: source.hasEvening,
              evening: { ...source.evening },
            }
          : h,
      ),
    );
    Haptics.selectionAsync();
    showToast("Horario copiado", "success");
  };

  const copyAllDays = () =>
    copyFromDay(
      "monday",
      DAYS.map((d) => d.key).filter((k) => k !== "monday"),
    );
  const copyWeekdays = () =>
    copyFromDay("monday", ["tuesday", "wednesday", "thursday", "friday"]);

  const saveHours = async () => {
    if (!selectedBusinessId) return;
    setSaving(true);
    try {
      const hoursObject = hours.reduce((acc: any, h) => {
        acc[h.dayKey] = h.isOpen
          ? {
              open: h.morning.open,
              close: h.morning.close,
              closed: false,
              ...(h.hasEvening
                ? { eveningOpen: h.evening.open, eveningClose: h.evening.close }
                : {}),
            }
          : { closed: true };
        return acc;
      }, {});

      await apiRequest("PUT", "/api/business/hours", {
        businessId: selectedBusinessId,
        hours: hoursObject,
      });
      setSavedSnapshot(JSON.stringify(hours));
      showToast("Horarios guardados correctamente", "success");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (e) {
      showToast("Error al guardar horarios", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          {
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: theme.backgroundRoot,
          },
        ]}
      >
        <ActivityIndicator color={ComeYaColors.primary} size="large" />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[
        theme.gradientStart || "#FFFFFF",
        theme.gradientEnd || "#F5F5F5",
      ]}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Horarios</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      {loadingBusinesses ? (
        <View style={[styles.businessSelectorLoading, { padding: Spacing.lg }]}>
          <ActivityIndicator color={ComeYaColors.primary} size="small" />
        </View>
      ) : myBusinesses.length > 1 ? (
        <View
          style={[
            styles.businessSelector,
            {
              backgroundColor: theme.card,
              marginHorizontal: Spacing.lg,
              marginBottom: Spacing.md,
            },
            Shadows.sm,
          ]}
        >
          <ThemedText
            type="caption"
            style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}
          >
            Selecciona un negocio
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
          >
            <View style={{ flexDirection: "row", gap: Spacing.sm }}>
              {myBusinesses.map((biz) => (
                <Pressable
                  key={biz.id}
                  onPress={() => {
                    setSelectedBusinessId(biz.id);
                    Haptics.selectionAsync();
                  }}
                  style={[
                    styles.businessChip,
                    {
                      backgroundColor:
                        selectedBusinessId === biz.id
                          ? ComeYaColors.primary
                          : theme.backgroundSecondary,
                      borderColor:
                        selectedBusinessId === biz.id
                          ? ComeYaColors.primary
                          : theme.border,
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color:
                        selectedBusinessId === biz.id ? "#FFF" : theme.text,
                      fontWeight: "600",
                    }}
                    numberOfLines={1}
                  >
                    {biz.name}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : myBusinesses.length === 1 ? (
        <View
          style={[
            styles.singleBusinessBadge,
            {
              backgroundColor: ComeYaColors.primary + "15",
              marginHorizontal: Spacing.lg,
              marginBottom: Spacing.md,
            },
          ]}
        >
          <Feather name="map-pin" size={14} color={ComeYaColors.primary} />
          <ThemedText
            type="small"
            style={{
              color: ComeYaColors.primary,
              fontWeight: "600",
              marginLeft: 4,
            }}
          >
            {myBusinesses[0].name}
          </ThemedText>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Acciones rápidas en bloque */}
        <View style={styles.bulkRow}>
          <Pressable
            onPress={copyAllDays}
            style={[
              styles.bulkBtn,
              { backgroundColor: ComeYaColors.primary + "15" },
            ]}
          >
            <Feather name="copy" size={14} color={ComeYaColors.primary} />
            <ThemedText
              type="small"
              style={{
                color: ComeYaColors.primary,
                fontWeight: "600",
                marginLeft: 4,
              }}
            >
              Copiar Lunes a todos los días
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={copyWeekdays}
            style={[
              styles.bulkBtn,
              { backgroundColor: ComeYaColors.primary + "15" },
            ]}
          >
            <Feather name="copy" size={14} color={ComeYaColors.primary} />
            <ThemedText
              type="small"
              style={{
                color: ComeYaColors.primary,
                fontWeight: "600",
                marginLeft: 4,
              }}
            >
              Copiar a laborables (L–V)
            </ThemedText>
          </Pressable>
        </View>

        {hours.map((hour, index) => (
          <View
            key={hour.dayKey}
            style={[
              styles.dayCard,
              { backgroundColor: theme.card },
              Shadows.sm,
            ]}
          >
            <View style={styles.dayHeader}>
              <ThemedText type="h4">{hour.day}</ThemedText>
              <Switch
                value={hour.isOpen}
                onValueChange={(v) => {
                  update(index, { isOpen: v });
                  Haptics.selectionAsync();
                }}
                trackColor={{ false: "#ccc", true: ComeYaColors.primary }}
                thumbColor="#fff"
              />
            </View>

            {hour.isOpen && (
              <>
                <View style={styles.shiftRow}>
                  <View
                    style={[
                      styles.shiftBadge,
                      { backgroundColor: ComeYaColors.primary + "15" },
                    ]}
                  >
                    <Feather name="sun" size={14} color={ComeYaColors.primary} />
                    <ThemedText
                      type="caption"
                      style={{
                        color: ComeYaColors.primary,
                        marginLeft: 4,
                        fontWeight: "600",
                      }}
                    >
                      Mañana
                    </ThemedText>
                  </View>
                  <View style={styles.timePair}>
                    <TimeButton
                      label="Apertura"
                      value={hour.morning.open}
                      onPress={() => openPicker(index, "morning", "open")}
                      theme={theme}
                    />
                    <Feather name="arrow-right" size={16} color={theme.textSecondary} />
                    <TimeButton
                      label="Cierre"
                      value={hour.morning.close}
                      onPress={() => openPicker(index, "morning", "close")}
                      theme={theme}
                    />
                  </View>
                </View>

                <Pressable
                  onPress={() => {
                    update(index, { hasEvening: !hour.hasEvening });
                    Haptics.selectionAsync();
                  }}
                  style={styles.addShiftBtn}
                >
                  <Feather
                    name={hour.hasEvening ? "minus-circle" : "plus-circle"}
                    size={16}
                    color={
                      hour.hasEvening ? ComeYaColors.error : ComeYaColors.primary
                    }
                  />
                  <ThemedText
                    type="small"
                    style={{
                      color: hour.hasEvening
                        ? ComeYaColors.error
                        : ComeYaColors.primary,
                      marginLeft: 6,
                    }}
                  >
                    {hour.hasEvening ? "Quitar turno noche" : "Añadir turno noche"}
                  </ThemedText>
                </Pressable>

                {hour.hasEvening && (
                  <View style={styles.shiftRow}>
                    <View
                      style={[
                        styles.shiftBadge,
                        { backgroundColor: "#3F51B5" + "15" },
                      ]}
                    >
                      <Feather name="moon" size={14} color="#3F51B5" />
                      <ThemedText
                        type="caption"
                        style={{
                          color: "#3F51B5",
                          marginLeft: 4,
                          fontWeight: "600",
                        }}
                      >
                        Noche
                      </ThemedText>
                    </View>
                    <View style={styles.timePair}>
                      <TimeButton
                        label="Apertura"
                        value={hour.evening.open}
                        onPress={() => openPicker(index, "evening", "open")}
                        theme={theme}
                      />
                      <Feather name="arrow-right" size={16} color={theme.textSecondary} />
                      <TimeButton
                        label="Cierre"
                        value={hour.evening.close}
                        onPress={() => openPicker(index, "evening", "close")}
                        theme={theme}
                      />
                    </View>
                  </View>
                )}

                <View style={styles.previewRow}>
                  <Feather name="calendar" size={13} color={theme.textSecondary} />
                  <ThemedText
                    type="caption"
                    style={{
                      color: theme.textSecondary,
                      marginLeft: 4,
                      flex: 1,
                    }}
                  >
                    Reservas: {dayPreview(hour)}
                  </ThemedText>
                </View>

                {dayWarnings(hour).map((w) => (
                  <View key={w} style={styles.warningRow}>
                    <Feather name="alert-triangle" size={13} color="#F59E0B" />
                    <ThemedText
                      type="caption"
                      style={{ color: "#F59E0B", marginLeft: 4, flex: 1 }}
                    >
                      {w}
                    </ThemedText>
                  </View>
                ))}
              </>
            )}

            {!hour.isOpen && (
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, marginTop: Spacing.sm }}
              >
                Cerrado
              </ThemedText>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Barra de guardado siempre visible */}
      <View
        style={[
          styles.saveBar,
          {
            backgroundColor: theme.card,
            borderTopColor: theme.border,
            paddingBottom: Math.max(insets.bottom, Spacing.md),
          },
        ]}
      >
        {dirty ? (
          <ThemedText
            type="caption"
            style={{
              color: "#F59E0B",
              fontWeight: "700",
              textAlign: "center",
              marginBottom: Spacing.xs,
            }}
          >
            ● Cambios sin guardar
          </ThemedText>
        ) : null}
        <Pressable
          onPress={saveHours}
          disabled={saving}
          style={[
            styles.saveButton,
            {
              backgroundColor: ComeYaColors.primary,
              opacity: saving ? 0.7 : 1,
            },
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <ThemedText type="body" style={{ color: "#FFF", fontWeight: "700" }}>
              Guardar horarios
            </ThemedText>
          )}
        </Pressable>
      </View>

      {/* ─── TIME PICKER MODAL ─── */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <Pressable
          style={styles.pickerOverlay}
          onPress={() => setPickerVisible(false)}
        >
          <Pressable
            style={[styles.pickerCard, { backgroundColor: theme.card }]}
            onPress={() => {}} // Evita cerrar al tocar dentro
          >
            <ThemedText type="h4" style={{ textAlign: "center", marginBottom: Spacing.md }}>
              {pickerTarget?.field === "open" ? "Hora de apertura" : "Hora de cierre"}
            </ThemedText>

            {Platform.OS === "ios" ? (
              /* iOS: reloj con ruedas integrado en la ventana */
              <View style={styles.wheelWrap}>
                <DateTimePicker
                  value={pickerDate}
                  mode="time"
                  display="spinner"
                  minuteInterval={5}
                  onChange={(event: any, date?: Date) => {
                    if (date) {
                      setPickerDate(date);
                      const hh = String(date.getHours()).padStart(2, "0");
                      const mm = String(date.getMinutes()).padStart(2, "0");
                      setPickerValue(`${hh}:${mm}`);
                    }
                  }}
                />
              </View>
            ) : (
              /* Android: reloj nativo en diálogo, más estable que el spinner */
              <Pressable
                onPress={openNativeClock}
                style={[
                  styles.clockBtn,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Feather name="clock" size={20} color={ComeYaColors.primary} />
                <ThemedText
                  type="body"
                  style={{ fontWeight: "700", marginLeft: Spacing.sm }}
                >
                  Elegir con el reloj
                </ThemedText>
              </Pressable>
            )}

            {/* Entrada manual para minutos exactos */}
            <View style={styles.manualRow}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                O escribe la hora:
              </ThemedText>
              <TextInput
                value={pickerValue}
                onChangeText={(t) => {
                  const clean = t.replace(/[^0-9:]/g, "").slice(0, 5);
                  setPickerValue(clean);
                }}
                style={[
                  styles.manualInput,
                  { color: theme.text, borderColor: theme.border },
                ]}
                keyboardType="numeric"
                maxLength={5}
                placeholder="09:00"
                placeholderTextColor={theme.textSecondary}
                selectTextOnFocus
              />
            </View>

            <View style={styles.pickerButtons}>
              <Pressable
                onPress={() => setPickerVisible(false)}
                style={[styles.pickerBtn, { borderColor: theme.border, borderWidth: 1 }]}
              >
                <ThemedText type="body" style={{ color: theme.text }}>
                  Cancelar
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={confirmPicker}
                style={[styles.pickerBtn, { backgroundColor: ComeYaColors.primary }]}
              >
                <ThemedText type="body" style={{ color: "#FFF", fontWeight: "700" }}>
                  Confirmar
                </ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

function TimeButton({ label, value, onPress, theme }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.timeBtn, { backgroundColor: theme.backgroundSecondary }]}
    >
      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
        {label}
      </ThemedText>
      <View style={styles.timeBtnValueRow}>
        <Feather name="clock" size={14} color={ComeYaColors.primary} />
        <ThemedText style={{ fontWeight: "700", color: theme.text, fontSize: 16 }}>
          {value}
        </ThemedText>
      </View>
    </Pressable>
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
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  businessSelectorLoading: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
  },
  businessSelector: { padding: Spacing.md, borderRadius: BorderRadius.lg },
  businessChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    maxWidth: 150,
  },
  singleBusinessBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  bulkRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  bulkBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  dayCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  shiftRow: { marginTop: Spacing.sm },
  shiftBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  timePair: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  timeBtn: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  timeBtnValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  addShiftBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.15)",
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  saveBar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  saveButton: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  // ── PICKER MODAL ──
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  pickerCard: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "88%",
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  wheelWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  clockBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  manualRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  manualInput: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 18,
    fontWeight: "700",
    minWidth: 90,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  pickerButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  pickerBtn: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
});
