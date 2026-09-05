import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { io, Socket } from "socket.io-client";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useBusiness } from "@/contexts/BusinessContext";
import { useToast } from "@/contexts/ToastContext";
import QRCode from "react-native-qrcode-svg";
import { confirm } from "@/hooks/useWebDialog";

const STATUS_META: Record<string, { label: string; color: string; icon: string }> =
  {
    pending: { label: "Pendiente", color: "#F59E0B", icon: "clock" },
    confirmed: { label: "Confirmada", color: "#10B981", icon: "check-circle" },
    seated: { label: "En la mesa", color: "#3B82F6", icon: "user-check" },
    completed: { label: "Completada", color: "#6B7280", icon: "check" },
    no_show: { label: "No vino", color: "#991B1B", icon: "user-x" },
    rejected: { label: "Rechazada", color: "#EF4444", icon: "x-circle" },
    cancelled: { label: "Cancelada", color: "#6B7280", icon: "slash" },
  };

const OCCASION_META: Record<string, string> = {
  birthday: "🎂 Cumpleaños",
  anniversary: "❤️ Aniversario",
  date: "💍 Cita",
  family: "👨‍👩‍👧 Familiar",
  business: "💼 Negocios",
  celebration: "🎉 Celebración",
};

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default function BusinessReservationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { selectedBusiness } = useBusiness();
  const { showToast } = useToast();
  const [mode, setMode] = useState<"day" | "upcoming">("day");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [reservations, setReservations] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);
  // Radar ComeYa: publicar mesa flash
  const [flashes, setFlashes] = useState<any[]>([]);
  const [showFlashPanel, setShowFlashPanel] = useState(false);
  const [flashTime, setFlashTime] = useState<string | null>(null);
  const [flashParty, setFlashParty] = useState(2);
  const [flashNote, setFlashNote] = useState("");
  const [flashSubmitting, setFlashSubmitting] = useState(false);
  // Pago de cuenta por QR
  const [billFor, setBillFor] = useState<any>(null);
  const [billAmount, setBillAmount] = useState("");
  const [billResult, setBillResult] = useState<any>(null);
  const [billSubmitting, setBillSubmitting] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const days = useMemo(() => {
    const out: { label: string; sub: string; value: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 15; i++) {
      const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const label =
        i === 0 ? "Hoy" : i === 1 ? "Mañana" : d.toLocaleDateString("es-ES", { weekday: "short" });
      out.push({
        label,
        sub: d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }),
        value,
      });
    }
    return out;
  }, []);

  const load = useCallback(async () => {
    try {
      const qs = mode === "day" ? `?date=${selectedDate}` : "";
      const res = await apiRequest("GET", `/api/reservations/business${qs}`);
      const data = await res.json();
      if (data.success) {
        setReservations(data.reservations || []);
        if (mode === "day" && data.summary) {
          const key = selectedBusiness?.id || Object.keys(data.summary)[0];
          setSummary(data.summary[key] || null);
        } else {
          setSummary(null);
        }
      }
      // Mesas flash activas del día (panel de publicación)
      if (mode === "day" && selectedBusiness?.id) {
        try {
          const fRes = await apiRequest(
            "GET",
            `/api/reservations/business/flash?date=${selectedDate}`,
          );
          const fData = await fRes.json();
          setFlashes(fData.success ? fData.flashes || [] : []);
        } catch {
          setFlashes([]);
        }
      } else {
        setFlashes([]);
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mode, selectedDate, selectedBusiness?.id]);

  useEffect(() => {
    setLoading(true);
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  // Tiempo real: nueva reserva o cambio de estado en el negocio seleccionado
  useEffect(() => {
    if (!selectedBusiness?.id) return;
    const socket = io(getApiUrl().replace("/api", ""), {
      transports: ["websocket", "polling"],
    });
    socket.on("connect", () => {
      socket.emit("join", {
        role: "business_owner",
        businessId: selectedBusiness.id,
      });
    });
    socket.on("new_reservation", () => load());
    socket.on("reservation_status_changed", () => load());
    socketRef.current = socket;
    return () => {
      socket.disconnect();
    };
  }, [selectedBusiness?.id, load]);

  const act = async (r: any, status: "confirmed" | "rejected" | "cancelled") => {
    if (status !== "confirmed") {
      const ok = await confirm({
        title:
          status === "rejected" ? "Rechazar reserva" : "Cancelar reserva",
        message: `${r.customerName || "Cliente"} · ${r.time} · ${r.partySize} comensales. El cliente recibirá una notificación.`,
        confirmLabel: status === "rejected" ? "Rechazar" : "Cancelar",
        variant: "danger",
      });
      if (!ok) return;
    }
    setActingId(r.id);
    try {
      const res = await apiRequest(
        "PUT",
        `/api/reservations/business/${r.id}/status`,
        { status, businessNote: noteDraft[r.id] || "" },
      );
      const data = await res.json();
      if (data.success) {
        showToast(
          status === "confirmed"
            ? "Reserva confirmada ✅"
            : status === "rejected"
              ? "Reserva rechazada"
              : "Reserva cancelada",
          "success",
        );
      } else {
        showToast(data.error || "No se pudo gestionar", "error");
      }
      load();
    } catch {
      showToast("No se pudo gestionar la reserva", "error");
    } finally {
      setActingId(null);
    }
  };

  const doAction = async (r: any, action: "arrive" | "no_show" | "close") => {
    if (action === "no_show") {
      const ok = await confirm({
        title: "Marcar como no-show",
        message: `${r.customerName || "Cliente"} no se presentó a las ${r.time}. Sin coste para el negocio ni para el cliente.`,
        confirmLabel: "Marcar no-show",
        variant: "warning",
      });
      if (!ok) return;
    }
    setActingId(r.id);
    try {
      const res = await apiRequest(
        "PUT",
        `/api/reservations/business/${r.id}/action`,
        { action },
      );
      const data = await res.json();
      if (data.success) {
        if (action === "arrive") {
          showToast(
            data.fee?.charged
              ? `Cliente sentado ✅ · Tarifa ${(data.fee.feeCents / 100).toFixed(2).replace(".", ",")} €`
              : "Cliente sentado ✅",
            "success",
          );
        } else if (action === "no_show") {
          showToast("Marcado como no-show", "warning");
        } else {
          showToast("Reserva completada ✅", "success");
        }
      } else {
        showToast(data.error || "No se pudo actualizar", "error");
      }
      load();
    } catch {
      showToast("No se pudo actualizar la reserva", "error");
    } finally {
      setActingId(null);
    }
  };

  const publishFlash = async () => {
    if (!flashTime) {
      showToast("Elige la hora del hueco", "error");
      return;
    }
    setFlashSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/reservations/business/flash", {
        businessId: selectedBusiness?.id,
        date: selectedDate,
        time: flashTime,
        partySize: flashParty,
        note: flashNote.trim() || null,
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          "⚡ Mesa flash publicada 60 min y aviso enviado a la lista de espera",
          "success",
        );
        setShowFlashPanel(false);
        setFlashTime(null);
        setFlashNote("");
        load();
      } else {
        showToast(data.error || "No se pudo publicar", "error");
      }
    } catch {
      showToast("No se pudo publicar la mesa flash", "error");
    } finally {
      setFlashSubmitting(false);
    }
  };

  const cancelFlash = async (flashId: string) => {
    try {
      await apiRequest(
        "POST",
        `/api/reservations/business/flash/${flashId}/cancel`,
        {},
      );
      load();
    } catch {}
  };

  const generateBill = async () => {
    const totalCents = Math.round(Number(billAmount.replace(",", ".")) * 100);
    if (!totalCents || totalCents <= 0) {
      showToast("Introduce el importe de la cuenta", "error");
      return;
    }
    setBillSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/reservations/business/bill", {
        reservationId: billFor.id,
        totalCents,
      });
      const data = await res.json();
      if (data.success) {
        setBillResult(data);
        showToast("Cuenta generada: muéstrale el QR al cliente", "success");
        load();
      } else {
        showToast(data.error || "No se pudo generar la cuenta", "error");
      }
    } catch {
      showToast("No se pudo generar la cuenta", "error");
    } finally {
      setBillSubmitting(false);
    }
  };

  // Agrupar por hora en modo agenda
  const grouped = useMemo(() => {
    if (mode !== "day") return null;
    const map = new Map<string, any[]>();
    for (const r of reservations) {
      const list = map.get(r.time) || [];
      list.push(r);
      map.set(r.time, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([time, items]) => ({ time, items }));
  }, [reservations, mode]);

  const dateLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
    "es-ES",
    { weekday: "long", day: "numeric", month: "long" },
  );

  const ReservationCard = ({ r }: { r: any }) => {
    const meta = STATUS_META[r.status] || STATUS_META.pending;
    return (
      <View
        style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <ThemedText type="h4">{r.customerName || "Cliente"}</ThemedText>
              {r.guestReliability?.reliable ? (
                <View
                  style={[
                    styles.reliableChip,
                    { backgroundColor: "#10B98118" },
                  ]}
                >
                  <Feather name="shield" size={11} color="#10B981" />
                  <ThemedText
                    type="caption"
                    style={{ color: "#10B981", marginLeft: 3, fontWeight: "700" }}
                  >
                    Cliente fiable
                  </ThemedText>
                </View>
              ) : null}
              {r.preOrderId ? (
                <View
                  style={[
                    styles.reliableChip,
                    { backgroundColor: "#3B82F612" },
                  ]}
                >
                  <Feather name="package" size={11} color="#3B82F6" />
                  <ThemedText
                    type="caption"
                    style={{ color: "#3B82F6", marginLeft: 3, fontWeight: "700" }}
                  >
                    Pedido anticipado
                  </ThemedText>
                </View>
              ) : null}
              {r.occasion && OCCASION_META[r.occasion] ? (
                <View
                  style={[
                    styles.reliableChip,
                    { backgroundColor: `${ComeYaColors.primary}12` },
                  ]}
                >
                  <ThemedText type="caption" style={{ color: ComeYaColors.primary, fontWeight: "700" }}>
                    {OCCASION_META[r.occasion]}
                  </ThemedText>
                </View>
              ) : null}
              <View
                style={[
                  styles.partyChip,
                  { backgroundColor: `${ComeYaColors.primary}15` },
                ]}
              >
                <Feather name="users" size={11} color={ComeYaColors.primary} />
                <ThemedText
                  type="caption"
                  style={{ color: ComeYaColors.primary, marginLeft: 3, fontWeight: "700" }}
                >
                  {r.partySize}
                </ThemedText>
              </View>
              {r.code ? (
                <View
                  style={[
                    styles.codeChip,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <ThemedText
                    type="caption"
                    style={{ fontWeight: "800", letterSpacing: 0.5 }}
                  >
                    {r.code}
                  </ThemedText>
                </View>
              ) : null}
            </View>
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, marginTop: 2 }}
            >
              {mode === "day"
                ? r.time
                : `${new Date(`${r.date}T12:00:00`).toLocaleDateString("es-ES", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })} · ${r.time}`}{" "}
              · {r.partySize} comensales
            </ThemedText>
            {mode === "upcoming" && r.businessName ? (
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginTop: 2 }}
              >
                {r.businessName}
              </ThemedText>
            ) : null}
            {r.customerPhone ? (
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginTop: 2 }}
              >
                📞 {r.customerPhone}
              </ThemedText>
            ) : null}
            {r.notes ? (
              <ThemedText type="caption" style={{ color: theme.text, marginTop: 4 }}>
                📝 {r.notes}
              </ThemedText>
            ) : null}
            {r.businessNote ? (
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginTop: 2 }}
              >
                💬 {r.businessNote}
              </ThemedText>
            ) : null}
          </View>
          <View
            style={[styles.statusPill, { backgroundColor: meta.color + "18" }]}
          >
            <Feather name={meta.icon as any} size={12} color={meta.color} />
            <ThemedText
              type="caption"
              style={{ color: meta.color, marginLeft: 4, fontWeight: "700" }}
            >
              {meta.label}
            </ThemedText>
          </View>
        </View>

        {["pending", "confirmed"].includes(r.status) ? (
          <>
            <TextInput
              value={noteDraft[r.id] || ""}
              onChangeText={(t) =>
                setNoteDraft((prev) => ({ ...prev, [r.id]: t }))
              }
              placeholder={
                r.status === "pending"
                  ? "Nota para el cliente (opcional)"
                  : "Motivo de cancelación (opcional)"
              }
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.noteInput,
                { color: theme.text, borderColor: theme.border },
              ]}
            />
            <View style={styles.actionsRow}>
              {r.status === "pending" ? (
                <>
                  <Pressable
                    onPress={() => act(r, "rejected")}
                    disabled={actingId === r.id}
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: theme.backgroundSecondary,
                        opacity: actingId === r.id ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Feather name="x" size={15} color={ComeYaColors.error} />
                    <ThemedText
                      type="small"
                      style={{ color: ComeYaColors.error, marginLeft: 4 }}
                    >
                      Rechazar
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => act(r, "confirmed")}
                    disabled={actingId === r.id}
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: ComeYaColors.success,
                        opacity: actingId === r.id ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Feather name="check" size={15} color="#FFF" />
                    <ThemedText
                      type="small"
                      style={{ color: "#FFF", marginLeft: 4 }}
                    >
                      Confirmar
                    </ThemedText>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    onPress={() => doAction(r, "no_show")}
                    disabled={actingId === r.id}
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: theme.backgroundSecondary,
                        opacity: actingId === r.id ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Feather name="user-x" size={15} color="#991B1B" />
                    <ThemedText
                      type="small"
                      style={{ color: "#991B1B", marginLeft: 4 }}
                    >
                      No vino
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => act(r, "cancelled")}
                    disabled={actingId === r.id}
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: theme.backgroundSecondary,
                        opacity: actingId === r.id ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Feather name="slash" size={15} color={theme.textSecondary} />
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary, marginLeft: 4 }}
                    >
                      Cancelar
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => doAction(r, "arrive")}
                    disabled={actingId === r.id}
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: ComeYaColors.primary,
                        opacity: actingId === r.id ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Feather name="user-check" size={15} color="#FFF" />
                    <ThemedText
                      type="small"
                      style={{ color: "#FFF", marginLeft: 4 }}
                    >
                      ¡Llegó!
                    </ThemedText>
                  </Pressable>
                </>
              )}
            </View>
          </>
        ) : null}

        {r.status === "seated" ? (
          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => {
                setBillFor(r);
                setBillAmount("");
                setBillResult(null);
              }}
              disabled={actingId === r.id}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: theme.backgroundSecondary,
                  opacity: actingId === r.id ? 0.6 : 1,
                },
              ]}
            >
              <Feather name="credit-card" size={15} color={ComeYaColors.primary} />
              <ThemedText
                type="small"
                style={{ color: ComeYaColors.primary, marginLeft: 4 }}
              >
                {r.billId ? "Ver cuenta" : "💳 Cuenta"}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => doAction(r, "close")}
              disabled={actingId === r.id}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: theme.backgroundSecondary,
                  opacity: actingId === r.id ? 0.6 : 1,
                },
              ]}
            >
              <Feather name="check" size={15} color={ComeYaColors.success} />
              <ThemedText
                type="small"
                style={{ color: ComeYaColors.success, marginLeft: 4 }}
              >
                Cerrar mesa
              </ThemedText>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Reservas</ThemedText>
        <Pressable
          onPress={() => (navigation as any).navigate("BusinessReservationsSettings")}
          style={styles.backButton}
        >
          <Feather name="settings" size={22} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {(
          [
            { id: "day", label: "Agenda del día" },
            { id: "upcoming", label: "Próximas" },
          ] as const
        ).map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setMode(f.id)}
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  mode === f.id ? ComeYaColors.primary : theme.backgroundSecondary,
              },
            ]}
          >
            <ThemedText
              type="small"
              style={{
                color: mode === f.id ? "#FFF" : theme.text,
                fontWeight: "600",
              }}
            >
              {f.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {mode === "day" ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateStrip}
        >
          {days.map((d) => {
            const active = d.value === selectedDate;
            return (
              <Pressable
                key={d.value}
                onPress={() => setSelectedDate(d.value)}
                style={[
                  styles.dateChip,
                  {
                    backgroundColor: active ? ComeYaColors.primary : theme.card,
                    borderColor: active ? ComeYaColors.primary : theme.border,
                  },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{
                    color: active ? "#FFF" : theme.textSecondary,
                    textTransform: "capitalize",
                    fontWeight: "600",
                  }}
                >
                  {d.label}
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{
                    color: active ? "#FFF" : theme.text,
                    fontWeight: "700",
                    marginTop: 2,
                  }}
                >
                  {d.sub}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={ComeYaColors.primary}
          />
        }
      >
        {mode === "day" && summary ? (
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: theme.card },
              Shadows.sm,
            ]}
          >
            <View style={{ flex: 1 }}>
              <ThemedText style={{ textTransform: "capitalize", fontWeight: "700" }}>
                {dateLabel}
              </ThemedText>
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginTop: 2 }}
              >
                👥 {summary.totalCovers} comensales reservados
                {summary.hasConfig && summary.capacityPerSlot
                  ? ` · aforo ${summary.capacityPerSlot}/franja`
                  : ""}{" "}
                · {summary.freeSlots} franjas libres
              </ThemedText>
            </View>
            <View style={{ gap: Spacing.xs, alignItems: "flex-end" }}>
              <Pressable
                onPress={() => setShowFlashPanel((v) => !v)}
                style={[styles.configBtn, { backgroundColor: "#F59E0B15" }]}
              >
                <Feather name="radio" size={14} color="#F59E0B" />
                <ThemedText
                  type="caption"
                  style={{ color: "#F59E0B", marginLeft: 4, fontWeight: "700" }}
                >
                  📡 Publicar hueco
                </ThemedText>
              </Pressable>
              {!summary.hasConfig ? (
                <Pressable
                  onPress={() => (navigation as any).navigate("BusinessReservationsSettings")}
                  style={[styles.configBtn, { backgroundColor: `${ComeYaColors.primary}15` }]}
                >
                  <Feather name="sliders" size={14} color={ComeYaColors.primary} />
                  <ThemedText
                    type="caption"
                    style={{ color: ComeYaColors.primary, marginLeft: 4, fontWeight: "700" }}
                  >
                    Aforo
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Radar ComeYa: publicar mesa flash */}
        {showFlashPanel ? (
          <View
            style={[
              styles.flashPanel,
              { backgroundColor: theme.card },
              Shadows.sm,
            ]}
          >
            <ThemedText style={{ fontWeight: "700" }}>
              ⚡ Publicar mesa flash (visible 60 min)
            </ThemedText>
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, marginTop: 2, marginBottom: Spacing.sm }}
            >
              Elige una franja libre: la publicamos y avisamos a la lista de
              espera para llenar el hueco.
            </ThemedText>
            <View style={styles.flashTimes}>
              {(summary?.slots || [])
                .filter((s: any) => !s.isPast && s.status !== "full")
                .slice(0, 12)
                .map((s: any) => {
                  const active = flashTime === s.time;
                  return (
                    <Pressable
                      key={s.time}
                      onPress={() => setFlashTime(s.time)}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: active
                            ? "#F59E0B"
                            : theme.backgroundSecondary,
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{ color: active ? "#FFF" : theme.text, fontWeight: "600" }}
                      >
                        {s.time}
                      </ThemedText>
                    </Pressable>
                  );
                })}
            </View>
            <View style={styles.flashRow}>
              <View style={styles.partyStepper}>
                <Pressable
                  onPress={() => setFlashParty((p) => Math.max(1, p - 1))}
                  style={[styles.flashPartyBtn, { backgroundColor: theme.backgroundSecondary }]}
                >
                  <Feather name="minus" size={14} color={theme.text} />
                </Pressable>
                <ThemedText style={{ fontWeight: "700", marginHorizontal: Spacing.md }}>
                  {flashParty}
                </ThemedText>
                <Pressable
                  onPress={() => setFlashParty((p) => Math.min(20, p + 1))}
                  style={[styles.flashPartyBtn, { backgroundColor: ComeYaColors.primary }]}
                >
                  <Feather name="plus" size={14} color="#FFF" />
                </Pressable>
              </View>
              <TextInput
                value={flashNote}
                onChangeText={setFlashNote}
                placeholder="Nota opcional (p. ej. terraza libre)"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.noteInput,
                  { color: theme.text, borderColor: theme.border, flex: 1 },
                ]}
              />
            </View>
            <Pressable
              onPress={publishFlash}
              disabled={flashSubmitting}
              style={[styles.flashPublish, { opacity: flashSubmitting ? 0.6 : 1 }]}
            >
              <ThemedText style={{ color: "#FFF", fontWeight: "700" }}>
                {flashSubmitting ? "Publicando..." : "⚡ Publicar mesa flash"}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        {/* Mesas flash activas del día */}
        {flashes.length > 0 ? (
          <View
            style={[
              styles.flashPanel,
              { backgroundColor: "#F59E0B0F", borderColor: "#F59E0B44", borderWidth: 1 },
            ]}
          >
            <ThemedText style={{ fontWeight: "700" }}>⚡ Mesas flash activas</ThemedText>
            {flashes.map((f) => (
              <View key={f.id} style={styles.flashItem}>
                <ThemedText type="small" style={{ flex: 1 }}>
                  {f.time} · {f.partySize} {f.partySize === 1 ? "persona" : "personas"}
                  {f.note ? ` · ${f.note}` : ""}
                </ThemedText>
                <Pressable onPress={() => cancelFlash(f.id)} hitSlop={8}>
                  <Feather name="x-circle" size={18} color={ComeYaColors.error} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator
            size="large"
            color={ComeYaColors.primary}
            style={{ marginTop: Spacing.xxl }}
          />
        ) : null}

        {!loading && reservations.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="calendar" size={64} color={theme.textSecondary} />
            <ThemedText
              type="h4"
              style={{ color: theme.textSecondary, marginTop: Spacing.lg }}
            >
              {mode === "day" ? "Sin reservas este día" : "No hay reservas"}
            </ThemedText>
            <ThemedText
              type="small"
              style={{
                color: theme.textSecondary,
                marginTop: Spacing.xs,
                textAlign: "center",
              }}
            >
              Cuando un cliente reserve mesa, aparecerá aquí.
            </ThemedText>
          </View>
        )}

        {grouped
          ? grouped.map((g) => (
              <View key={g.time}>
                <View style={styles.timeHeader}>
                  <Feather name="clock" size={13} color={theme.textSecondary} />
                  <ThemedText style={{ marginLeft: 6, fontWeight: "700" }}>
                    {g.time}
                  </ThemedText>
                  <View
                    style={[styles.timeDivider, { backgroundColor: theme.border }]}
                  />
                </View>
                {g.items.map((r) => (
                  <ReservationCard key={r.id} r={r} />
                ))}
              </View>
            ))
          : reservations.map((r) => <ReservationCard key={r.id} r={r} />)}
      </ScrollView>

      {/* Cuenta con QR para el cliente */}
      {billFor ? (
        <View style={styles.billOverlay}>
          <View style={[styles.billModal, { backgroundColor: theme.card }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <ThemedText type="h3">Cuenta de la mesa</ThemedText>
              <Pressable onPress={() => setBillFor(null)} hitSlop={8}>
                <Feather name="x" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
            {billResult ? (
              <View style={{ alignItems: "center", marginTop: Spacing.md }}>
                <QRCode value={billResult.qrLink} size={180} color={ComeYaColors.primary} backgroundColor="#FFFFFF" />
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                  El cliente escanea y paga con tarjeta desde su app.
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                  {billResult.qrLink}
                </ThemedText>
                <Pressable
                  onPress={() => setBillFor(null)}
                  style={[styles.flashPublish, { alignSelf: "stretch", marginTop: Spacing.md }]}
                >
                  <ThemedText style={{ color: "#FFF", fontWeight: "700" }}>Listo</ThemedText>
                </Pressable>
              </View>
            ) : (
              <View style={{ marginTop: Spacing.md }}>
                <TextInput
                  value={billAmount}
                  onChangeText={setBillAmount}
                  placeholder="Importe total (€)"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                  style={[styles.noteInput, { color: theme.text, borderColor: theme.border }]}
                />
                <Pressable
                  onPress={generateBill}
                  disabled={billSubmitting}
                  style={[styles.flashPublish, { opacity: billSubmitting ? 0.6 : 1 }]}
                >
                  <ThemedText style={{ color: "#FFF", fontWeight: "700" }}>
                    {billSubmitting ? "Generando..." : "💳 Generar cuenta con QR"}
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      ) : null}
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
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  dateStrip: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  dateChip: {
    minWidth: 72,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: "center",
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
    maxWidth: 680,
    width: "100%",
    alignSelf: "center",
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  configBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  flashPanel: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  flashTimes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  flashRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  partyStepper: {
    flexDirection: "row",
    alignItems: "center",
  },
  flashPartyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  flashPublish: {
    backgroundColor: "#F59E0B",
    borderRadius: BorderRadius.md,
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  billOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  billModal: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
  },
  flashItem: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    marginTop: Spacing["4xl"],
  },
  timeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  timeDivider: {
    flex: 1,
    height: 1,
    marginLeft: Spacing.sm,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  reliableChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  partyChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  codeChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    marginTop: Spacing.sm,
  },
  actionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
});
