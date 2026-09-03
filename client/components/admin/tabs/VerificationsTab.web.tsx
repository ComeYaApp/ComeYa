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

const STATUS_META: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  pending: { label: "Pendiente", color: "#F59E0B", icon: "clock" },
  verified: { label: "Aprobado", color: "#10B981", icon: "check-circle" },
  rejected: { label: "Rechazado", color: "#EF4444", icon: "x-circle" },
};

const ROLE_META: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  delivery_driver: { label: "Repartidor", color: "#10B981", icon: "truck" },
  business_owner: { label: "Negocio", color: "#3B82F6", icon: "briefcase" },
};

interface Props {
  theme?: any;
  showToast?: (msg: string, type?: string) => void;
}

export const VerificationsTab: React.FC<Props> = () => {
  const { isDark } = useTheme();
  const [users, setUsers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<
    "pending" | "verified" | "rejected" | "all"
  >("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const bg = isDark ? "#0d0d0d" : "#f2f3f5";
  const card = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#ebebeb";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#666" : "#aaa";
  const inputBg = isDark ? "#222" : "#f8f8f8";

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/verifications/pending");
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let list = users;
    if (filter !== "all")
      list = list.filter((u) => (u.verificationStatus ?? "pending") === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.phone?.toLowerCase().includes(q),
      );
    }
    setFiltered(list);
  }, [filter, search, users]);

  const flash = (ok: boolean, t: string) => {
    setMsg({ ok, text: t });
    setTimeout(() => setMsg(null), 3000);
  };

  const handleAction = async (action: "approve" | "reject") => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await apiRequest(
        "PUT",
        `/api/admin/verifications/${selected.id}`,
        { action, notes },
      );
      const data = await res.json();
      if (data.success) {
        const newStatus = action === "approve" ? "verified" : "rejected";
        setUsers((prev) =>
          prev.map((u) =>
            u.id === selected.id ? { ...u, verificationStatus: newStatus } : u,
          ),
        );
        setSelected((p: any) =>
          p ? { ...p, verificationStatus: newStatus } : null,
        );
        flash(
          true,
          action === "approve" ? "✅ Usuario aprobado" : "❌ Usuario rechazado",
        );
        setNotes("");
      } else {
        flash(false, data.error ?? "Error");
      }
    } catch {
      flash(false, "Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const counts = {
    all: users.length,
    pending: users.filter(
      (u) => (u.verificationStatus ?? "pending") === "pending",
    ).length,
    verified: users.filter((u) => u.verificationStatus === "verified").length,
    rejected: users.filter((u) => u.verificationStatus === "rejected").length,
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
          width: selected ? 360 : undefined,
          flex: selected ? undefined : 1,
        }}
      >
        {/* KPI bar */}
        <View
          style={[
            kpi.bar,
            { backgroundColor: card, borderBottomColor: border },
          ]}
        >
          {[
            { label: "Pendientes", value: counts.pending, color: "#F59E0B" },
            { label: "Aprobados", value: counts.verified, color: "#10B981" },
            { label: "Rechazados", value: counts.rejected, color: "#EF4444" },
          ].map((k) => (
            <View key={k.label} style={kpi.item}>
              <Text style={[kpi.val, { color: k.color }]}>{k.value}</Text>
              <Text style={[kpi.lbl, { color: sub }]}>{k.label}</Text>
            </View>
          ))}
        </View>

        {/* Toolbar */}
        <View
          style={[tb.bar, { backgroundColor: card, borderBottomColor: border }]}
        >
          <View
            style={[
              tb.searchWrap,
              { backgroundColor: inputBg, borderColor: border },
            ]}
          >
            <Feather name="search" size={14} color={sub} />
            <TextInput
              style={[tb.input, { color: text }]}
              placeholder="Buscar nombre, teléfono..."
              placeholderTextColor={sub}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Feather name="x" size={14} color={sub} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={[tb.count, { color: sub }]}>{filtered.length}</Text>
        </View>

        {/* Filtros */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[tb.filterRow, { borderBottomColor: border }]}
          contentContainerStyle={tb.filterContent}
        >
          {(
            [
              { id: "pending", label: "Pendientes", color: "#F59E0B" },
              { id: "verified", label: "Aprobados", color: "#10B981" },
              { id: "rejected", label: "Rechazados", color: "#EF4444" },
              { id: "all", label: "Todos", color: PRIMARY },
            ] as const
          ).map((f) => (
            <TouchableOpacity
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[
                tb.chip,
                {
                  backgroundColor: filter === f.id ? f.color : inputBg,
                  borderColor: filter === f.id ? f.color : border,
                },
              ]}
            >
              <Text
                style={[tb.chipTxt, { color: filter === f.id ? "#fff" : text }]}
              >
                {f.label} ({counts[f.id]})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Feedback */}
        {msg && (
          <View
            style={[
              tb.msgBar,
              { backgroundColor: msg.ok ? "#10B98115" : "#EF444415" },
            ]}
          >
            <Feather
              name={msg.ok ? "check-circle" : "alert-circle"}
              size={13}
              color={msg.ok ? "#10B981" : "#EF4444"}
            />
            <Text
              style={[tb.msgTxt, { color: msg.ok ? "#10B981" : "#EF4444" }]}
            >
              {msg.text}
            </Text>
          </View>
        )}

        {/* Lista */}
        {filtered.length === 0 ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Feather name="user-check" size={40} color={sub} />
            <Text style={{ color: sub, fontSize: 15 }}>
              {filter === "pending"
                ? "Sin solicitudes pendientes"
                : "Sin resultados"}
            </Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 14, gap: 8 }}
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
            {filtered.map((u) => {
              const status = u.verificationStatus ?? "pending";
              const sMeta = STATUS_META[status] ?? STATUS_META.pending;
              const rMeta = ROLE_META[u.role] ?? {
                label: u.role,
                color: "#888",
                icon: "user",
              };
              const isSelected = selected?.id === u.id;

              return (
                <TouchableOpacity
                  key={u.id}
                  onPress={() => {
                    setSelected(u);
                    setNotes(u.verificationNotes ?? "");
                  }}
                  style={[
                    li.card,
                    {
                      backgroundColor: card,
                      borderColor: isSelected ? sMeta.color : border,
                      borderLeftColor: sMeta.color,
                    },
                  ]}
                >
                  <View style={li.row}>
                    <View
                      style={[
                        li.avatar,
                        { backgroundColor: rMeta.color + "20" },
                      ]}
                    >
                      <Text style={[li.avatarTxt, { color: rMeta.color }]}>
                        {u.name?.charAt(0).toUpperCase() ?? "?"}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[li.name, { color: text }]}
                        numberOfLines={1}
                      >
                        {u.name}
                      </Text>
                      <Text style={[li.phone, { color: sub }]}>{u.phone}</Text>
                      <View style={li.badges}>
                        <View
                          style={[
                            li.rolePill,
                            { backgroundColor: rMeta.color + "18" },
                          ]}
                        >
                          <Feather
                            name={rMeta.icon as any}
                            size={10}
                            color={rMeta.color}
                          />
                          <Text style={[li.roleTxt, { color: rMeta.color }]}>
                            {rMeta.label}
                          </Text>
                        </View>
                        <View
                          style={[
                            li.statusPill,
                            { backgroundColor: sMeta.color + "15" },
                          ]}
                        >
                          <Feather
                            name={sMeta.icon as any}
                            size={10}
                            color={sMeta.color}
                          />
                          <Text style={[li.statusTxt, { color: sMeta.color }]}>
                            {sMeta.label}
                          </Text>
                        </View>
                      </View>
                      {/* Doc badges */}
                      <View style={li.docRow}>
                        <DocBadge
                          label="DNI/NIE"
                          has={!!u.idDocumentUrl}
                          isDark={isDark}
                        />
                        <DocBadge
                          label="Autónomo"
                          has={!!u.autonomoDocumentUrl}
                          isDark={isDark}
                        />
                      </View>
                    </View>
                    <Feather name="chevron-right" size={16} color={sub} />
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
          const status = selected.verificationStatus ?? "pending";
          const sMeta = STATUS_META[status] ?? STATUS_META.pending;
          const rMeta = ROLE_META[selected.role] ?? {
            label: selected.role,
            color: "#888",
            icon: "user",
          };
          const dd = selected.deliveryDriver;
          const biz = selected.business;

          return (
            <View
              style={[
                det.panel,
                { backgroundColor: card, borderLeftColor: border },
              ]}
            >
              {/* Header */}
              <View style={[det.header, { borderBottomColor: border }]}>
                <View
                  style={[det.avatar, { backgroundColor: rMeta.color + "20" }]}
                >
                  <Text style={[det.avatarTxt, { color: rMeta.color }]}>
                    {selected.name?.charAt(0).toUpperCase() ?? "?"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[det.name, { color: text }]} numberOfLines={1}>
                    {selected.name}
                  </Text>
                  <View
                    style={[
                      det.rolePill,
                      { backgroundColor: rMeta.color + "18" },
                    ]}
                  >
                    <Feather
                      name={rMeta.icon as any}
                      size={10}
                      color={rMeta.color}
                    />
                    <Text style={[det.roleTxt, { color: rMeta.color }]}>
                      {rMeta.label}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setSelected(null)}
                  style={{ padding: 4 }}
                >
                  <Feather name="x" size={18} color={sub} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, gap: 12 }}
                showsVerticalScrollIndicator={false}
              >
                {/* Estado actual */}
                <View
                  style={[
                    det.statusBox,
                    {
                      backgroundColor: sMeta.color + "12",
                      borderColor: sMeta.color + "30",
                    },
                  ]}
                >
                  <Feather
                    name={sMeta.icon as any}
                    size={15}
                    color={sMeta.color}
                  />
                  <Text style={[det.statusTxt, { color: sMeta.color }]}>
                    {sMeta.label}
                  </Text>
                  {selected.verificationNotes && (
                    <Text style={[det.statusNote, { color: sMeta.color }]}>
                      · {selected.verificationNotes}
                    </Text>
                  )}
                </View>

                {/* Datos personales */}
                <Section title="DATOS PERSONALES" isDark={isDark}>
                  <InfoRow
                    icon="phone"
                    label="Teléfono"
                    value={selected.phone ?? "—"}
                    text={text}
                    sub={sub}
                  />
                  <InfoRow
                    icon="mail"
                    label="Email"
                    value={selected.email ?? "—"}
                    text={text}
                    sub={sub}
                  />
                  <InfoRow
                    icon="hash"
                    label="DNI/NIE"
                    value={selected.dni ?? "—"}
                    text={text}
                    sub={sub}
                  />
                  <InfoRow
                    icon="map-pin"
                    label="Dirección"
                    value={selected.address ?? "—"}
                    text={text}
                    sub={sub}
                  />
                  <InfoRow
                    icon="calendar"
                    label="Registrado"
                    value={new Date(selected.createdAt).toLocaleDateString(
                      "es-ES",
                    )}
                    text={text}
                    sub={sub}
                  />
                </Section>

                {/* Vehículo (repartidor) */}
                {dd && (
                  <Section title="VEHÍCULO" isDark={isDark}>
                    <InfoRow
                      icon="truck"
                      label="Tipo"
                      value={dd.vehicleType ?? "—"}
                      text={text}
                      sub={sub}
                    />
                    <InfoRow
                      icon="hash"
                      label="Matrícula"
                      value={dd.vehiclePlate ?? "—"}
                      text={text}
                      sub={sub}
                    />
                    <InfoRow
                      icon="box"
                      label="Marca"
                      value={dd.vehicleBrand ?? "—"}
                      text={text}
                      sub={sub}
                    />
                    <InfoRow
                      icon="settings"
                      label="Modelo"
                      value={dd.vehicleModel ?? "—"}
                      text={text}
                      sub={sub}
                    />
                    <InfoRow
                      icon="droplet"
                      label="Color"
                      value={dd.vehicleColor ?? "—"}
                      text={text}
                      sub={sub}
                    />
                  </Section>
                )}

                {/* Negocio */}
                {biz && (
                  <Section title="NEGOCIO" isDark={isDark}>
                    <InfoRow
                      icon="briefcase"
                      label="Nombre"
                      value={biz.name ?? "—"}
                      text={text}
                      sub={sub}
                    />
                    <InfoRow
                      icon="tag"
                      label="Tipo"
                      value={biz.type ?? "—"}
                      text={text}
                      sub={sub}
                    />
                    <InfoRow
                      icon="map-pin"
                      label="Dirección"
                      value={biz.address ?? "—"}
                      text={text}
                      sub={sub}
                    />
                    <InfoRow
                      icon="phone"
                      label="Teléfono"
                      value={biz.phone ?? "—"}
                      text={text}
                      sub={sub}
                    />
                  </Section>
                )}

                {/* Documentos */}
                <Section title="DOCUMENTOS" isDark={isDark}>
                  <DocDetailRow
                    label="DNI/NIE"
                    url={selected.idDocumentUrl}
                    text={text}
                    sub={sub}
                  />
                  <DocDetailRow
                    label="Cert. autónomo/empresa"
                    url={selected.autonomoDocumentUrl}
                    text={text}
                    sub={sub}
                  />
                  {dd?.vehiclePhoto && (
                    <DocDetailRow
                      label="Foto vehículo"
                      url={dd.vehiclePhoto}
                      text={text}
                      sub={sub}
                    />
                  )}
                  {dd?.vehiclePlatePhoto && (
                    <DocDetailRow
                      label="Foto matrícula"
                      url={dd.vehiclePlatePhoto}
                      text={text}
                      sub={sub}
                    />
                  )}
                  {dd?.vehicleItvPhoto && (
                    <DocDetailRow
                      label="ITV"
                      url={dd.vehicleItvPhoto}
                      text={text}
                      sub={sub}
                    />
                  )}
                  {dd?.vehicleInsurancePhoto && (
                    <DocDetailRow
                      label="Seguro"
                      url={dd.vehicleInsurancePhoto}
                      text={text}
                      sub={sub}
                    />
                  )}
                  {dd?.vehicleLicensePhoto && (
                    <DocDetailRow
                      label="Carnet de conducir"
                      url={dd.vehicleLicensePhoto}
                      text={text}
                      sub={sub}
                    />
                  )}
                </Section>

                {/* Nota admin */}
                <View>
                  <Text style={[det.sectionTitle, { color: sub }]}>
                    NOTA (motivo de rechazo o comentario)
                  </Text>
                  <TextInput
                    style={[
                      det.notesInput,
                      {
                        backgroundColor: inputBg,
                        borderColor: border,
                        color: text,
                      },
                    ]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Opcional..."
                    placeholderTextColor={sub}
                    multiline
                  />
                </View>

                {/* Acciones */}
                {status === "pending" && (
                  <View style={det.actions}>
                    <TouchableOpacity
                      onPress={() => handleAction("reject")}
                      disabled={saving}
                      style={[det.btnReject, { opacity: saving ? 0.6 : 1 }]}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Feather name="x-circle" size={14} color="#fff" />
                          <Text style={det.btnTxt}>Rechazar</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleAction("approve")}
                      disabled={saving}
                      style={[det.btnApprove, { opacity: saving ? 0.6 : 1 }]}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Feather name="check-circle" size={14} color="#fff" />
                          <Text style={det.btnTxt}>Aprobar</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {status !== "pending" && (
                  <TouchableOpacity
                    onPress={() =>
                      handleAction(status === "verified" ? "reject" : "approve")
                    }
                    disabled={saving}
                    style={[
                      status === "verified" ? det.btnReject : det.btnApprove,
                      { opacity: saving ? 0.6 : 1 },
                    ]}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={det.btnTxt}>
                        {status === "verified"
                          ? "Revocar aprobación"
                          : "Aprobar igualmente"}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          );
        })()}
    </View>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────
function Section({ title, children, isDark }: any) {
  const bg = isDark ? "#222" : "#f8f8f8";
  const border = isDark ? "#2a2a2a" : "#ebebeb";
  return (
    <View>
      <Text style={[det.sectionTitle, { color: isDark ? "#666" : "#aaa" }]}>
        {title}
      </Text>
      <View
        style={[det.sectionBox, { backgroundColor: bg, borderColor: border }]}
      >
        {children}
      </View>
    </View>
  );
}

function InfoRow({ icon, label, value, text, sub }: any) {
  return (
    <View style={det.infoRow}>
      <Feather name={icon} size={12} color={sub} />
      <Text style={[det.infoLbl, { color: sub }]}>{label}</Text>
      <Text style={[det.infoVal, { color: text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function DocDetailRow({ label, url, text, sub }: any) {
  return (
    <View style={det.infoRow}>
      <Feather
        name={url ? "check-circle" : "alert-circle"}
        size={12}
        color={url ? "#10B981" : "#F59E0B"}
      />
      <Text style={[det.infoLbl, { color: sub }]}>{label}</Text>
      {url ? (
        // @ts-ignore
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#3B82F6",
            fontSize: 12,
            fontWeight: "600",
            textDecoration: "none",
          }}
        >
          Ver documento ↗
        </a>
      ) : (
        <Text style={{ color: "#F59E0B", fontSize: 12, fontWeight: "600" }}>
          No subido
        </Text>
      )}
    </View>
  );
}

function DocBadge({ label, has, isDark }: any) {
  const color = has ? "#10B981" : "#F59E0B";
  return (
    <View style={[li.docBadge, { backgroundColor: color + "18" }]}>
      <Feather
        name={has ? "file-text" : "alert-circle"}
        size={9}
        color={color}
      />
      <Text style={[li.docBadgeTxt, { color }]}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const kpi = StyleSheet.create({
  bar: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  item: { flex: 1, alignItems: "center", gap: 2 },
  val: { fontSize: 18, fontWeight: "800" },
  lbl: { fontSize: 10, fontWeight: "600" },
});

const tb = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 13 } as any,
  count: { fontSize: 12, fontWeight: "600" },
  filterRow: { flexGrow: 0, borderBottomWidth: 1 },
  filterContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  chipTxt: { fontSize: 12, fontWeight: "600" },
  msgBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  msgTxt: { fontSize: 12, fontWeight: "600" },
});

const li = StyleSheet.create({
  card: { borderRadius: 12, padding: 12, borderWidth: 1, borderLeftWidth: 3 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarTxt: { fontSize: 17, fontWeight: "800" },
  name: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  phone: { fontSize: 11, marginBottom: 4 },
  badges: { flexDirection: "row", gap: 6, marginBottom: 4 },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleTxt: { fontSize: 10, fontWeight: "700" },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusTxt: { fontSize: 10, fontWeight: "700" },
  docRow: { flexDirection: "row", gap: 5 },
  docBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  docBadgeTxt: { fontSize: 9, fontWeight: "700" },
});

const det = StyleSheet.create({
  panel: { flex: 1, borderLeftWidth: 1 },
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
  name: { fontSize: 15, fontWeight: "700", marginBottom: 3 },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  roleTxt: { fontSize: 10, fontWeight: "700" },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusTxt: { fontSize: 13, fontWeight: "700" },
  statusNote: { flex: 1, fontSize: 12 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 6,
  },
  sectionBox: { borderRadius: 10, padding: 12, borderWidth: 1, gap: 6 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoLbl: { fontSize: 11, width: 80 },
  infoVal: { flex: 1, fontSize: 12, fontWeight: "600" },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    minHeight: 70,
  },
  actions: { flexDirection: "row", gap: 10 },
  btnApprove: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#10B981",
  },
  btnReject: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#EF4444",
  },
  btnTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
