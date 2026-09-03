import React, { useState, useEffect, useCallback } from "react";
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

const PRIMARY = "#E60000";

const METHOD_META: Record<string, { label: string; color: string }> = {
  bizum: { label: "Bizum", color: "#00ADEF" },
  bizum_manual: { label: "Bizum manual", color: "#00ADEF" },
  transferencia: { label: "Transferencia SEPA", color: "#2E7D32" },
  sepa: { label: "Transferencia SEPA", color: "#2E7D32" },
  paypal: { label: "PayPal", color: "#003087" },
  stripe_card: { label: "Tarjeta Stripe", color: "#635BFF" },
  stripe_bizum: { label: "Bizum Stripe", color: "#00ADEF" },
};

const fmt = (cents: number) => `${(cents / 100).toFixed(2)} €`;

interface Props {
  theme?: any;
  showToast?: (msg: string, type?: string) => void;
}

export const PaymentProofsTab: React.FC<Props> = () => {
  const { isDark } = useTheme();
  const [proofs, setProofs] = useState<any[]>([]);
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
      const res = await apiRequest("GET", "/api/payments/proofs/pending");
      const data = await res.json();
      if (data.success) setProofs(data.proofs ?? []);
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
    setTimeout(() => setMsg(null), 3000);
  };

  const approve = async (proof: any) => {
    setProcessing(proof.id);
    try {
      const res = await apiRequest(
        "POST",
        `/api/payments/proofs/${proof.id}/approve`,
        {},
      );
      const data = await res.json();
      if (data.success) {
        flash(true, "✅ Comprobante aprobado — pedido confirmado");
        setProofs((prev) => prev.filter((p) => p.id !== proof.id));
        setSelected(null);
      } else {
        flash(false, data.error ?? "Error");
      }
    } catch {
      flash(false, "Error de conexión");
    } finally {
      setProcessing(null);
    }
  };

  const reject = async (proof: any) => {
    setProcessing(proof.id);
    try {
      const res = await apiRequest(
        "POST",
        `/api/payments/proofs/${proof.id}/reject`,
        { reason: rejectReason },
      );
      const data = await res.json();
      if (data.success) {
        flash(true, "❌ Comprobante rechazado — cliente notificado");
        setProofs((prev) => prev.filter((p) => p.id !== proof.id));
        setSelected(null);
        setRejectReason("");
      } else {
        flash(false, data.error ?? "Error");
      }
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
          flex: selected ? 380 : undefined,
          flexBasis: selected ? 380 : undefined,
          flexGrow: selected ? 0 : 1,
          flexShrink: 0,
        }}
      >
        <View
          style={[hd.bar, { backgroundColor: card, borderBottomColor: border }]}
        >
          <View style={[hd.iconWrap, { backgroundColor: "#F9731615" }]}>
            <Feather name="file-text" size={15} color="#F97316" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[hd.title, { color: text }]}>
              Comprobantes pendientes
            </Text>
            <Text style={[hd.sub, { color: sub }]}>
              {proofs.length} por verificar
            </Text>
          </View>
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

        {proofs.length === 0 ? (
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
              style={[
                {
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: "#10B98115",
                  justifyContent: "center",
                  alignItems: "center",
                },
              ]}
            >
              <Feather name="check-circle" size={28} color="#10B981" />
            </View>
            <Text style={[{ fontSize: 16, fontWeight: "700", color: text }]}>
              Sin comprobantes pendientes
            </Text>
            <Text style={[{ fontSize: 13, color: sub, textAlign: "center" }]}>
              Cuando un cliente suba un comprobante de Bizum, SEPA o PayPal
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
            {proofs.map((proof) => {
              const m = METHOD_META[proof.payment_provider] ?? {
                label: proof.payment_provider,
                color: "#888",
              };
              const isSelected = selected?.id === proof.id;
              return (
                <TouchableOpacity
                  key={proof.id}
                  onPress={() => setSelected(isSelected ? null : proof)}
                  style={[
                    li.card,
                    {
                      backgroundColor: card,
                      borderColor: isSelected ? m.color : border,
                      borderLeftColor: m.color,
                    },
                  ]}
                >
                  <View style={li.top}>
                    <View
                      style={[
                        li.methodPill,
                        { backgroundColor: m.color + "18" },
                      ]}
                    >
                      <Text style={[li.methodTxt, { color: m.color }]}>
                        {m.label}
                      </Text>
                    </View>
                    <Text style={[li.amount, { color: "#10B981" }]}>
                      {fmt(proof.amount)}
                    </Text>
                  </View>
                  <Text style={[li.name, { color: text }]}>
                    {proof.user_name ?? "Cliente"}
                  </Text>
                  <Text style={[li.sub, { color: sub }]}>
                    Ref:{" "}
                    <Text style={{ fontWeight: "700", color: text }}>
                      {proof.reference_number ?? "—"}
                    </Text>
                    {proof.business_name ? ` · ${proof.business_name}` : ""}
                  </Text>
                  <Text style={[li.sub, { color: sub }]}>
                    {new Date(proof.submitted_at).toLocaleString("es-ES")}
                  </Text>
                  <View style={li.hint}>
                    <Feather
                      name={isSelected ? "chevron-up" : "eye"}
                      size={12}
                      color={m.color}
                    />
                    <Text style={[li.hintTxt, { color: m.color }]}>
                      {isSelected ? "Cerrar" : "Ver y verificar"}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ── Panel detalle ── */}
      {selected &&
        (() => {
          const m = METHOD_META[selected.payment_provider] ?? {
            label: selected.payment_provider,
            color: "#888",
          };
          return (
            <View
              style={[
                det.panel,
                { backgroundColor: card, borderLeftColor: border },
              ]}
            >
              <View style={[det.header, { borderBottomColor: border }]}>
                <Text style={[det.title, { color: text }]}>
                  Verificar comprobante
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
                {/* Imagen */}
                {selected.proof_image_url ? (
                  // @ts-ignore
                  <img
                    src={selected.proof_image_url}
                    style={{
                      width: "100%",
                      maxHeight: 280,
                      objectFit: "contain",
                      borderRadius: 10,
                      border: `1px solid ${border}`,
                    }}
                    alt="Comprobante"
                  />
                ) : (
                  <View
                    style={[
                      det.noImage,
                      { backgroundColor: inputBg, borderColor: border },
                    ]}
                  >
                    <Feather name="image" size={32} color={sub} />
                    <Text style={[{ fontSize: 13, color: sub, marginTop: 8 }]}>
                      Sin imagen adjunta
                    </Text>
                  </View>
                )}

                {/* Datos */}
                <View
                  style={[
                    det.section,
                    { backgroundColor: inputBg, borderColor: border },
                  ]}
                >
                  <Text style={[det.sectionTitle, { color: sub }]}>
                    DATOS DEL COMPROBANTE
                  </Text>
                  {[
                    {
                      label: "Cliente",
                      value: selected.user_name ?? "—",
                      highlight: false,
                    },
                    {
                      label: "Teléfono",
                      value: selected.user_phone ?? "—",
                      highlight: false,
                    },
                    {
                      label: "Negocio",
                      value: selected.business_name ?? "—",
                      highlight: false,
                    },
                    { label: "Método", value: m.label, highlight: false },
                    {
                      label: "Referencia",
                      value: selected.reference_number ?? "—",
                      highlight: false,
                    },
                    {
                      label: "Importe env.",
                      value: fmt(selected.amount),
                      highlight: true,
                    },
                    {
                      label: "Total pedido",
                      value: fmt(selected.order_total ?? 0),
                      highlight: false,
                    },
                    {
                      label: "Enviado",
                      value: new Date(selected.submitted_at).toLocaleString(
                        "es-ES",
                      ),
                      highlight: false,
                    },
                  ].map((r) => (
                    <View key={r.label} style={det.dataRow}>
                      <Text style={[det.dataLbl, { color: sub }]}>
                        {r.label}
                      </Text>
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
                    placeholder="Ej: Referencia incorrecta, monto no coincide..."
                    placeholderTextColor={sub}
                    value={rejectReason}
                    onChangeText={setRejectReason}
                    multiline
                  />
                </View>

                {/* Botones */}
                <TouchableOpacity
                  onPress={() => approve(selected)}
                  disabled={!!processing}
                  style={[det.btnApprove, { opacity: processing ? 0.6 : 1 }]}
                >
                  {processing === selected.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name="check" size={16} color="#fff" />
                      <Text style={det.btnTxt}>Aprobar comprobante</Text>
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
                      <Feather name="x" size={16} color="#fff" />
                      <Text style={det.btnTxt}>Rechazar comprobante</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          );
        })()}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
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
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  methodPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  methodTxt: { fontSize: 11, fontWeight: "700" },
  amount: { fontSize: 18, fontWeight: "800" },
  name: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
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
  noImage: {
    height: 160,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
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
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    minHeight: 60,
  },
  btnApprove: {
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
