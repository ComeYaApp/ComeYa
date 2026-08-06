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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
import { Platform } from "react-native";

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

export default function BusinessHoursScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { showToast } = useToast();

  const [myBusinesses, setMyBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);

  const [hours, setHours] = useState<DayHours[]>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Time picker modal — simple, sin grid
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{
    dayIndex: number;
    shift: "morning" | "evening";
    field: "open" | "close";
  } | null>(null);
  const [pickerValue, setPickerValue] = useState("09:00");

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
          setSelectedBusinessId(data.businesses[0].id);
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

  // Normaliza el input del usuario a HH:MM válido
  const normalizeTimeInput = (raw: string): string => {
    const digits = raw.replace(/[^0-9]/g, "");
    if (digits.length === 0) return "00:00";
    if (digits.length <= 2) {
      let h = parseInt(digits, 10);
      if (h > 23) h = 23;
      return `${String(h).padStart(2, "0")}:00`;
    }
    // 3-4 dígitos: HHMM → HH:MM
    const h = Math.min(parseInt(digits.slice(0, -2) || "0", 10), 23);
    const m = Math.min(parseInt(digits.slice(-2), 10), 59);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  // Ajustar hora con botones +/- (saltos de 30 min)
  const adjustTime = (direction: 1 | -1) => {
    const [hRaw, mRaw] = pickerValue.split(":");
    let totalMinutes = parseInt(hRaw) * 60 + parseInt(mRaw);
    totalMinutes += direction * 30;
    if (totalMinutes < 0) totalMinutes = 24 * 60 + totalMinutes;
    if (totalMinutes >= 24 * 60) totalMinutes = totalMinutes - 24 * 60;
    const newH = Math.floor(totalMinutes / 60);
    const newM = totalMinutes % 60;
    setPickerValue(
      `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`,
    );
    Haptics.selectionAsync();
  };

  // Quick presets según si es apertura o cierre
  const getQuickPresets = (field: "open" | "close"): string[] => {
    if (field === "open") return ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "16:00", "18:00", "20:00"];
    return ["12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "23:30", "00:00", "01:00", "02:00"];
  };

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
      </ScrollView>

      {/* ─── TIME PICKER MODAL (estilo simple con input + botones +/-) ─── */}
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
            <ThemedText type="h4" style={{ textAlign: "center", marginBottom: Spacing.lg }}>
              {pickerTarget?.field === "open" ? "Hora de apertura" : "Hora de cierre"}
            </ThemedText>

            {/* Display grande de la hora con botones +/- */}
            <View style={styles.timeAdjustRow}>
              <Pressable
                onPress={() => adjustTime(-1)}
                style={[styles.adjustBtn, { backgroundColor: theme.backgroundSecondary }]}
              >
                <Feather name="minus" size={28} color={theme.text} />
              </Pressable>

              <View style={styles.timeDisplayContainer}>
                <TextInput
                  value={pickerValue}
                  onChangeText={(t) => {
                    const clean = t.replace(/[^0-9:]/g, "").slice(0, 5);
                    setPickerValue(clean);
                  }}
                  style={[styles.timeDisplay, { color: theme.text, borderColor: ComeYaColors.primary }]}
                  keyboardType="numeric"
                  maxLength={5}
                  placeholder="09:00"
                  placeholderTextColor={theme.textSecondary}
                  selectTextOnFocus
                />
              </View>

              <Pressable
                onPress={() => adjustTime(1)}
                style={[styles.adjustBtn, { backgroundColor: theme.backgroundSecondary }]}
              >
                <Feather name="plus" size={28} color={theme.text} />
              </Pressable>
            </View>

            <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "center", marginBottom: Spacing.lg }}>
              Escribe la hora o usa los botones +/- (saltos de 30 min)
            </ThemedText>

            {/* Quick presets */}
            <View style={styles.quickPresetsRow}>
              {getQuickPresets(pickerTarget?.field || "open").map((t) => (
                <Pressable
                  key={t}
                  onPress={() => {
                    setPickerValue(t);
                    Haptics.selectionAsync();
                  }}
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor:
                        pickerValue === t ? ComeYaColors.primary : theme.backgroundSecondary,
                      borderColor:
                        pickerValue === t ? ComeYaColors.primary : theme.border,
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: pickerValue === t ? "#FFF" : theme.text,
                      fontWeight: "600",
                    }}
                  >
                    {t}
                  </ThemedText>
                </Pressable>
              ))}
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
      <ThemedText type="body" style={{ fontWeight: "700", color: theme.text }}>
        {value}
      </ThemedText>
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
  scrollContent: { padding: Spacing.lg, paddingBottom: 100 },
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
  addShiftBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  saveButton: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    marginTop: Spacing.lg,
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
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  timeAdjustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  adjustBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  timeDisplayContainer: {
    alignItems: "center",
  },
  timeDisplay: {
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: 4,
    textAlign: "center",
    borderBottomWidth: 3,
    paddingBottom: 4,
    minWidth: 160,
    fontVariant: ["tabular-nums"],
  },
  quickPresetsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  presetChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
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