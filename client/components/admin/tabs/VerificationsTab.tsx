import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, ActivityIndicator, Image, Modal,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ComeYaColors, Spacing, BorderRadius, Shadows } from "../../../constants/theme";
import { apiRequest } from "@/lib/query-client";

interface Props {
  theme: any;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending:  { label: "Pendiente",  color: "#F59E0B", icon: "clock" },
  verified: { label: "Verificado", color: "#10B981", icon: "check-circle" },
  rejected: { label: "Rechazado",  color: "#EF4444", icon: "x-circle" },
};

const ROLE_LABEL: Record<string, string> = {
  delivery_driver: "Repartidor",
  business_owner:  "Negocio",
};

export const VerificationsTab: React.FC<Props> = ({ theme, showToast }) => {
  const [users, setUsers]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<"all" | "pending" | "verified" | "rejected">("pending");
  const [selected, setSelected] = useState<any | null>(null);
  const [notes, setNotes]       = useState("");
  const [saving, setSaving]     = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res  = await apiRequest("GET", "/api/admin/verifications/pending");
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      showToast("Error al cargar verificaciones", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: "approve" | "reject") => {
    if (!selected) return;
    setSaving(true);
    try {
      const res  = await apiRequest("PUT", `/api/admin/verifications/${selected.id}`, { action, notes });
      const data = await res.json();
      if (data.success) {
        showToast(action === "approve" ? "Usuario aprobado ✓" : "Usuario rechazado", action === "approve" ? "success" : "error");
        setSelected(null);
        setNotes("");
        load();
      } else {
        showToast(data.error || "Error", "error");
      }
    } catch {
      showToast("Error de conexión", "error");
    } finally {
      setSaving(false);
    }
  };

  const filtered = users.filter(u => {
    const status = u.verificationStatus || "pending";
    return filter === "all" || status === filter;
  });

  const counts = {
    all:      users.length,
    pending:  users.filter(u => (u.verificationStatus || "pending") === "pending").length,
    verified: users.filter(u => u.verificationStatus === "verified").length,
    rejected: users.filter(u => u.verificationStatus === "rejected").length,
  };

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Filtros */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        {(["pending", "verified", "rejected", "all"] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[s.filterChip, {
              backgroundColor: filter === f ? ComeYaColors.primary : theme.backgroundSecondary,
              borderColor: filter === f ? ComeYaColors.primary : theme.border,
            }]}
          >
            <Text style={{ color: filter === f ? "#FFF" : theme.text, fontWeight: "600", fontSize: 13 }}>
              {f === "all" ? "Todos" : f === "pending" ? "Pendientes" : f === "verified" ? "Aprobados" : "Rechazados"}
              {" "}({counts[f]})
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={[s.empty, { backgroundColor: theme.card }]}>
            <Feather name="user-check" size={48} color={theme.textSecondary} />
            <Text style={[s.emptyText, { color: theme.textSecondary }]}>
              {filter === "pending" ? "No hay solicitudes pendientes" : "Sin resultados"}
            </Text>
          </View>
        ) : (
          filtered.map((u) => {
            const status = u.verificationStatus || "pending";
            const cfg    = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
            return (
              <Pressable
                key={u.id}
                onPress={() => { setSelected(u); setNotes(u.verificationNotes || ""); }}
                style={[s.card, { backgroundColor: theme.card }, Shadows.sm]}
              >
                {/* Avatar */}
                <View style={[s.avatar, { backgroundColor: ComeYaColors.primary + "20" }]}>
                  {u.profileImage
                    ? <Image source={{ uri: u.profileImage }} style={s.avatarImg} />
                    : <Feather name="user" size={22} color={ComeYaColors.primary} />
                  }
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.name, { color: theme.text }]}>{u.name}</Text>
                  <Text style={[s.sub, { color: theme.textSecondary }]}>{u.phone}</Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                    <View style={[s.badge, { backgroundColor: "#6366F1" + "20" }]}>
                      <Text style={{ color: "#6366F1", fontSize: 11, fontWeight: "600" }}>
                        {ROLE_LABEL[u.role] || u.role}
                      </Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: cfg.color + "20" }]}>
                      <Feather name={cfg.icon as any} size={11} color={cfg.color} />
                      <Text style={{ color: cfg.color, fontSize: 11, fontWeight: "600", marginLeft: 3 }}>{cfg.label}</Text>
                    </View>
                  </View>
                  {/* Documentos */}
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                    <DocBadge label="DNI/NIE"    has={!!u.idDocumentUrl}    theme={theme} />
                    <DocBadge label="Autónomo"   has={!!u.autonomoDocumentUrl} theme={theme} />
                  </View>
                </View>

                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Modal detalle */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={s.overlay} onPress={() => setSelected(null)}>
          <Pressable style={[s.sheet, { backgroundColor: theme.card }]} onPress={(e) => e.stopPropagation()}>
            <View style={s.sheetHandle} />

            <ScrollView showsVerticalScrollIndicator={false}>
              {selected && (
                <>
                  {/* Cabecera */}
                  <View style={s.sheetHeader}>
                    <View style={[s.avatarLg, { backgroundColor: ComeYaColors.primary + "20" }]}>
                      {selected.profileImage
                        ? <Image source={{ uri: selected.profileImage }} style={s.avatarLgImg} />
                        : <Feather name="user" size={32} color={ComeYaColors.primary} />
                      }
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[s.name, { color: theme.text, fontSize: 18 }]}>{selected.name}</Text>
                      <Text style={[s.sub, { color: theme.textSecondary }]}>{selected.phone}</Text>
                      <Text style={[s.sub, { color: theme.textSecondary }]}>{selected.email || "Sin email"}</Text>
                    </View>
                  </View>

                  {/* Datos personales */}
                  <Section title="Datos personales" theme={theme}>
                    <Row label="Rol"       value={ROLE_LABEL[selected.role] || selected.role} theme={theme} />
                    <Row label="DNI/NIE"   value={selected.dni || "No proporcionado"} theme={theme} />
                    <Row label="Dirección" value={selected.address || "No proporcionada"} theme={theme} />
                    <Row label="Registrado" value={new Date(selected.createdAt).toLocaleDateString("es-ES")} theme={theme} />
                  </Section>

                  {/* Documentos */}
                  <Section title="Documentos subidos" theme={theme}>
                    <DocRow label="Foto DNI/NIE"       url={selected.idDocumentUrl}       theme={theme} />
                    <DocRow label="Cert. autónomo/empresa" url={selected.autonomoDocumentUrl} theme={theme} />
                  </Section>

                  {/* Estado actual */}
                  <Section title="Estado de verificación" theme={theme}>
                    {(() => {
                      const status = selected.verificationStatus || "pending";
                      const cfg = STATUS_CONFIG[status];
                      return (
                        <View style={[s.statusBox, { backgroundColor: cfg.color + "15", borderColor: cfg.color + "40" }]}>
                          <Feather name={cfg.icon as any} size={18} color={cfg.color} />
                          <Text style={{ color: cfg.color, fontWeight: "700", marginLeft: 8 }}>{cfg.label}</Text>
                        </View>
                      );
                    })()}
                    {selected.verificationNotes ? (
                      <Text style={[s.sub, { color: theme.textSecondary, marginTop: 8 }]}>
                        Nota: {selected.verificationNotes}
                      </Text>
                    ) : null}
                  </Section>

                  {/* Nota del admin */}
                  <Section title="Nota (opcional)" theme={theme}>
                    <TextInput
                      style={[s.notesInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Motivo de rechazo o comentario..."
                      placeholderTextColor={theme.textSecondary}
                      multiline
                      numberOfLines={3}
                    />
                  </Section>

                  {/* Acciones */}
                  <View style={s.actions}>
                    <Pressable
                      onPress={() => handleAction("reject")}
                      disabled={saving}
                      style={[s.actionBtn, { backgroundColor: "#EF4444", opacity: saving ? 0.6 : 1 }]}
                    >
                      {saving ? <ActivityIndicator color="#FFF" size="small" /> : (
                        <>
                          <Feather name="x-circle" size={18} color="#FFF" />
                          <Text style={s.actionBtnText}>Rechazar</Text>
                        </>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => handleAction("approve")}
                      disabled={saving}
                      style={[s.actionBtn, { backgroundColor: "#10B981", opacity: saving ? 0.6 : 1 }]}
                    >
                      {saving ? <ActivityIndicator color="#FFF" size="small" /> : (
                        <>
                          <Feather name="check-circle" size={18} color="#FFF" />
                          <Text style={s.actionBtnText}>Aprobar</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, children, theme }: any) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "700", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5 }}>{title}</Text>
      <View style={[{ backgroundColor: theme.backgroundSecondary, borderRadius: BorderRadius.md, padding: Spacing.md }]}>
        {children}
      </View>
    </View>
  );
}

function Row({ label, value, theme }: any) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 }}>
      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: theme.text, fontSize: 13, fontWeight: "600", flex: 1, textAlign: "right" }}>{value}</Text>
    </View>
  );
}

function DocRow({ label, url, theme }: any) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 }}>
      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{label}</Text>
      {url ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Feather name="check-circle" size={14} color="#10B981" />
          <Text style={{ color: "#10B981", fontSize: 12, fontWeight: "600" }}>Subido</Text>
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Feather name="alert-circle" size={14} color="#F59E0B" />
          <Text style={{ color: "#F59E0B", fontSize: 12, fontWeight: "600" }}>Pendiente</Text>
        </View>
      )}
    </View>
  );
}

function DocBadge({ label, has, theme }: any) {
  return (
    <View style={[s.badge, { backgroundColor: has ? "#10B981" + "20" : "#F59E0B" + "20" }]}>
      <Feather name={has ? "file-text" : "alert-circle"} size={10} color={has ? "#10B981" : "#F59E0B"} />
      <Text style={{ color: has ? "#10B981" : "#F59E0B", fontSize: 10, fontWeight: "600", marginLeft: 3 }}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  centered:    { flex: 1, justifyContent: "center", alignItems: "center" },
  filterRow:   { maxHeight: 52, marginBottom: 8 },
  filterChip:  { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5 },
  card:        { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, marginBottom: 10 },
  avatar:      { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  avatarImg:   { width: 48, height: 48, borderRadius: 24 },
  name:        { fontSize: 15, fontWeight: "700" },
  sub:         { fontSize: 13, marginTop: 1 },
  badge:       { flexDirection: "row", alignItems: "center", paddingVertical: 3, paddingHorizontal: 7, borderRadius: 6 },
  empty:       { padding: 40, borderRadius: 14, alignItems: "center", gap: 12 },
  emptyText:   { fontSize: 15, fontWeight: "600" },
  overlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:       { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "90%" },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#ccc", alignSelf: "center", marginBottom: 16 },
  sheetHeader: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  avatarLg:    { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  avatarLgImg: { width: 64, height: 64, borderRadius: 32 },
  statusBox:   { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, borderWidth: 1 },
  notesInput:  { borderWidth: 1.5, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: "top" },
  actions:     { flexDirection: "row", gap: 12, marginTop: 8, marginBottom: 20 },
  actionBtn:   { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 14, borderRadius: 12, gap: 8 },
  actionBtnText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
});
