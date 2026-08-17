import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ComeYaColors, Spacing, BorderRadius } from "../../../constants/theme";
import { apiRequest } from "@/lib/query-client";

interface Props {
  theme: any;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

interface Driver {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isOnline: boolean;
  isActive: boolean;
  isBlocked: boolean;
  blockedReason: string | null;
  strikes: number;
  totalDeliveries: number;
  rating: number | null;
  vehicleType: string | null;
  vehiclePlate: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  currentLatitude: string | null;
  currentLongitude: string | null;
  pendingPayouts: number;
  pendingAmount: number;
}

export const DriversTab: React.FC<Props> = ({ theme, showToast }) => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Driver | null>(null);
  const [processing, setProcessing] = useState(false);
  const [strikeModalVisible, setStrikeModalVisible] = useState(false);
  const [strikeReason, setStrikeReason] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/drivers");
      const data = await res.json();
      setDrivers(data.drivers ?? []);
    } catch {
      showToast("Error al cargar repartidores", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, []);

  const toggleBlock = async (driver: Driver) => {
    const action = driver.isBlocked ? "desbloquear" : "bloquear";
    Alert.alert(
      `${driver.isBlocked ? "Desbloquear" : "Bloquear"} repartidor`,
      `¿Seguro que quieres ${action} a ${driver.name}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          style: driver.isBlocked ? "default" : "destructive",
          onPress: async () => {
            setProcessing(true);
            try {
              const res = await apiRequest(
                "POST",
                `/api/admin/drivers/${driver.id}/${driver.isBlocked ? "unblock" : "block"}`,
              );
              const data = await res.json();
              if (data.success) {
                showToast(`Repartidor ${action}do`, "success");
                setSelected(null);
                load();
              } else {
                showToast(data.error ?? "Error", "error");
              }
            } catch {
              showToast("Error de conexión", "error");
            } finally {
              setProcessing(false);
            }
          },
        },
      ],
    );
  };

  const handleAddStrike = () => {
    setStrikeReason("");
    setStrikeModalVisible(true);
  };

  const confirmAddStrike = async () => {
    if (!strikeReason.trim() || !selected) return;
    setStrikeModalVisible(false);
    setProcessing(true);
    try {
      const res = await apiRequest(
        "POST",
        `/api/admin/drivers/${selected.id}/strike`,
        { reason: strikeReason.trim() },
      );
      const data = await res.json();
      if (data.success) {
        showToast("Strike añadido", "success");
        setSelected({ ...selected, strikes: selected.strikes + 1 });
        load();
      } else {
        showToast(data.error ?? "Error", "error");
      }
    } catch {
      showToast("Error de conexión", "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveStrike = () => {
    if (!selected || selected.strikes === 0) return;
    Alert.alert(
      "Quitar strike",
      `¿Quitar 1 strike a ${selected.name}? Strikes actuales: ${selected.strikes}`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Quitar strike",
          onPress: async () => {
            setProcessing(true);
            try {
              const res = await apiRequest(
                "DELETE",
                `/api/admin/drivers/${selected.id}/strike`,
              );
              const data = await res.json();
              if (data.success) {
                showToast("Strike eliminado", "success");
                setSelected({
                  ...selected,
                  strikes: Math.max(0, selected.strikes - 1),
                });
                load();
              } else {
                showToast(data.error ?? "Error", "error");
              }
            } catch {
              showToast("Error de conexión", "error");
            } finally {
              setProcessing(false);
            }
          },
        },
      ],
    );
  };

  const s = st(theme);

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );
  }

  // ── Detalle del repartidor ─────────────────────────────────────────────────
  if (selected) {
    const ratingDisplay =
      selected.rating != null ? (selected.rating / 10).toFixed(1) : "N/A";
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      >
        <TouchableOpacity style={s.backBtn} onPress={() => setSelected(null)}>
          <Feather name="arrow-left" size={18} color={theme.text} />
          <Text style={[s.backText, { color: theme.text }]}>
            Volver a la lista
          </Text>
        </TouchableOpacity>

        {/* Cabecera */}
        <View style={s.card}>
          <View style={s.row}>
            <View style={[s.avatar, { backgroundColor: "#9C27B020" }]}>
              <Text style={[s.avatarText, { color: "#9C27B0" }]}>
                {selected.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[s.name, { color: theme.text }]}>
                {selected.name}
              </Text>
              {selected.email && (
                <Text style={[s.sub, { color: theme.textSecondary }]}>
                  {selected.email}
                </Text>
              )}
              {selected.phone && (
                <Text style={[s.sub, { color: theme.textSecondary }]}>
                  {selected.phone}
                </Text>
              )}
            </View>
            <View
              style={[
                s.badge,
                {
                  backgroundColor: selected.isOnline
                    ? ComeYaColors.success + "20"
                    : theme.backgroundSecondary,
                },
              ]}
            >
              <Text
                style={[
                  s.badgeText,
                  {
                    color: selected.isOnline
                      ? ComeYaColors.success
                      : theme.textSecondary,
                  },
                ]}
              >
                {selected.isOnline ? "● En línea" : "Desconectado"}
              </Text>
            </View>
          </View>
          {selected.isBlocked && (
            <View
              style={[
                s.alertBox,
                {
                  backgroundColor: ComeYaColors.error + "15",
                  borderColor: ComeYaColors.error + "40",
                },
              ]}
            >
              <Feather
                name="alert-triangle"
                size={14}
                color={ComeYaColors.error}
              />
              <Text
                style={[s.sub, { color: ComeYaColors.error, marginLeft: 6 }]}
              >
                Bloqueado
                {selected.blockedReason ? `: ${selected.blockedReason}` : ""}
              </Text>
            </View>
          )}
        </View>

        {/* Estadísticas */}
        <View
          style={[
            s.card,
            { flexDirection: "row", justifyContent: "space-around" },
          ]}
        >
          <Stat
            label="Entregas"
            value={selected.totalDeliveries}
            color={ComeYaColors.primary}
            theme={theme}
          />
          <Stat
            label="Rating"
            value={ratingDisplay}
            color={ComeYaColors.warning}
            theme={theme}
          />
          <Stat
            label="Strikes"
            value={selected.strikes}
            color={
              selected.strikes > 0 ? ComeYaColors.error : ComeYaColors.success
            }
            theme={theme}
          />
          {selected.pendingPayouts > 0 && (
            <Stat
              label="Pagos pend."
              value={selected.pendingPayouts}
              color={ComeYaColors.warning}
              theme={theme}
            />
          )}
        </View>

        {/* Vehículo */}
        {(selected.vehicleType || selected.vehiclePlate) && (
          <View style={s.card}>
            <Text style={[s.cardTitle, { color: theme.text }]}>Vehículo</Text>
            <View style={s.infoRow}>
              <Feather name="truck" size={14} color={theme.textSecondary} />
              <Text style={[s.sub, { color: theme.text, marginLeft: 8 }]}>
                {selected.vehicleType ?? "—"}
                {selected.vehiclePlate ? ` · ${selected.vehiclePlate}` : ""}
              </Text>
            </View>
          </View>
        )}

        {/* Info adicional */}
        <View style={s.card}>
          <Text style={[s.cardTitle, { color: theme.text }]}>Información</Text>
          <InfoRow
            icon="calendar"
            label="Registrado"
            value={new Date(selected.createdAt).toLocaleDateString("es-ES")}
            theme={theme}
          />
          {selected.lastActiveAt && (
            <InfoRow
              icon="clock"
              label="Última actividad"
              value={new Date(selected.lastActiveAt).toLocaleDateString(
                "es-ES",
              )}
              theme={theme}
            />
          )}
          {selected.pendingAmount > 0 && (
            <InfoRow
              icon="dollar-sign"
              label="Monto pendiente"
              value={`${(selected.pendingAmount / 100).toFixed(2)} €`}
              theme={theme}
              color={ComeYaColors.warning}
            />
          )}
          {selected.currentLatitude && selected.currentLongitude && (
            <InfoRow
              icon="map-pin"
              label="Última ubicación"
              value={`${parseFloat(selected.currentLatitude).toFixed(4)}, ${parseFloat(selected.currentLongitude).toFixed(4)}`}
              theme={theme}
            />
          )}
        </View>

        {/* Acciones */}
        <TouchableOpacity
          style={[
            s.btn,
            {
              backgroundColor: selected.isBlocked
                ? ComeYaColors.success
                : ComeYaColors.error,
            },
          ]}
          onPress={() => toggleBlock(selected)}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Feather
                name={selected.isBlocked ? "unlock" : "lock"}
                size={16}
                color="#FFF"
              />
              <Text style={s.btnText}>
                {selected.isBlocked
                  ? "Desbloquear repartidor"
                  : "Bloquear repartidor"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Strikes */}
        <View style={[s.card, { marginTop: 4 }]}>
          <Text style={[s.cardTitle, { color: theme.text }]}>
            Gestionar strikes ({selected.strikes}/3)
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              style={[
                s.btn,
                { flex: 1, backgroundColor: ComeYaColors.warning },
              ]}
              onPress={handleAddStrike}
              disabled={processing || selected.strikes >= 3}
            >
              <Feather name="alert-triangle" size={15} color="#FFF" />
              <Text style={s.btnText}>Añadir strike</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                s.btn,
                {
                  flex: 1,
                  backgroundColor:
                    selected.strikes > 0
                      ? ComeYaColors.success
                      : theme.backgroundSecondary,
                },
              ]}
              onPress={handleRemoveStrike}
              disabled={processing || selected.strikes === 0}
            >
              <Feather
                name="minus-circle"
                size={15}
                color={selected.strikes > 0 ? "#FFF" : theme.textSecondary}
              />
              <Text
                style={[
                  s.btnText,
                  {
                    color: selected.strikes > 0 ? "#FFF" : theme.textSecondary,
                  },
                ]}
              >
                Quitar strike
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Modal razón del strike */}
        <Modal visible={strikeModalVisible} transparent animationType="slide">
          <View style={s.modalOverlay}>
            <View style={[s.modalCard, { backgroundColor: theme.card }]}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <Text
                  style={[s.cardTitle, { color: theme.text, marginBottom: 0 }]}
                >
                  Razón del strike
                </Text>
                <TouchableOpacity onPress={() => setStrikeModalVisible(false)}>
                  <Feather name="x" size={22} color={theme.text} />
                </TouchableOpacity>
              </View>
              <Text
                style={{
                  color: theme.textSecondary,
                  marginBottom: 12,
                  fontSize: 13,
                }}
              >
                Describe el motivo del strike para {selected.name}. El
                repartidor recibirá una notificación.
              </Text>
              <TextInput
                style={[
                  s.textInput,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                placeholder="Ej: Cancelación injustificada, queja del cliente..."
                placeholderTextColor={theme.textSecondary}
                value={strikeReason}
                onChangeText={setStrikeReason}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[
                  s.btn,
                  {
                    backgroundColor: strikeReason.trim()
                      ? ComeYaColors.warning
                      : theme.backgroundSecondary,
                    marginTop: 12,
                  },
                ]}
                onPress={confirmAddStrike}
                disabled={!strikeReason.trim()}
              >
                <Feather
                  name="alert-triangle"
                  size={15}
                  color={strikeReason.trim() ? "#FFF" : theme.textSecondary}
                />
                <Text
                  style={[
                    s.btnText,
                    {
                      color: strikeReason.trim() ? "#FFF" : theme.textSecondary,
                    },
                  ]}
                >
                  Confirmar strike
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  // ── Lista ──────────────────────────────────────────────────────────────────
  const online = drivers.filter((d) => d.isOnline).length;
  const blocked = drivers.filter((d) => d.isBlocked).length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      {/* Resumen */}
      <View
        style={[
          s.card,
          {
            margin: 16,
            marginBottom: 8,
            flexDirection: "row",
            justifyContent: "space-around",
          },
        ]}
      >
        <Stat
          label="Total"
          value={drivers.length}
          color={ComeYaColors.primary}
          theme={theme}
        />
        <Stat
          label="En línea"
          value={online}
          color={ComeYaColors.success}
          theme={theme}
        />
        <Stat
          label="Bloqueados"
          value={blocked}
          color={blocked > 0 ? ComeYaColors.error : theme.textSecondary}
          theme={theme}
        />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingTop: 8,
          paddingBottom: 100,
        }}
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
        {drivers.length === 0 ? (
          <View style={s.empty}>
            <Feather name="truck" size={48} color={theme.textSecondary} />
            <Text style={[s.emptyText, { color: theme.textSecondary }]}>
              Sin repartidores registrados
            </Text>
          </View>
        ) : (
          drivers.map((driver) => (
            <TouchableOpacity
              key={driver.id}
              style={s.card}
              onPress={() => setSelected(driver)}
            >
              <View style={s.row}>
                <View style={[s.avatarSm, { backgroundColor: "#9C27B015" }]}>
                  <Text
                    style={{
                      color: "#9C27B0",
                      fontWeight: "700",
                      fontSize: 16,
                    }}
                  >
                    {driver.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[s.name, { color: theme.text }]}>
                    {driver.name}
                  </Text>
                  {driver.email && (
                    <Text style={[s.sub, { color: theme.textSecondary }]}>
                      {driver.email}
                    </Text>
                  )}
                  <Text style={[s.sub, { color: theme.textSecondary }]}>
                    {driver.phone ?? "Sin teléfono"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <View
                    style={[
                      s.badge,
                      {
                        backgroundColor: driver.isOnline
                          ? ComeYaColors.success + "20"
                          : theme.backgroundSecondary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.badgeText,
                        {
                          color: driver.isOnline
                            ? ComeYaColors.success
                            : theme.textSecondary,
                        },
                      ]}
                    >
                      {driver.isOnline ? "● Online" : "Offline"}
                    </Text>
                  </View>
                  {driver.isBlocked && (
                    <View
                      style={[
                        s.badge,
                        { backgroundColor: ComeYaColors.error + "20" },
                      ]}
                    >
                      <Text
                        style={[s.badgeText, { color: ComeYaColors.error }]}
                      >
                        Bloqueado
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <View
                style={[
                  s.statsRow,
                  {
                    marginTop: 10,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: theme.border,
                  },
                ]}
              >
                <Text style={[s.statItem, { color: theme.textSecondary }]}>
                  <Text
                    style={{ color: ComeYaColors.primary, fontWeight: "700" }}
                  >
                    {driver.totalDeliveries}
                  </Text>{" "}
                  entregas
                </Text>
                <Text style={[s.statItem, { color: theme.textSecondary }]}>
                  ⭐{" "}
                  <Text style={{ color: theme.text, fontWeight: "600" }}>
                    {driver.rating != null
                      ? (driver.rating / 10).toFixed(1)
                      : "N/A"}
                  </Text>
                </Text>
                <Text
                  style={[
                    s.statItem,
                    {
                      color:
                        driver.strikes > 0
                          ? ComeYaColors.error
                          : theme.textSecondary,
                    },
                  ]}
                >
                  {driver.strikes} strikes
                </Text>
                <Feather
                  name="chevron-right"
                  size={16}
                  color={theme.textSecondary}
                />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
};

function Stat({ label, value, color, theme }: any) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color }}>{value}</Text>
      <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

function InfoRow({ icon, label, value, theme, color }: any) {
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}
    >
      <Feather
        name={icon}
        size={14}
        color={theme.textSecondary}
        style={{ width: 20 }}
      />
      <Text
        style={{
          fontSize: 13,
          color: theme.textSecondary,
          marginLeft: 8,
          flex: 1,
        }}
      >
        {label}
      </Text>
      <Text
        style={{ fontSize: 13, fontWeight: "600", color: color ?? theme.text }}
      >
        {value}
      </Text>
    </View>
  );
}

const st = (theme: any) =>
  StyleSheet.create({
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    card: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      elevation: 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.07,
      shadowRadius: 3,
    },
    cardTitle: { fontSize: 14, fontWeight: "700", marginBottom: 10 },
    row: { flexDirection: "row", alignItems: "center" },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    statItem: { fontSize: 13 },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarSm: {
      width: 42,
      height: 42,
      borderRadius: 21,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: { fontSize: 22, fontWeight: "700" },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    badgeText: { fontSize: 11, fontWeight: "600" },
    name: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
    sub: { fontSize: 12, marginBottom: 1 },
    infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
    alertBox: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 10,
      padding: 8,
      borderRadius: 8,
      borderWidth: 1,
    },
    btn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: 14,
      borderRadius: 10,
      marginTop: 4,
    },
    btnText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 16,
    },
    backText: { fontSize: 14 },
    empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
    emptyText: { fontSize: 15, fontWeight: "600" },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    modalCard: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      paddingBottom: 36,
    },
    textInput: {
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      fontSize: 14,
      minHeight: 80,
    },
  });
