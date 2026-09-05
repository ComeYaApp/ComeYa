import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useBusiness } from "@/contexts/BusinessContext";

interface ConfigDraft {
  capacityPerSlot: number;
  turnMinutes: number;
  slotMinutes: number;
  maxPartySize: number;
  advanceDays: number;
  autoConfirm: boolean;
  maxCoversPerDay: number | null;
}

const DEFAULT_DRAFT: ConfigDraft = {
  capacityPerSlot: 24,
  turnMinutes: 90,
  slotMinutes: 30,
  maxPartySize: 8,
  advanceDays: 14,
  autoConfirm: true,
  maxCoversPerDay: null,
};

const TURN_OPTIONS = [60, 90, 120];
const SLOT_OPTIONS = [15, 30];

export default function BusinessReservationsSettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { theme } = useTheme();
  const { selectedBusiness } = useBusiness();

  const businessId: string | undefined =
    route.params?.businessId || selectedBusiness?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reservationsEnabled, setReservationsEnabled] = useState(false);
  const [feeCentsPerGuest, setFeeCentsPerGuest] = useState(99);
  const [draft, setDraft] = useState<ConfigDraft>(DEFAULT_DRAFT);
  const [hasCapacity, setHasCapacity] = useState(false);
  const [dayLimitText, setDayLimitText] = useState("");

  const load = useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    try {
      const res = await apiRequest(
        "GET",
        `/api/reservations/business/config?businessId=${businessId}`,
      );
      const data = await res.json();
      if (data.success) {
        setReservationsEnabled(!!data.reservationsEnabled);
        setFeeCentsPerGuest(data.feeCentsPerGuest || 99);
        if (data.config) {
          setHasCapacity(true);
          setDraft({
            capacityPerSlot: data.config.capacityPerSlot,
            turnMinutes: data.config.turnMinutes,
            slotMinutes: data.config.slotMinutes,
            maxPartySize: data.config.maxPartySize,
            advanceDays: data.config.advanceDays,
            autoConfirm: data.config.autoConfirm,
            maxCoversPerDay: data.config.maxCoversPerDay,
          });
          setDayLimitText(
            data.config.maxCoversPerDay
              ? String(data.config.maxCoversPerDay)
              : "",
          );
        } else {
          setHasCapacity(false);
        }
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!businessId) return;
    if (hasCapacity && draft.capacityPerSlot < 1) {
      Alert.alert("Aforo inválido", "Indica cuántos comensales caben a la vez.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        businessId,
        config: {
          ...draft,
          capacityPerSlot: hasCapacity ? draft.capacityPerSlot : 0,
          maxCoversPerDay: hasCapacity && dayLimitText ? Number(dayLimitText) || null : null,
        },
      };
      const res = await apiRequest(
        "PUT",
        "/api/reservations/business/config",
        payload,
      );
      const data = await res.json();
      if (data.success) {
        Alert.alert(
          "Configuración guardada ✅",
          hasCapacity
            ? "Las franjas de reserva se han actualizado con tu aforo."
            : "Modo manual: las reservas volverán a nacer pendientes de confirmar.",
        );
      } else {
        Alert.alert("No se pudo guardar", data.error || "Inténtalo de nuevo");
      }
    } catch {
      Alert.alert("Error", "No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const Stepper = ({
    label,
    hint,
    value,
    onChange,
    min,
    max,
    disabled,
  }: {
    label: string;
    hint?: string;
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    disabled?: boolean;
  }) => (
    <View
      style={[
        styles.fieldCard,
        { backgroundColor: theme.card, opacity: disabled ? 0.5 : 1 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <ThemedText type="body" style={{ fontWeight: "700" }}>{label}</ThemedText>
        {hint ? (
          <ThemedText
            type="caption"
            style={{ color: theme.textSecondary, marginTop: 2 }}
          >
            {hint}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.stepperRow}>
        <Pressable
          style={[
            styles.stepperBtn,
            { borderColor: theme.border },
            disabled || value <= min ? { opacity: 0.4 } : null,
          ]}
          onPress={() => !disabled && onChange(Math.max(min, value - 1))}
          disabled={disabled || value <= min}
        >
          <Feather name="minus" size={16} color={theme.text} />
        </Pressable>
        <ThemedText style={[styles.stepperValue, { fontWeight: "700" }]}>
          {value}
        </ThemedText>
        <Pressable
          style={[
            styles.stepperBtn,
            { borderColor: theme.border },
            disabled || value >= max ? { opacity: 0.4 } : null,
          ]}
          onPress={() => !disabled && onChange(Math.min(max, value + 1))}
          disabled={disabled || value >= max}
        >
          <Feather name="plus" size={16} color={theme.text} />
        </Pressable>
      </View>
    </View>
  );

  const Chip = ({
    label,
    active,
    onPress,
    disabled,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.chip,
        {
          backgroundColor: active ? ComeYaColors.primary : theme.backgroundSecondary,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <ThemedText
        type="small"
        style={{ color: active ? "#FFF" : theme.text, fontWeight: "600" }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );

  if (loading) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      >
        <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h2">Reservas</ThemedText>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={ComeYaColors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Configurar reservas</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {!reservationsEnabled ? (
          <View
            style={[
              styles.noticeCard,
              { backgroundColor: "#F59E0B18", borderColor: "#F59E0B40" },
            ]}
          >
            <Feather name="alert-triangle" size={20} color="#F59E0B" />
            <ThemedText type="small" style={{ flex: 1, marginLeft: Spacing.sm }}>
              Las reservas están desactivadas en "Mis negocios → Servicios del
              negocio". Actívalas para que los clientes puedan reservar mesa.
            </ThemedText>
          </View>
        ) : null}

        <View
          style={[styles.infoCard, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <Feather name="info" size={20} color={ComeYaColors.primary} />
          <ThemedText type="small" style={{ flex: 1, marginLeft: Spacing.sm }}>
            ComeYa genera las horas de reserva desde tu horario de apertura. Con
            aforo configurado, cada franja se cierra sola al llenarse y puedes
            activar la confirmación automática.
          </ThemedText>
        </View>

        {/* Gestionar aforo */}
        <Pressable
          style={[styles.fieldCard, { backgroundColor: theme.card }]}
          onPress={() => setHasCapacity((v) => !v)}
        >
          <View style={{ flex: 1 }}>
            <ThemedText type="body" style={{ fontWeight: "700" }}>Gestionar aforo por franja</ThemedText>
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, marginTop: 2 }}
            >
              Sin aforo, toda reserva nace "pendiente" y la confirmas a mano.
            </ThemedText>
          </View>
          <View
            style={[
              styles.togglePill,
              {
                backgroundColor: hasCapacity
                  ? ComeYaColors.success
                  : theme.backgroundSecondary,
              },
            ]}
          >
            <ThemedText
              style={{
                color: hasCapacity ? "#FFF" : theme.textSecondary,
                fontWeight: "700",
                fontSize: 12,
              }}
            >
              {hasCapacity ? "SÍ" : "NO"}
            </ThemedText>
          </View>
        </Pressable>

        {hasCapacity ? (
          <>
            <Stepper
              label="Comensales a la vez (aforo)"
              hint="Cuántas personas puedes atender simultáneamente en un turno."
              value={draft.capacityPerSlot}
              onChange={(v) => setDraft((d) => ({ ...d, capacityPerSlot: v }))}
              min={1}
              max={200}
            />

            <View style={[styles.fieldCard, { backgroundColor: theme.card }]}>
              <ThemedText type="body" style={{ fontWeight: "700" }}>Duración del turno</ThemedText>
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginTop: 2, marginBottom: Spacing.sm }}
              >
                Cuánto tiempo ocupa una mesa (afecta a la disponibilidad).
              </ThemedText>
              <View style={styles.chipRow}>
                {TURN_OPTIONS.map((t) => (
                  <Chip
                    key={t}
                    label={`${t} min`}
                    active={draft.turnMinutes === t}
                    onPress={() => setDraft((d) => ({ ...d, turnMinutes: t }))}
                  />
                ))}
              </View>
            </View>

            <View style={[styles.fieldCard, { backgroundColor: theme.card }]}>
              <ThemedText type="body" style={{ fontWeight: "700" }}>Intervalo entre horas</ThemedText>
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginTop: 2, marginBottom: Spacing.sm }}
              >
                Cada cuánto se ofrece una hora de reserva.
              </ThemedText>
              <View style={styles.chipRow}>
                {SLOT_OPTIONS.map((s) => (
                  <Chip
                    key={s}
                    label={`Cada ${s} min`}
                    active={draft.slotMinutes === s}
                    onPress={() => setDraft((d) => ({ ...d, slotMinutes: s }))}
                  />
                ))}
              </View>
            </View>

            <Stepper
              label="Máximo por reserva"
              hint="Grupo máximo de comensales aceptado."
              value={draft.maxPartySize}
              onChange={(v) => setDraft((d) => ({ ...d, maxPartySize: v }))}
              min={1}
              max={20}
            />

            <Stepper
              label="Antelación máxima"
              hint="Con cuántos días de antelación se puede reservar."
              value={draft.advanceDays}
              onChange={(v) => setDraft((d) => ({ ...d, advanceDays: v }))}
              min={1}
              max={60}
            />

            <Pressable
              style={[styles.fieldCard, { backgroundColor: theme.card }]}
              onPress={() =>
                setDraft((d) => ({ ...d, autoConfirm: !d.autoConfirm }))
              }
            >
              <View style={{ flex: 1 }}>
                <ThemedText type="body" style={{ fontWeight: "700" }}>Confirmación automática</ThemedText>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary, marginTop: 2 }}
                >
                  Si hay aforo, la reserva se confirma al instante con código.
                  Si lo prefieres, confírmalas tú una a una.
                </ThemedText>
              </View>
              <View
                style={[
                  styles.togglePill,
                  {
                    backgroundColor: draft.autoConfirm
                      ? ComeYaColors.success
                      : theme.backgroundSecondary,
                  },
                ]}
              >
                <ThemedText
                  style={{
                    color: draft.autoConfirm ? "#FFF" : theme.textSecondary,
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {draft.autoConfirm ? "SÍ" : "NO"}
                </ThemedText>
              </View>
            </Pressable>

            <View style={[styles.fieldCard, { backgroundColor: theme.card }]}>
              <ThemedText type="body" style={{ fontWeight: "700" }}>Límite diario (opcional)</ThemedText>
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginTop: 2, marginBottom: Spacing.sm }}
              >
                Tope total de comensales por día (deja vacío para no limitar).
              </ThemedText>
              <TextInput
                value={dayLimitText}
                onChangeText={(t) => setDayLimitText(t.replace(/[^0-9]/g, ""))}
                placeholder="Sin límite"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                style={[
                  styles.dayInput,
                  { color: theme.text, borderColor: theme.border },
                ]}
              />
            </View>
          </>
        ) : null}

        {/* Tarifa */}
        <View
          style={[
            styles.feeCard,
            { backgroundColor: `${ComeYaColors.primary}12` },
          ]}
        >
          <Feather name="credit-card" size={20} color={ComeYaColors.primary} />
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <ThemedText style={{ fontWeight: "700" }}>
              Tarifa ComeYa: {(feeCentsPerGuest / 100).toFixed(2).replace(".", ",")} € por comensal
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }}>
              Solo se cobra por los comensales que realmente asisten (al marcar
              su llegada). Sin cuota de alta, sin permanencia y sin coste por
              cancelaciones o no-shows.
            </ThemedText>
            <Pressable
              onPress={() => (navigation as any).navigate("BusinessFees")}
              style={[
                styles.feeLinkBtn,
                { backgroundColor: `${ComeYaColors.primary}15`, marginTop: Spacing.sm },
              ]}
            >
              <Feather name="credit-card" size={14} color={ComeYaColors.primary} />
              <ThemedText
                type="caption"
                style={{ color: ComeYaColors.primary, marginLeft: 4, fontWeight: "700" }}
              >
                Ver deuda y pagar tarifas
              </ThemedText>
            </Pressable>
          </View>
        </View>

        <Pressable
          onPress={save}
          disabled={saving}
          style={[
            styles.saveBtn,
            { opacity: saving ? 0.7 : 1 },
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Feather name="check" size={18} color="#FFF" />
          )}
          <ThemedText
            style={{ color: "#FFF", marginLeft: Spacing.sm, fontWeight: "700" }}
          >
            Guardar configuración
          </ThemedText>
        </Pressable>
      </ScrollView>
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
  backButton: { width: 44, height: 44, borderRadius: 22, justifyContent: "center" },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  fieldCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  stepperValue: { minWidth: 40, textAlign: "center", fontSize: 16 },
  chipRow: { flexDirection: "row", gap: Spacing.sm, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  togglePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    marginLeft: Spacing.sm,
  },
  dayInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    width: 140,
  },
  feeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  feeLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ComeYaColors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
});
