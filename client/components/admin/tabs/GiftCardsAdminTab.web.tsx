import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

const PRIMARY = "#DC2626";

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending_payment: { label: "Pendiente de pago", color: "#F59E0B" },
  pending_verification: { label: "Verificando", color: "#3B82F6" },
  active: { label: "Activa", color: "#10B981" },
  rejected: { label: "Rechazada", color: "#EF4444" },
};

const fmt = (cents: number) => `${(cents / 100).toFixed(2)} €`;

export const GiftCardsAdminTab: React.FC = () => {
  const { isDark } = useTheme();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const bg = isDark ? "#0d0d0d" : "#f2f3f5";
  const card = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#ebebeb";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#666" : "#aaa";
  const inputBg = isDark ? "#222" : "#f8f8f8";

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/gift-cards/pending");
      const data = await res.json();
      if (data.success) setCards(data.giftCards ?? []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (ok: boolean, t: string) => {
    setMsg({ ok, text: t });
    setTimeout(() => setMsg(null), 3500);
  };

  const activate = async (gc: any) => {
    setProcessing(gc.id);
    try {
      const res = await apiRequest(
        "POST",
        `/api/admin/gift-cards/${gc.id}/activate`,
        {},
      );
      const data = await res.json();
      if (data.success) {
        flash(
          true,
          `✅ Gift Card activada — caduca el ${new Date(data.expiresAt).toLocaleDateString("es-ES")}`,
        );
        setCards((prev) => prev.filter((c) => c.id !== gc.id));
        setSelected(null);
      } else flash(false, data.error ?? "Error");
    } catch {
      flash(false, "Error de conexión");
    } finally {
      setProcessing(null);
    }
  };

  const reject = async (gc: any) => {
    if (!rejectReason.trim()) {
      flash(false, "Escribe una razón de rechazo");
      return;
    }
    setProcessing(gc.id);
    try {
      const res = await apiRequest(
        "POST",
        `/api/admin/gift-cards/${gc.id}/reject`,
        { reason: rejectReason },
      );
      const data = await res.json();
      if (data.success) {
        flash(true, "❌ Gift Card rechazada — cliente notificado");
        setCards((prev) => prev.filter((c) => c.id !== gc.id));
        setSelected(null);
        setRejectReason("");
      } else flash(false, data.error ?? "Error");
    } catch {
      flash(false, "Error de conexión");
    } finally {
      setProcessing(null);
    }
  };

  if (loading)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: bg,
        }}
      >
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: bg, flexDirection: "row" }}>
      {/* ── Lista ── */}
      <View
        style={{
          flex: selected ? undefined : 1,
          flexBasis: selected ? 400 : undefined,
          flexGrow: selected ? 0 : 1,
          flexShrink: 0,
        }}
      >
        <View
          style={[hd.bar, { backgroundColor: card, borderBottomColor: border }]}
        >
          <View style={[hd.iconWrap, { backgroundColor: "#EC489915" }]}>
            <Feather name="gift" size={15} color="#EC4899" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[hd.title, { color: text }]}>
              Gift Cards pendientes
            </Text>
            <Text style={[hd.sub, { color: sub }]}>
              {cards.length} por activar
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setRefreshing(true);
              load();
            }}
            style={hd.refreshBtn}
          >
            <Feather name="refresh-cw" size={14} color={sub} />
          </TouchableOpacity>
          {msg && (
            <View
              style={[
                hd.msgPill,
                { backgroundColor: msg.ok ? "#10B98115" : "#EF444415" },
              ]}
            >
              <Feather
                name={msg.ok ? "check-circle" : "alert-circle"}
                size={12}
                color={msg.ok ? "#10B981" : "#EF4444"}
              />
              <Text
                style={[hd.msgTxt, { color: msg.ok ? "#10B981" : "#EF4444" }]}
              >
                {msg.text}
              </Text>
            </View>
          )}
        </View>

        {cards.length === 0 ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              gap: 12,
              padding: 40,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "#10B98115",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Feather name="check-circle" size={28} color="#10B981" />
            </View>
            <Text style={{ fontSize: 16, fontWeight: "700", color: text }}>
              Sin gift cards pendientes
            </Text>
            <Text style={{ fontSize: 13, color: sub, textAlign: "center" }}>
              Cuando un cliente compre una gift card y suba el comprobante
              aparecerá aquí
            </Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
                tintColor={PRIMARY}
              />
            }
          >
            {cards.map((gc) => {
              const st =
                STATUS_META[gc.status] ?? STATUS_META["pending_payment"];
              const isSelected = selected?.id === gc.id;
              return (
                <TouchableOpacity
                  key={gc.id}
                  onPress={() => setSelected(isSelected ? null : gc)}
                  style={[
                    li.card,
                    {
                      backgroundColor: card,
                      borderColor: isSelected ? st.color : border,
                      borderLeftColor: st.color,
                    },
                  ]}
                >
                  {/* Badge GIFT CARD */}
                  <View style={li.top}>
                    <View
                      style={[li.typePill, { backgroundColor: "#EC489915" }]}
                    >
                      <Feather name="gift" size={10} color="#EC4899" />
                      <Text style={[li.typeTxt, { color: "#EC4899" }]}>
                        GIFT CARD
                      </Text>
                    </View>
                    <View
                      style={[
                        li.statusPill,
                        { backgroundColor: st.color + "18" },
                      ]}
                    >
                      <Text style={[li.statusTxt, { color: st.color }]}>
                        {st.label}
                      </Text>
                    </View>
                    <Text style={[li.amount, { color: "#10B981" }]}>
                      {fmt(gc.amount)}
                    </Text>
                  </View>
                  <Text style={[li.code, { color: text }]}>{gc.code}</Text>
                  <Text style={[li.sub, { color: sub }]}>
                    Comprada:{" "}
                    {new Date(gc.created_at ?? gc.createdAt).toLocaleString(
                      "es-ES",
                    )}
                  </Text>
                  {gc.to_email && (
                    <Text style={[li.sub, { color: sub }]}>
                      Para: {gc.to_email}
                    </Text>
                  )}
                  <View style={li.hint}>
                    <Feather
                      name={isSelected ? "chevron-up" : "eye"}
                      size={12}
                      color={st.color}
                    />
                    <Text style={[li.hintTxt, { color: st.color }]}>
                      {isSelected ? "Cerrar" : "Ver y gestionar"}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ── Panel detalle ── */}
      {selected && (
        <View
          style={[
            det.panel,
            { backgroundColor: card, borderLeftColor: border },
          ]}
        >
          <View style={[det.header, { borderBottomColor: border }]}>
            <Text style={[det.title, { color: text }]}>
              Gestionar Gift Card
            </Text>
            <TouchableOpacity
              onPress={() => {
                setSelected(null);
                setRejectReason("");
              }}
            >
              <Feather name="x" size={18} color={sub} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Datos de la gift card */}
            <View
              style={[
                det.section,
                { backgroundColor: inputBg, borderColor: border },
              ]}
            >
              <Text style={[det.sectionTitle, { color: sub }]}>
                DATOS DE LA GIFT CARD
              </Text>
              {[
                { label: "Código", value: selected.code, highlight: true },
                {
                  label: "Importe",
                  value: fmt(selected.amount),
                  highlight: true,
                },
                {
                  label: "Estado",
                  value: STATUS_META[selected.status]?.label ?? selected.status,
                  highlight: false,
                },
                {
                  label: "Para",
                  value: selected.to_email ?? selected.toEmail ?? "—",
                  highlight: false,
                },
                {
                  label: "Mensaje",
                  value: selected.message ?? "—",
                  highlight: false,
                },
                {
                  label: "Creada",
                  value: new Date(
                    selected.created_at ?? selected.createdAt,
                  ).toLocaleString("es-ES"),
                  highlight: false,
                },
              ].map((r) => (
                <View key={r.label} style={det.dataRow}>
                  <Text style={[det.dataLbl, { color: sub }]}>{r.label}</Text>
                  <Text
                    style={[
                      det.dataVal,
                      {
                        color: r.highlight ? "#10B981" : text,
                        fontWeight: r.highlight ? "800" : "600",
                      },
                    ]}
                  >
                    {r.value}
                  </Text>
                </View>
              ))}
            </View>

            {/* Info caducidad tras activar */}
            <View
              style={[
                det.infoBanner,
                { backgroundColor: "#3B82F615", borderColor: "#3B82F630" },
              ]}
            >
              <Feather name="info" size={14} color="#3B82F6" />
              <Text style={{ color: "#3B82F6", fontSize: 12, flex: 1 }}>
                Al activar, la gift card tendrá saldo de {fmt(selected.amount)}{" "}
                y caducará en 30 días.
              </Text>
            </View>

            {/* Razón de rechazo */}
            <View>
              <Text style={[det.sectionTitle, { color: sub }]}>
                RAZÓN DE RECHAZO (si rechazas)
              </Text>
              <TextInput
                style={[
                  det.input,
                  {
                    backgroundColor: inputBg,
                    borderColor: border,
                    color: text,
                  },
                ]}
                placeholder="Ej: Comprobante no válido, monto incorrecto..."
                placeholderTextColor={sub}
                value={rejectReason}
                onChangeText={setRejectReason}
                multiline
              />
            </View>

            {/* Botones */}
            <TouchableOpacity
              onPress={() => activate(selected)}
              disabled={!!processing}
              style={[det.btnActivate, { opacity: processing ? 0.6 : 1 }]}
            >
              {processing === selected.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="check-circle" size={16} color="#fff" />
                  <Text style={det.btnTxt}>Activar Gift Card</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => reject(selected)}
              disabled={!!processing}
              style={[det.btnReject, { opacity: processing ? 0.6 : 1 }]}
            >
              {processing === selected.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="x-circle" size={16} color="#fff" />
                  <Text style={det.btnTxt}>Rechazar</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const hd = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 14, fontWeight: "700" },
  sub: { fontSize: 11, marginTop: 1 },
  refreshBtn: { padding: 6 },
  msgPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  msgTxt: { fontSize: 11, fontWeight: "600" },
});

const li = StyleSheet.create({
  card: { borderRadius: 12, padding: 14, borderWidth: 1, borderLeftWidth: 3 },
  top: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  typeTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusTxt: { fontSize: 11, fontWeight: "700" },
  amount: { fontSize: 18, fontWeight: "800", marginLeft: "auto" as any },
  code: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
    fontFamily: "monospace" as any,
  },
  sub: { fontSize: 12, marginBottom: 1 },
  hint: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  hintTxt: { fontSize: 12, fontWeight: "600" },
});

const det = StyleSheet.create({
  panel: { flex: 1, borderLeftWidth: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 15, fontWeight: "700" },
  section: { borderRadius: 12, padding: 12, borderWidth: 1, gap: 6 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 4,
  },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  dataLbl: { fontSize: 12 },
  dataVal: { fontSize: 13, flex: 1, textAlign: "right" },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    minHeight: 60,
  },
  btnActivate: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 13,
    borderRadius: 10,
    backgroundColor: "#10B981",
  },
  btnReject: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 13,
    borderRadius: 10,
    backgroundColor: "#EF4444",
  },
  btnTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
