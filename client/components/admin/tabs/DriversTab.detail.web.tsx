import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ComeYaColors } from "../../../constants/theme";
import { apiRequest } from "@/lib/query-client";
import { Driver } from "./DriversTab.web";

const PRIMARY = "#DC2626";
const PURPLE = "#8B5CF6";

interface Props {
  driver: Driver;
  isDark: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onUpdate: (d: Driver) => void;
}

export function DriverDetail({
  driver,
  isDark,
  onClose,
  onRefresh,
  onUpdate,
}: Props) {
  const [processing, setProcessing] = useState(false);
  const [strikeReason, setStrikeReason] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [showStrikeForm, setShowStrikeForm] = useState(false);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const card = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#ebebeb";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#666" : "#aaa";
  const inputBg = isDark ? "#222" : "#f8f8f8";

  const flash = (ok: boolean, msg: string) => {
    setMsg({ ok, text: msg });
    setTimeout(() => setMsg(null), 3000);
  };

  const doBlock = async () => {
    setProcessing(true);
    try {
      const endpoint = driver.isBlocked ? "unblock" : "block";
      const body = driver.isBlocked
        ? {}
        : { reason: blockReason.trim() || "Bloqueado por administrador" };
      const res = await apiRequest(
        "POST",
        `/api/admin/drivers/${driver.id}/${endpoint}`,
        body,
      );
      const data = await res.json();
      if (data.success) {
        flash(
          true,
          driver.isBlocked ? "Repartidor desbloqueado" : "Repartidor bloqueado",
        );
        onUpdate({
          ...driver,
          isBlocked: !driver.isBlocked,
          blockedReason: body.reason ?? null,
        });
        setShowBlockForm(false);
        setBlockReason("");
      } else {
        flash(false, data.error ?? "Error");
      }
    } catch {
      flash(false, "Error de conexión");
    } finally {
      setProcessing(false);
    }
  };

  const addStrike = async () => {
    if (!strikeReason.trim()) return;
    setProcessing(true);
    try {
      const res = await apiRequest(
        "POST",
        `/api/admin/drivers/${driver.id}/strike`,
        { reason: strikeReason.trim() },
      );
      const data = await res.json();
      if (data.success) {
        flash(true, "Strike añadido");
        onUpdate({ ...driver, strikes: driver.strikes + 1 });
        setShowStrikeForm(false);
        setStrikeReason("");
      } else {
        flash(false, data.error ?? "Error");
      }
    } catch {
      flash(false, "Error de conexión");
    } finally {
      setProcessing(false);
    }
  };

  const removeStrike = async () => {
    if (driver.strikes === 0) return;
    if (
      !window.confirm(
        `¿Quitar 1 strike a ${driver.name}? Strikes actuales: ${driver.strikes}`,
      )
    )
      return;
    setProcessing(true);
    try {
      const res = await apiRequest(
        "DELETE",
        `/api/admin/drivers/${driver.id}/strike`,
      );
      const data = await res.json();
      if (data.success) {
        flash(true, "Strike eliminado");
        onUpdate({ ...driver, strikes: Math.max(0, driver.strikes - 1) });
      } else {
        flash(false, data.error ?? "Error");
      }
    } catch {
      flash(false, "Error de conexión");
    } finally {
      setProcessing(false);
    }
  };

  const ratingDisplay =
    driver.rating != null ? (driver.rating / 10).toFixed(1) : "N/A";
  const statusColor = driver.isBlocked
    ? "#EF4444"
    : driver.isOnline
      ? "#10B981"
      : sub;
  const statusLabel = driver.isBlocked
    ? "Bloqueado"
    : driver.isOnline
      ? "En línea"
      : "Offline";

  return (
    <View
      style={[det.panel, { backgroundColor: card, borderLeftColor: border }]}
    >
      {/* Header */}
      <View style={[det.header, { borderBottomColor: border }]}>
        <View style={[det.avatar, { backgroundColor: PURPLE + "20" }]}>
          <Text style={[det.avatarTxt, { color: PURPLE }]}>
            {driver.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[det.name, { color: text }]} numberOfLines={1}>
            {driver.name}
          </Text>
          <View style={[det.statusRow]}>
            <View style={[det.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[det.statusTxt, { color: statusColor }]}>
              {statusLabel}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} style={det.closeBtn}>
          <Feather name="x" size={18} color={sub} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Alerta bloqueado */}
        {driver.isBlocked && (
          <View
            style={[
              det.alertBox,
              { backgroundColor: "#EF444415", borderColor: "#EF444430" },
            ]}
          >
            <Feather name="alert-triangle" size={14} color="#EF4444" />
            <Text style={[det.alertTxt, { color: "#EF4444" }]}>
              Bloqueado{driver.blockedReason ? `: ${driver.blockedReason}` : ""}
            </Text>
          </View>
        )}

        {/* Feedback */}
        {msg && (
          <View
            style={[
              det.msgBox,
              { backgroundColor: msg.ok ? "#10B98115" : "#EF444415" },
            ]}
          >
            <Feather
              name={msg.ok ? "check-circle" : "alert-circle"}
              size={13}
              color={msg.ok ? "#10B981" : "#EF4444"}
            />
            <Text
              style={[det.msgTxt, { color: msg.ok ? "#10B981" : "#EF4444" }]}
            >
              {msg.text}
            </Text>
          </View>
        )}

        {/* Stats */}
        <View style={[det.statsGrid, { borderColor: border }]}>
          {[
            { label: "Entregas", value: driver.totalDeliveries, color: PURPLE },
            { label: "Rating", value: ratingDisplay, color: "#F59E0B" },
            {
              label: "Strikes",
              value: `${driver.strikes}/3`,
              color: driver.strikes > 0 ? "#EF4444" : "#10B981",
            },
            {
              label: "Pend. pago",
              value:
                driver.pendingPayouts > 0 ? `${driver.pendingPayouts}` : "0",
              color: driver.pendingPayouts > 0 ? "#F59E0B" : sub,
            },
          ].map((s) => (
            <View
              key={s.label}
              style={[
                det.statCard,
                {
                  backgroundColor: s.color + "10",
                  borderColor: s.color + "20",
                },
              ]}
            >
              <Text style={[det.statVal, { color: s.color }]}>{s.value}</Text>
              <Text style={[det.statLbl, { color: sub }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Contacto */}
        <View
          style={[
            det.section,
            {
              backgroundColor: isDark ? "#222" : "#f8f8f8",
              borderColor: border,
            },
          ]}
        >
          <Text style={[det.sectionTitle, { color: sub }]}>CONTACTO</Text>
          {[
            { icon: "phone", value: driver.phone ?? "—" },
            { icon: "mail", value: driver.email ?? "—" },
          ].map((r) => (
            <View key={r.icon} style={det.infoRow}>
              <Feather name={r.icon as any} size={13} color={sub} />
              <Text style={[det.infoVal, { color: text }]}>{r.value}</Text>
            </View>
          ))}
        </View>

        {/* Vehículo */}
        <View
          style={[
            det.section,
            {
              backgroundColor: isDark ? "#222" : "#f8f8f8",
              borderColor: border,
            },
          ]}
        >
          <Text style={[det.sectionTitle, { color: sub }]}>VEHÍCULO</Text>
          {[
            { icon: "truck", label: "Tipo", value: driver.vehicleType ?? "—" },
            {
              icon: "hash",
              label: "Matrícula",
              value: driver.vehiclePlate ?? "—",
            },
            { icon: "box", label: "Marca", value: driver.vehicleBrand ?? "—" },
            {
              icon: "settings",
              label: "Modelo",
              value: driver.vehicleModel ?? "—",
            },
            {
              icon: "droplet",
              label: "Color",
              value: driver.vehicleColor ?? "—",
            },
          ].map((r) => (
            <View key={r.label} style={det.infoRow}>
              <Feather name={r.icon as any} size={13} color={sub} />
              <Text style={[det.infoLbl, { color: sub }]}>{r.label}</Text>
              <Text style={[det.infoVal, { color: text }]}>{r.value}</Text>
            </View>
          ))}
        </View>

        {/* Ubicación */}
        {driver.currentLatitude && driver.currentLongitude && (
          <View
            style={[
              det.section,
              {
                backgroundColor: isDark ? "#222" : "#f8f8f8",
                borderColor: border,
              },
            ]}
          >
            <Text style={[det.sectionTitle, { color: sub }]}>
              ÚLTIMA UBICACIÓN
            </Text>
            <View style={det.infoRow}>
              <Feather name="map-pin" size={13} color="#10B981" />
              <Text style={[det.infoVal, { color: text }]}>
                {parseFloat(driver.currentLatitude).toFixed(5)},{" "}
                {parseFloat(driver.currentLongitude).toFixed(5)}
              </Text>
            </View>
          </View>
        )}

        {/* Fechas */}
        <View
          style={[
            det.section,
            {
              backgroundColor: isDark ? "#222" : "#f8f8f8",
              borderColor: border,
            },
          ]}
        >
          <Text style={[det.sectionTitle, { color: sub }]}>ACTIVIDAD</Text>
          <View style={det.infoRow}>
            <Feather name="calendar" size={13} color={sub} />
            <Text style={[det.infoLbl, { color: sub }]}>Registrado</Text>
            <Text style={[det.infoVal, { color: text }]}>
              {new Date(driver.createdAt).toLocaleDateString("es-ES")}
            </Text>
          </View>
          {driver.lastActiveAt && (
            <View style={det.infoRow}>
              <Feather name="clock" size={13} color={sub} />
              <Text style={[det.infoLbl, { color: sub }]}>
                Última actividad
              </Text>
              <Text style={[det.infoVal, { color: text }]}>
                {new Date(driver.lastActiveAt).toLocaleDateString("es-ES")}
              </Text>
            </View>
          )}
          {driver.pendingAmount > 0 && (
            <View style={det.infoRow}>
              <Feather name="dollar-sign" size={13} color="#F59E0B" />
              <Text style={[det.infoLbl, { color: sub }]}>Monto pendiente</Text>
              <Text
                style={[det.infoVal, { color: "#F59E0B", fontWeight: "700" }]}
              >
                €{(driver.pendingAmount / 100).toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* ── ACCIONES ── */}

        {/* Bloquear / Desbloquear */}
        {!driver.isBlocked ? (
          <View
            style={[
              det.section,
              { backgroundColor: "#EF444408", borderColor: "#EF444425" },
            ]}
          >
            <Text style={[det.sectionTitle, { color: "#EF4444" }]}>
              BLOQUEAR REPARTIDOR
            </Text>
            {showBlockForm ? (
              <>
                <TextInput
                  style={[
                    det.textInput,
                    {
                      backgroundColor: inputBg,
                      borderColor: border,
                      color: text,
                    },
                  ]}
                  placeholder="Motivo del bloqueo (opcional)..."
                  placeholderTextColor={sub}
                  value={blockReason}
                  onChangeText={setBlockReason}
                  multiline
                />
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    onPress={() => setShowBlockForm(false)}
                    style={[det.btnSecondary, { borderColor: border, flex: 1 }]}
                  >
                    <Text style={[det.btnSecondaryTxt, { color: text }]}>
                      Cancelar
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={doBlock}
                    disabled={processing}
                    style={[det.btnDanger, { flex: 1 }]}
                  >
                    {processing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Feather name="lock" size={13} color="#fff" />
                        <Text style={det.btnTxt}>Confirmar bloqueo</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity
                onPress={() => setShowBlockForm(true)}
                style={det.btnDanger}
              >
                <Feather name="lock" size={14} color="#fff" />
                <Text style={det.btnTxt}>Bloquear repartidor</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity
            onPress={doBlock}
            disabled={processing}
            style={[det.btnSuccess]}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="unlock" size={14} color="#fff" />
                <Text style={det.btnTxt}>Desbloquear repartidor</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Strikes */}
        <View
          style={[
            det.section,
            { backgroundColor: "#F59E0B08", borderColor: "#F59E0B25" },
          ]}
        >
          <View style={det.strikesHeader}>
            <Text style={[det.sectionTitle, { color: "#F59E0B" }]}>
              STRIKES ({driver.strikes}/3)
            </Text>
            <View style={det.strikeDots}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[
                    det.strikeDot,
                    {
                      backgroundColor: i < driver.strikes ? "#EF4444" : border,
                    },
                  ]}
                />
              ))}
            </View>
          </View>

          {driver.strikes >= 3 && (
            <View
              style={[
                det.alertBox,
                {
                  backgroundColor: "#EF444415",
                  borderColor: "#EF444430",
                  marginBottom: 8,
                },
              ]}
            >
              <Feather name="alert-triangle" size={13} color="#EF4444" />
              <Text style={[det.alertTxt, { color: "#EF4444" }]}>
                3 strikes — el repartidor debería ser bloqueado
              </Text>
            </View>
          )}

          {showStrikeForm ? (
            <>
              <TextInput
                style={[
                  det.textInput,
                  {
                    backgroundColor: inputBg,
                    borderColor: border,
                    color: text,
                  },
                ]}
                placeholder="Motivo del strike (requerido)..."
                placeholderTextColor={sub}
                value={strikeReason}
                onChangeText={setStrikeReason}
                multiline
              />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  onPress={() => setShowStrikeForm(false)}
                  style={[det.btnSecondary, { borderColor: border, flex: 1 }]}
                >
                  <Text style={[det.btnSecondaryTxt, { color: text }]}>
                    Cancelar
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={addStrike}
                  disabled={processing || !strikeReason.trim()}
                  style={[
                    det.btnWarning,
                    { flex: 1, opacity: strikeReason.trim() ? 1 : 0.5 },
                  ]}
                >
                  {processing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name="alert-triangle" size={13} color="#fff" />
                      <Text style={det.btnTxt}>Confirmar strike</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={() => setShowStrikeForm(true)}
                disabled={driver.strikes >= 3}
                style={[
                  det.btnWarning,
                  { flex: 1, opacity: driver.strikes >= 3 ? 0.4 : 1 },
                ]}
              >
                <Feather name="plus" size={13} color="#fff" />
                <Text style={det.btnTxt}>Añadir strike</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={removeStrike}
                disabled={driver.strikes === 0 || processing}
                style={[
                  det.btnSecondary,
                  {
                    flex: 1,
                    borderColor: border,
                    opacity: driver.strikes === 0 ? 0.4 : 1,
                  },
                ]}
              >
                <Feather name="minus" size={13} color={text} />
                <Text style={[det.btnSecondaryTxt, { color: text }]}>
                  Quitar strike
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const det = StyleSheet.create({
  panel: { width: 340, borderLeftWidth: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarTxt: { fontSize: 20, fontWeight: "800" },
  name: { fontSize: 15, fontWeight: "700" },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusTxt: { fontSize: 11, fontWeight: "600" },
  closeBtn: { padding: 4 },
  alertBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  alertTxt: { flex: 1, fontSize: 12, fontWeight: "600" },
  msgBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
  },
  msgTxt: { fontSize: 12, fontWeight: "600" },
  statsGrid: { flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    gap: 3,
  },
  statVal: { fontSize: 18, fontWeight: "800" },
  statLbl: { fontSize: 10 },
  section: { borderRadius: 12, padding: 12, borderWidth: 1, gap: 8 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 2,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoLbl: { fontSize: 11, width: 90 },
  infoVal: { flex: 1, fontSize: 13, fontWeight: "600" },
  strikesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  strikeDots: { flexDirection: "row", gap: 5 },
  strikeDot: { width: 12, height: 12, borderRadius: 6 },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    minHeight: 60,
  },
  btnDanger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 11,
    borderRadius: 10,
    backgroundColor: "#EF4444",
  },
  btnSuccess: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 11,
    borderRadius: 10,
    backgroundColor: "#10B981",
  },
  btnWarning: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 11,
    borderRadius: 10,
    backgroundColor: "#F59E0B",
  },
  btnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  btnSecondaryTxt: { fontSize: 13, fontWeight: "600" },
});
