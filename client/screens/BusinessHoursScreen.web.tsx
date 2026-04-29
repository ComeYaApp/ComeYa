import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text, Switch, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/contexts/ToastContext";
import { ComeYaColors, Spacing } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useResponsive } from "@/hooks/useResponsive";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";

interface Shift { open: string; close: string; }
interface DayHours { day: string; dayKey: string; isOpen: boolean; morning: Shift; hasEvening: boolean; evening: Shift; }

const DAYS = [
  { key: "monday", label: "Lunes" }, { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miércoles" }, { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" }, { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
];

const DEFAULT_HOURS: DayHours[] = DAYS.map(d => ({
  day: d.label, dayKey: d.key, isOpen: d.key !== "sunday",
  morning: { open: "09:00", close: "16:00" },
  hasEvening: false, evening: { open: "20:00", close: "23:00" },
}));

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) for (const m of [0, 15, 30, 45])
  TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);

export default function BusinessHoursScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { showToast } = useToast();
  const { isMobile } = useResponsive();

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const inputBg = isDark ? "#2a2a2a" : "#f5f5f5";

  const [hours, setHours] = useState<DayHours[]>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ dayIndex: number; shift: "morning" | "evening"; field: "open" | "close" } | null>(null);
  const [pickerValue, setPickerValue] = useState("09:00");

  useEffect(() => {
    apiRequest("GET", "/api/business/hours").then(r => r.json()).then(data => {
      if (data.success && data.hours) {
        setHours(DAYS.map(d => {
          const v = data.hours[d.key];
          if (!v || v.closed) return { ...DEFAULT_HOURS.find(x => x.dayKey === d.key)!, isOpen: false };
          return { day: d.label, dayKey: d.key, isOpen: true, morning: { open: v.open || "09:00", close: v.close || "16:00" }, hasEvening: !!v.eveningOpen, evening: { open: v.eveningOpen || "20:00", close: v.eveningClose || "23:00" } };
        }));
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const update = (i: number, patch: Partial<DayHours>) => setHours(prev => prev.map((h, idx) => idx === i ? { ...h, ...patch } : h));
  const updateShift = (i: number, shift: "morning" | "evening", field: "open" | "close", value: string) =>
    setHours(prev => prev.map((h, idx) => idx === i ? { ...h, [shift]: { ...h[shift], [field]: value } } : h));

  const openPicker = (dayIndex: number, shift: "morning" | "evening", field: "open" | "close") => {
    setPickerTarget({ dayIndex, shift, field });
    setPickerValue(hours[dayIndex][shift][field]);
    setPickerOpen(true);
  };

  const confirmPicker = () => {
    if (pickerTarget) updateShift(pickerTarget.dayIndex, pickerTarget.shift, pickerTarget.field, pickerValue);
    setPickerOpen(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const hoursObj = hours.reduce((acc: any, h) => {
        acc[h.dayKey] = h.isOpen
          ? { open: h.morning.open, close: h.morning.close, closed: false, ...(h.hasEvening ? { eveningOpen: h.evening.open, eveningClose: h.evening.close } : {}) }
          : { closed: true };
        return acc;
      }, {});
      await apiRequest("PUT", "/api/business/hours", { hours: hoursObj });
      showToast("Horarios guardados correctamente", "success");
      navigation.goBack();
    } catch { showToast("Error al guardar horarios", "error"); }
    finally { setSaving(false); }
  };

  const TimeBtn = ({ value, onPress }: { value: string; onPress: () => void }) => (
    <Pressable onPress={onPress} style={[s.timeBtn, { backgroundColor: inputBg, borderColor: border }]}>
      <Feather name="clock" size={14} color={ComeYaColors.primary} />
      <Text style={[s.timeBtnText, { color: text }]}>{value}</Text>
    </Pressable>
  );

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <MobileSidebarWrapper title="Horarios" sidebarStyle={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
        <View style={[s.iconCircle, { backgroundColor: ComeYaColors.primary + "15" }]}>
          <Feather name="clock" size={28} color={ComeYaColors.primary} />
        </View>
        <Text style={[s.sideTitle, { color: text }]}>Horarios</Text>
        <Text style={[s.sideSub, { color: sub }]}>Configura cuándo está abierto tu negocio</Text>

        <View style={[s.legend, { borderColor: border }]}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: ComeYaColors.success }]} />
            <Text style={[s.legendText, { color: sub }]}>Abierto</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: ComeYaColors.error }]} />
            <Text style={[s.legendText, { color: sub }]}>Cerrado</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: "#3F51B5" }]} />
            <Text style={[s.legendText, { color: sub }]}>Turno noche</Text>
          </View>
        </View>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[s.saveBtn, { backgroundColor: ComeYaColors.primary, opacity: saving ? 0.6 : 1 }]}
        >
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Guardar horarios</Text>}
        </Pressable>

        <Pressable onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="arrow-left" size={16} color={text} />
          <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
        </Pressable>
      </MobileSidebarWrapper>

      {/* Main */}
      <ScrollView style={s.main} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={s.loading}><ActivityIndicator color={ComeYaColors.primary} size="large" /></View>
        ) : (
          hours.map((hour, i) => (
            <View key={hour.dayKey} style={[s.dayCard, { backgroundColor: card, borderColor: border }]}>
              <View style={s.dayHeader}>
                <Text style={[s.dayName, { color: text }]}>{hour.day}</Text>
                <View style={s.dayHeaderRight}>
                  <Text style={[s.dayStatus, { color: hour.isOpen ? ComeYaColors.success : ComeYaColors.error }]}>
                    {hour.isOpen ? "Abierto" : "Cerrado"}
                  </Text>
                  <Switch
                    value={hour.isOpen}
                    onValueChange={v => update(i, { isOpen: v })}
                    trackColor={{ false: ComeYaColors.error, true: ComeYaColors.success }}
                    thumbColor="#fff"
                  />
                </View>
              </View>

              {hour.isOpen && (
                <>
                  <View style={s.shiftRow}>
                    <View style={[s.shiftBadge, { backgroundColor: ComeYaColors.primary + "15" }]}>
                      <Feather name="sun" size={13} color={ComeYaColors.primary} />
                      <Text style={[s.shiftLabel, { color: ComeYaColors.primary }]}>Mañana</Text>
                    </View>
                    <View style={s.timePair}>
                      <TimeBtn value={hour.morning.open} onPress={() => openPicker(i, "morning", "open")} />
                      <Feather name="arrow-right" size={14} color={sub} />
                      <TimeBtn value={hour.morning.close} onPress={() => openPicker(i, "morning", "close")} />
                    </View>
                  </View>

                  <Pressable onPress={() => update(i, { hasEvening: !hour.hasEvening })} style={s.addShiftBtn}>
                    <Feather name={hour.hasEvening ? "minus-circle" : "plus-circle"} size={15} color={hour.hasEvening ? ComeYaColors.error : ComeYaColors.primary} />
                    <Text style={[s.addShiftText, { color: hour.hasEvening ? ComeYaColors.error : ComeYaColors.primary }]}>
                      {hour.hasEvening ? "Quitar turno noche" : "Añadir turno tarde/noche"}
                    </Text>
                  </Pressable>

                  {hour.hasEvening && (
                    <View style={s.shiftRow}>
                      <View style={[s.shiftBadge, { backgroundColor: "#3F51B5" + "15" }]}>
                        <Feather name="moon" size={13} color="#3F51B5" />
                        <Text style={[s.shiftLabel, { color: "#3F51B5" }]}>Noche</Text>
                      </View>
                      <View style={s.timePair}>
                        <TimeBtn value={hour.evening.open} onPress={() => openPicker(i, "evening", "open")} />
                        <Feather name="arrow-right" size={14} color={sub} />
                        <TimeBtn value={hour.evening.close} onPress={() => openPicker(i, "evening", "close")} />
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Picker de hora */}
      {pickerOpen && (
        <View style={s.pickerOverlay}>
          <View style={[s.pickerCard, { backgroundColor: card, borderColor: border }]}>
            <Text style={[s.pickerTitle, { color: text }]}>Seleccionar hora</Text>
            <input
              type="time"
              value={pickerValue}
              onChange={e => setPickerValue(e.target.value)}
              style={{ fontSize: 28, fontWeight: "700", border: `2px solid ${ComeYaColors.primary}`, borderRadius: 10, padding: "8px 16px", color: text, backgroundColor: inputBg, marginBottom: 16, width: "100%" }}
            />
            <View style={s.timeGrid}>
              {["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00"].map(t => (
                <Pressable key={t} onPress={() => setPickerValue(t)} style={[s.timeOption, { backgroundColor: pickerValue === t ? ComeYaColors.primary : inputBg }]}>
                  <Text style={{ color: pickerValue === t ? "#fff" : text, fontSize: 13, fontWeight: "600" }}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.pickerBtns}>
              <Pressable onPress={() => setPickerOpen(false)} style={[s.pickerBtn, { borderColor: border, borderWidth: 1 }]}>
                <Text style={{ color: text }}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={confirmPicker} style={[s.pickerBtn, { backgroundColor: ComeYaColors.primary }]}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Confirmar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  sidebar: { width: 260, minWidth: 260, maxWidth: 260, padding: 24, borderRightWidth: 1, paddingTop: 40 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center", alignSelf: "center", marginBottom: 12 },
  sideTitle: { fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 6 },
  sideSub: { fontSize: 12, textAlign: "center", marginBottom: 20, lineHeight: 18 },
  legend: { borderTopWidth: 1, paddingTop: 16, marginBottom: 20, gap: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13 },
  saveBtn: { paddingVertical: 12, borderRadius: 12, alignItems: "center", marginBottom: 8 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, justifyContent: "center" },
  backBtnText: { fontSize: 14, fontWeight: "600" },
  main: { flex: 1 },
  content: { padding: 32, maxWidth: 720 },
  loading: { paddingVertical: 80, alignItems: "center" },
  dayCard: { padding: 20, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  dayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  dayName: { fontSize: 16, fontWeight: "700" },
  dayHeaderRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  dayStatus: { fontSize: 13, fontWeight: "600" },
  shiftRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  shiftBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  shiftLabel: { fontSize: 12, fontWeight: "700" },
  timePair: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  timeBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  timeBtnText: { fontSize: 14, fontWeight: "700" },
  addShiftBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  addShiftText: { fontSize: 13, fontWeight: "600" },
  pickerOverlay: { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" } as any,
  pickerCard: { width: 400, padding: 28, borderRadius: 20, borderWidth: 1 },
  pickerTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  timeOption: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  pickerBtns: { flexDirection: "row", gap: 10 },
  pickerBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
});
