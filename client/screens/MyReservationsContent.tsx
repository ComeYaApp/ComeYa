import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
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
import { useAuth } from "@/contexts/AuthContext";

const STATUS_META: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  pending: { label: "Pendiente de confirmar", color: "#F59E0B", icon: "clock" },
  confirmed: { label: "Confirmada", color: "#10B981", icon: "check-circle" },
  seated: { label: "Estás en la mesa", color: "#3B82F6", icon: "user-check" },
  completed: { label: "Completada", color: "#6B7280", icon: "check" },
  no_show: { label: "No asististe", color: "#991B1B", icon: "user-x" },
  rejected: { label: "Rechazada", color: "#EF4444", icon: "x-circle" },
  cancelled: { label: "Cancelada", color: "#6B7280", icon: "slash" },
  // El restaurante no llegó a confirmarla antes de la hora reservada.
  expired: { label: "Caducada", color: "#6B7280", icon: "clock" },
};

const OCCASION_LABELS: Record<string, string> = {
  birthday: "🎂 Cumpleaños",
  anniversary: "❤️ Aniversario",
  date: "💍 Cita",
  family: "👨‍👩‍👧 Familiar",
  business: "💼 Negocios",
  celebration: "🎉 Celebración",
};

export default function MyReservationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [reservations, setReservations] = useState<any[]>([]);
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Activas = pendiente/confirmada/sentada (pueden ser varias a la vez) y
  // SIEMPRE de hoy en adelante. Una reserva cuya hora ya pasó deja de ser
  // "activa" aunque el servidor todavía no la haya cerrado (el cron lo hace
  // cada 15 min), así no se queda para siempre en la lista.
  const ACTIVE_RES_STATUSES = ["pending", "confirmed", "seated"];
  const isStillActive = useCallback((r: any) => {
    if (!ACTIVE_RES_STATUSES.includes(r.status)) return false;
    const d = new Date(`${r.date}T${(r.time || "00:00").slice(0, 5)}:00`);
    if (Number.isNaN(d.getTime())) return true;
    // Se mantiene visible hasta 2 h después (turno + margen): mientras
    // estás en la mesa la reserva sigue siendo la tuya.
    return d.getTime() + 120 * 60 * 1000 > Date.now();
  }, []);

  const visibleReservations = showHistory
    ? reservations
    : reservations.filter((r: any) => isStillActive(r));

  // Reservas entre amigos
  const [shareFor, setShareFor] = useState<any>(null);
  const [shareData, setShareData] = useState<any>(null);

  const openShare = async (r: any) => {
    setShareFor(r);
    setShareData(null);
    try {
      const sRes = await apiRequest("POST", `/api/reservations/${r.id}/share`, {});
      const sData = await sRes.json();
      const pRes = await apiRequest("GET", `/api/reservations/${r.id}/participants`);
      const pData = await pRes.json();
      setShareData({
        link: sData.link,
        webLink: sData.webLink,
        participants: pData.participants || [],
        partySize: r.partySize,
      });
    } catch {
      Alert.alert("Error", "No se pudo generar el enlace");
      setShareFor(null);
    }
  };

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/reservations/mine");
      const data = await res.json();
      if (data.success) setReservations(data.reservations || []);
      // Avisos de mesa (lista de espera)
      try {
        const wRes = await apiRequest("GET", "/api/reservations/waitlist/mine");
        const wData = await wRes.json();
        if (wData.success) setWaitlist(wData.entries || []);
      } catch {
        setWaitlist([]);
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Tiempo real: en cuanto el restaurante confirma (o rechaza) la reserva,
  // la lista se refresca sola. Antes el cliente dependía solo del push y, si
  // lo tenía silenciado, seguía viendo "Pendiente" hasta reabrir la pantalla.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    let socket: any = null;
    (async () => {
      try {
        const { getAuthToken, getApiUrl } = await import("@/lib/query-client");
        const { io } = await import("socket.io-client");
        const token = await getAuthToken();
        if (cancelled) return;
        socket = io(getApiUrl(), {
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionDelay: 1000,
          auth: { token: token ?? undefined },
        });
        socket.on("connect", () => {
          socket.emit("join", { userId: user.id, role: "customer" });
        });
        socket.on("reservation_status_changed", () => load());
      } catch {
        // sin socket: la lista se refresca al abrir la pantalla
      }
    })();
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [load, user?.id]);

  const cancelReservation = (r: any) => {
    Alert.alert(
      "Cancelar reserva",
      `¿Cancelar la reserva del ${r.date} a las ${r.time}?`,
      [
        { text: "Volver", style: "cancel" },
        {
          text: "Sí, cancelar",
          style: "destructive",
          onPress: async () => {
            setCancellingId(r.id);
            try {
              const res = await apiRequest(
                "POST",
                `/api/reservations/${r.id}/cancel`,
                {},
              );
              const data = await res.json();
              if (data.success) {
                Alert.alert("Reserva cancelada", data.message);
              } else {
                Alert.alert("No se pudo cancelar", data.error || "");
              }
              load();
            } catch {
              Alert.alert("Error", "No se pudo cancelar la reserva");
            } finally {
              setCancellingId(null);
            }
          },
        },
      ],
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
        <ThemedText type="h2">Mis reservas</ThemedText>
        <View style={{ width: 44 }} />
      </View>

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
        {!loading && waitlist.length > 0 && (
          <View style={[styles.waitlistSection, { backgroundColor: "#F59E0B10", borderColor: "#F59E0B44" }]}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>
              🔔 Avisos de mesa activados
            </ThemedText>
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}
            >
              Te avisaremos si se libera una mesa o el negocio publica un hueco.
              ¡Reserva rápido cuando llegue el aviso!
            </ThemedText>
            {waitlist.map((w: any) => (
              <View key={w.id} style={styles.waitlistRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="small" style={{ fontWeight: "700" }}>
                    {w.businessName}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {w.date} · {w.time} · {w.partySize} {w.partySize === 1 ? "persona" : "personas"}
                    {w.status === "notified" ? " · ⚡ ¡hay hueco, corre!" : ""}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={async () => {
                    await apiRequest(
                      "POST",
                      `/api/reservations/waitlist/${w.id}/cancel`,
                      {},
                    );
                    load();
                  }}
                  hitSlop={8}
                >
                  <Feather name="x-circle" size={18} color={theme.textSecondary} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Solo reservas ACTIVAS por defecto (feedback del cliente): el
            historial queda a un toque */}
        {reservations.length > 0 && (
          <View style={styles.historyToggleRow}>
            {[
              { key: false, label: "Activas" },
              { key: true, label: "Historial" },
            ].map((tab) => (
              <Pressable
                key={String(tab.key)}
                onPress={() => {
                  setShowHistory(tab.key);
                  Haptics.selectionAsync();
                }}
                style={[
                  styles.historyToggle,
                  {
                    backgroundColor:
                      showHistory === tab.key
                        ? ComeYaColors.primary
                        : theme.backgroundSecondary,
                  },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{
                    color: showHistory === tab.key ? "#FFF" : theme.text,
                    fontWeight: "700",
                  }}
                >
                  {tab.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        )}

        {!loading && visibleReservations.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="calendar" size={64} color={theme.textSecondary} />
            <ThemedText
              type="h4"
              style={{ color: theme.textSecondary, marginTop: Spacing.lg }}
            >
              No tienes reservas todavía
            </ThemedText>
            <ThemedText
              type="small"
              style={{
                color: theme.textSecondary,
                marginTop: Spacing.xs,
                textAlign: "center",
              }}
            >
              Abre la pestaña Reservar de la inicio, elige un restaurante,
              día y hora, y pulsa "Enviar reserva" (el botón rojo fijo abajo
              del todo). También puedes pedir platos por adelantado y reservar
              con "Reservar y pedir".
            </ThemedText>
          </View>
        )}

        {visibleReservations.map((r: any) => {
          const meta = STATUS_META[r.status] || STATUS_META.pending;
          const cancellable =
            (r.status === "pending" || r.status === "confirmed") &&
            r.date >= new Date().toISOString().slice(0, 10);
          return (
            <View
              key={r.id}
              style={[
                styles.card,
                { backgroundColor: theme.card },
                Shadows.sm,
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="h4">{r.businessName || "Negocio"}</ThemedText>
                  {r.businessAddress ? (
                    <ThemedText
                      type="caption"
                      style={{ color: theme.textSecondary, marginTop: 2 }}
                    >
                      {r.businessAddress}
                    </ThemedText>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: meta.color + "18" },
                  ]}
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

              <View style={styles.infoRow}>
                <Feather name="calendar" size={14} color={theme.textSecondary} />
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}
                >
                  {new Date(`${r.date}T00:00:00`).toLocaleDateString("es-ES", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}{" "}
                  a las {r.time}
                </ThemedText>
              </View>
              <View style={styles.infoRow}>
                <Feather name="users" size={14} color={theme.textSecondary} />
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}
                >
                  {r.partySize} comensales
                </ThemedText>
              </View>
              {r.occasion && OCCASION_LABELS[r.occasion] ? (
                <View style={styles.infoRow}>
                  <Feather name="gift" size={14} color={ComeYaColors.primary} />
                  <ThemedText
                    type="small"
                    style={{ color: ComeYaColors.primary, marginLeft: Spacing.xs, fontWeight: "700" }}
                  >
                    {OCCASION_LABELS[r.occasion]}
                  </ThemedText>
                </View>
              ) : null}
              {r.code && ["confirmed", "seated"].includes(r.status) ? (
                <View style={[styles.codeBox, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="key" size={13} color={ComeYaColors.primary} />
                  <ThemedText
                    type="small"
                    style={{
                      color: ComeYaColors.primary,
                      marginLeft: Spacing.xs,
                      fontWeight: "800",
                      letterSpacing: 0.5,
                    }}
                  >
                    Código {r.code}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}
                  >
                    Muéstralo al llegar
                  </ThemedText>
                </View>
              ) : null}
              {r.businessNote ? (
                <View style={styles.businessNote}>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.text, fontWeight: "600" }}
                  >
                    Nota del negocio: {r.businessNote}
                  </ThemedText>
                </View>
              ) : null}

              {["confirmed", "seated"].includes(r.status) && r.billId ? (
                <Pressable
                  onPress={() =>
                    (navigation as any).navigate("BillPayment", { billId: r.billId })
                  }
                  style={[
                    styles.preOrderBtn,
                    { borderColor: "#3B82F6", marginTop: Spacing.md, backgroundColor: "#3B82F612" },
                  ]}
                >
                  <Feather name="credit-card" size={14} color="#3B82F6" />
                  <ThemedText type="small" style={{ color: "#3B82F6", marginLeft: 4, fontWeight: "700" }}>
                    💳 Pagar cuenta
                  </ThemedText>
                </Pressable>
              ) : null}
              {["confirmed", "seated"].includes(r.status) ? (
                <Pressable
                  onPress={() => openShare(r)}
                  style={[
                    styles.preOrderBtn,
                    { borderColor: ComeYaColors.primary, marginTop: Spacing.sm },
                  ]}
                >
                  <Feather name="users" size={14} color={ComeYaColors.primary} />
                  <ThemedText type="small" style={{ color: ComeYaColors.primary, marginLeft: 4, fontWeight: "600" }}>
                    👥 Invitar amigos
                  </ThemedText>
                </Pressable>
              ) : null}

              {cancellable && (
                <Pressable
                  onPress={() => cancelReservation(r)}
                  disabled={cancellingId === r.id}
                  style={[
                    styles.cancelBtn,
                    {
                      borderColor: ComeYaColors.error,
                      opacity: cancellingId === r.id ? 0.6 : 1,
                    },
                  ]}
                >
                  <Feather name="x-circle" size={14} color={ComeYaColors.error} />
                  <ThemedText
                    type="small"
                    style={{ color: ComeYaColors.error, marginLeft: 4 }}
                  >
                    {cancellingId === r.id ? "Cancelando..." : "Cancelar reserva"}
                  </ThemedText>
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Invitar amigos */}
      <Modal
        visible={!!shareFor}
        transparent
        animationType="slide"
        onRequestClose={() => setShareFor(null)}
      >
        <View style={styles.preOverlay}>
          <View style={[styles.preModal, { backgroundColor: theme.card }]}>
            <View style={styles.preHeader}>
              <ThemedText type="h3">Invitar amigos</ThemedText>
              <Pressable onPress={() => setShareFor(null)}>
                <Feather name="x" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
            {shareData ? (
              <>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Comparte este enlace: cada amigo confirma y la mesa se llena sola.
                </ThemedText>
                <View style={[styles.linkBox, { backgroundColor: theme.backgroundSecondary }]}>
                  <ThemedText type="small" style={{ flex: 1 }} numberOfLines={2}>
                    {shareData.webLink}
                  </ThemedText>
                  <Pressable
                    onPress={() => {
                      try {
                        require("react-native").Clipboard.setString(shareData.webLink);
                        Alert.alert("Enlace copiado", "Pégalo donde quieras");
                      } catch {}
                    }}
                    hitSlop={8}
                  >
                    <Feather name="copy" size={16} color={ComeYaColors.primary} />
                  </Pressable>
                </View>
                <ThemedText type="small" style={{ fontWeight: "700", marginTop: Spacing.md }}>
                  Confirmados: {shareData.participants.filter((p: any) => p.status === "confirmed").length}/{shareData.partySize}
                </ThemedText>
                {shareData.participants.map((p: any) => (
                  <View key={p.id} style={styles.pRow}>
                    <Feather
                      name={p.status === "confirmed" ? "check-circle" : "x-circle"}
                      size={14}
                      color={p.status === "confirmed" ? "#10B981" : theme.textSecondary}
                    />
                    <ThemedText type="small" style={{ marginLeft: 6 }}>{p.name}</ThemedText>
                  </View>
                ))}
              </>
            ) : (
              <ActivityIndicator color={ComeYaColors.primary} style={{ marginTop: Spacing.md }} />
            )}
          </View>
        </View>
      </Modal>
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
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  historyToggleRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  historyToggle: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  emptyState: {
    alignItems: "center",
    marginTop: Spacing["4xl"],
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  waitlistSection: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  waitlistRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  businessNote: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(245,158,11,0.1)",
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  preOrderBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  preOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  preModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    maxHeight: "80%",
  },
  preHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  preRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  preStep: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  preSubmit: {
    backgroundColor: ComeYaColors.primary,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
  },
  linkBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  pRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
});
