import React, { useState, useEffect } from "react";
import {
  View, StyleSheet, ScrollView, Pressable, Switch,
  Modal, ActivityIndicator, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";

interface Shift {
  open: string;
  close: string;
}

interface DayHours {
  day: string;
  dayKey: string;
  isOpen: boolean;
  morning: Shift;       // Turno mañana
  hasEvening: boolean;  // ¿Tiene turno tarde/noche?
  evening: Shift;       // Turno tarde/noche
}

const DAYS: { key: string; label: string }[] = [
  { key: "monday",    label: "Lunes" },
  { key: "tuesday",   label: "Martes" },
  { key: "wednesday", label: "Miércoles" },
  { key: "thursday",  label: "Jueves" },
  { key: "friday",    label: "Viernes" },
  { key: "saturday",  label: "Sábado" },
  { key: "sunday",    label: "Domingo" },
];

const DEFAULT_HOURS: DayHours[] = DAYS.map((d) => ({
  day: d.label,
  dayKey: d.key,
  isOpen: d.key !== "sunday",
  morning: { open: "09:00", close: "16:00" },
  hasEvening: false,
  evening: { open: "20:00", close: "23:00" },
}));

// Genera opciones de hora cada 15 min
const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 15, 30, 45]) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

export default function BusinessHoursScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { showToast } = useToast();

  const [hours, setHours] = useState<DayHours[]>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Picker de hora
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{
    dayIndex: number;
    shift: "morning" | "evening";
    field: "open" | "close";
  } | null>(null);
  const [pickerValue, setPickerValue] = useState("09:00");

  useEffect(() => { loadHours(); }, []);

  const loadHours = async () => {
    try {
      const res = await apiRequest("GET", "/api/business/hours");
      const data = await res.json();
      if (data.success && data.hours) {
        const parsed: DayHours[] = DAYS.map((d) => {
          const v = data.hours[d.key];
          if (!v || v.closed) {
            return { ...DEFAULT_HOURS.find(x => x.dayKey === d.key)!, isOpen: false };
          }
          return {
            day: d.label,
            dayKey: d.key,
            isOpen: true,
            morning: { open: v.open || "09:00", close: v.close || "16:00" },
            hasEvening: !!v.eveningOpen,
            evening: { open: v.eveningOpen || "20:00", close: v.eveningClose || "23:00" },
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
    setHours(prev => prev.map((h, i) => i === index ? { ...h, ...patch } : h));
  };

  const updateShift = (index: number, shift: "morning" | "evening", field: "open" | "close", value: string) => {
    setHours(prev => prev.map((h, i) => {
      if (i !== index) return h;
      return { ...h, [shift]: { ...h[shift], [field]: value } };
    }));
  };

  const openPicker = (dayIndex: number, shift: "morning" | "evening", field: "open" | "close") => {
    const current = hours[dayIndex][shift][field];
    setPickerTarget({ dayIndex, shift, field });
    setPickerValue(current);
    setPickerVisible(true);
    Haptics.selectionAsync();
  };

  const confirmPicker = () => {
    if (!pickerTarget) return;
    updateShift(pickerTarget.dayIndex, pickerTarget.shift, pickerTarget.field, pickerValue);
    setPickerVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const saveHours = async () => {
    setSaving(true);
    try {
      const hoursObject = hours.reduce((acc: any, h) => {
        acc[h.dayKey] = h.isOpen
          ? {
              open: h.morning.open,
              close: h.morning.close,
              closed: false,
              ...(h.hasEvening ? { eveningOpen: h.evening.open, eveningClose: h.evening.close } : {}),
            }
          : { closed: true };
        return acc;
      }, {});

      await apiRequest("PUT", "/api/business/hours", { hours: hoursObject });
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
      <View style={[styles.container, { justifyContent: "center", alignItems: "center", backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator color={ComeYaColors.primary} size="large" />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[theme.gradientStart || "#FFFFFF", theme.gradientEnd || "#F5F5F5"]}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Horarios de apertura</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {hours.map((hour, index) => (
          <View key={hour.dayKey} style={[styles.dayCard, { backgroundColor: theme.card }, Shadows.sm]}>

            {/* Cabecera del día */}
            <View style={styles.dayHeader}>
              <ThemedText type="h4">{hour.day}</ThemedText>
              <Switch
                value={hour.isOpen}
                onValueChange={(v) => { update(index, { isOpen: v }); Haptics.selectionAsync(); }}
                trackColor={{ false: "#ccc", true: ComeYaColors.primary }}
                thumbColor="#fff"
              />
            </View>

            {hour.isOpen && (
              <>
                {/* Turno mañana */}
                <View style={styles.shiftRow}>
                  <View style={[styles.shiftBadge, { backgroundColor: ComeYaColors.primary + "15" }]}>
                    <Feather name="sun" size={14} color={ComeYaColors.primary} />
                    <ThemedText type="caption" style={{ color: ComeYaColors.primary, marginLeft: 4, fontWeight: "600" }}>
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

                {/* Toggle turno tarde/noche */}
                <Pressable
                  onPress={() => { update(index, { hasEvening: !hour.hasEvening }); Haptics.selectionAsync(); }}
                  style={styles.addShiftBtn}
                >
                  <Feather
                    name={hour.hasEvening ? "minus-circle" : "plus-circle"}
                    size={16}
                    color={hour.hasEvening ? ComeYaColors.error : ComeYaColors.primary}
                  />
                  <ThemedText type="small" style={{ color: hour.hasEvening ? ComeYaColors.error : ComeYaColors.primary, marginLeft: 6 }}>
                    {hour.hasEvening ? "Quitar turno noche" : "Añadir turno tarde/noche"}
                  </ThemedText>
                </Pressable>

                {/* Turno tarde/noche */}
                {hour.hasEvening && (
                  <View style={styles.shiftRow}>
                    <View style={[styles.shiftBadge, { backgroundColor: "#3F51B5" + "15" }]}>
                      <Feather name="moon" size={14} color="#3F51B5" />
                      <ThemedText type="caption" style={{ color: "#3F51B5", marginLeft: 4, fontWeight: "600" }}>
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
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                Cerrado
              </ThemedText>
            )}
          </View>
        ))}

        <Pressable
          onPress={saveHours}
          disabled={saving}
          style={[styles.saveButton, { backgroundColor: ComeYaColors.primary, opacity: saving ? 0.7 : 1 }]}
        >
          {saving
            ? <ActivityIndicator color="#FFF" />
            : <ThemedText type="body" style={{ color: "#FFF", fontWeight: "700" }}>Guardar horarios</ThemedText>
          }
        </Pressable>
      </ScrollView>

      {/* Modal picker de hora */}
      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setPickerVisible(false)}>
          <View style={[styles.pickerCard, { backgroundColor: theme.card }]}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>Seleccionar hora</ThemedText>

            {/* Input manual */}
            <View style={[styles.timeInputBox, { borderColor: ComeYaColors.primary, backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="clock" size={20} color={ComeYaColors.primary} />
              <TextInput
                value={pickerValue}
                onChangeText={(t) => {
                  // Permitir solo formato HH:MM
                  const clean = t.replace(/[^0-9:]/g, "").slice(0, 5);
                  setPickerValue(clean);
                }}
                style={[styles.timeInputText, { color: theme.text }]}
                keyboardType="numeric"
                placeholder="HH:MM"
                placeholderTextColor={theme.textSecondary}
                maxLength={5}
              />
            </View>

            {/* Opciones rápidas */}
            <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
              <View style={styles.timeGrid}>
                {TIME_OPTIONS.map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => { setPickerValue(t); Haptics.selectionAsync(); }}
                    style={[
                      styles.timeOption,
                      { backgroundColor: pickerValue === t ? ComeYaColors.primary : theme.backgroundSecondary },
                    ]}
                  >
                    <ThemedText type="small" style={{ color: pickerValue === t ? "#FFF" : theme.text, fontWeight: "600" }}>
                      {t}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <View style={styles.pickerButtons}>
              <Pressable onPress={() => setPickerVisible(false)} style={[styles.pickerBtn, { borderColor: theme.border, borderWidth: 1 }]}>
                <ThemedText type="body" style={{ color: theme.text }}>Cancelar</ThemedText>
              </Pressable>
              <Pressable onPress={confirmPicker} style={[styles.pickerBtn, { backgroundColor: ComeYaColors.primary }]}>
                <ThemedText type="body" style={{ color: "#FFF", fontWeight: "700" }}>Confirmar</ThemedText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

function TimeButton({ label, value, onPress, theme }: any) {
  return (
    <Pressable onPress={onPress} style={[styles.timeBtn, { backgroundColor: theme.backgroundSecondary }]}>
      <ThemedText type="caption" style={{ color: theme.textSecondary }}>{label}</ThemedText>
      <ThemedText type="body" style={{ fontWeight: "700", color: theme.text }}>{value}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  scrollContent: { padding: Spacing.lg, paddingBottom: 100 },
  dayCard: { padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.md },
  dayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  shiftRow: { marginTop: Spacing.sm },
  shiftBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.sm, marginBottom: Spacing.sm },
  timePair: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  timeBtn: { flex: 1, padding: Spacing.sm, borderRadius: BorderRadius.md, alignItems: "center" },
  addShiftBtn: { flexDirection: "row", alignItems: "center", marginTop: Spacing.md, paddingVertical: Spacing.xs },
  saveButton: { padding: Spacing.lg, borderRadius: BorderRadius.lg, alignItems: "center", marginTop: Spacing.lg },
  pickerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  pickerCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.xl },
  timeInputBox: { flexDirection: "row", alignItems: "center", borderWidth: 2, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 52, marginBottom: Spacing.md, gap: Spacing.sm },
  timeInputText: { flex: 1, fontSize: 24, fontWeight: "700", letterSpacing: 2 },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.lg },
  timeOption: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md },
  pickerButtons: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.md },
  pickerBtn: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: "center" },
});
