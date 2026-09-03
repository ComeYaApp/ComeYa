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
import { apiRequest } from "@/lib/query-client";
import { AdminUser, ROLE_META } from "./UsersTab.web";

const PRIMARY = "#E60000";

const ROLES = [
  { id: "customer", label: "Cliente", color: "#6B7280", icon: "user" },
  {
    id: "business_owner",
    label: "Negocio",
    color: "#3B82F6",
    icon: "briefcase",
  },
  {
    id: "delivery_driver",
    label: "Repartidor",
    color: "#10B981",
    icon: "truck",
  },
  { id: "admin", label: "Admin", color: "#8B5CF6", icon: "shield" },
  { id: "super_admin", label: "Super Admin", color: "#E60000", icon: "star" },
];

interface Props {
  user: AdminUser;
  isDark: boolean;
  onClose: () => void;
  onUpdate: (u: AdminUser) => void;
}

export function UserDetail({ user, isDark, onClose, onUpdate }: Props) {
  const [processing, setProcessing] = useState(false);
  const [editRole, setEditRole] = useState(false);
  const [newRole, setNewRole] = useState(user.role);
  const [editName, setEditName] = useState(false);
  const [nameVal, setNameVal] = useState(user.name);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const card = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#ebebeb";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#666" : "#aaa";
  const inputBg = isDark ? "#222" : "#f8f8f8";

  const meta = ROLE_META[user.role] ?? ROLE_META.customer;

  const flash = (ok: boolean, txt: string) => {
    setMsg({ ok, text: txt });
    setTimeout(() => setMsg(null), 3000);
  };

  const toggleActive = async () => {
    const action = user.isActive ? "desactivar" : "activar";
    if (
      !window.confirm(
        `¿${action.charAt(0).toUpperCase() + action.slice(1)} a ${user.name}?`,
      )
    )
      return;
    setProcessing(true);
    try {
      const res = await apiRequest("PUT", `/api/admin/users/${user.id}`, {
        isActive: !user.isActive,
      });
      const data = await res.json();
      if (data.success) {
        flash(true, `Usuario ${action}do`);
        onUpdate({ ...user, isActive: !user.isActive });
      } else {
        flash(false, data.error ?? "Error");
      }
    } catch {
      flash(false, "Error de conexión");
    } finally {
      setProcessing(false);
    }
  };

  const saveRole = async () => {
    if (newRole === user.role) {
      setEditRole(false);
      return;
    }
    setProcessing(true);
    try {
      const res = await apiRequest("PUT", `/api/admin/users/${user.id}`, {
        role: newRole,
      });
      const data = await res.json();
      if (data.success) {
        flash(true, "Rol actualizado");
        onUpdate({ ...user, role: newRole });
        setEditRole(false);
      } else {
        flash(false, data.error ?? "Error");
      }
    } catch {
      flash(false, "Error de conexión");
    } finally {
      setProcessing(false);
    }
  };

  const saveName = async () => {
    if (!nameVal.trim() || nameVal === user.name) {
      setEditName(false);
      return;
    }
    setProcessing(true);
    try {
      const res = await apiRequest("PUT", `/api/admin/users/${user.id}`, {
        name: nameVal.trim(),
      });
      const data = await res.json();
      if (data.success) {
        flash(true, "Nombre actualizado");
        onUpdate({ ...user, name: nameVal.trim() });
        setEditName(false);
      } else {
        flash(false, data.error ?? "Error");
      }
    } catch {
      flash(false, "Error de conexión");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View
      style={[det.panel, { backgroundColor: card, borderLeftColor: border }]}
    >
      {/* Header */}
      <View style={[det.header, { borderBottomColor: border }]}>
        <View style={[det.avatar, { backgroundColor: meta.color + "20" }]}>
          <Text style={[det.avatarTxt, { color: meta.color }]}>
            {user.name?.charAt(0).toUpperCase() ?? "?"}
          </Text>
          {user.isOnline && <View style={det.onlineDot} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[det.name, { color: text }]} numberOfLines={1}>
            {user.name}
          </Text>
          <View style={[det.rolePill, { backgroundColor: meta.color + "18" }]}>
            <Feather name={meta.icon as any} size={10} color={meta.color} />
            <Text style={[det.roleTxt, { color: meta.color }]}>
              {meta.label}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
          <Feather name="x" size={18} color={sub} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Estado inactivo */}
        {!user.isActive && (
          <View
            style={[
              det.alertBox,
              { backgroundColor: "#EF444415", borderColor: "#EF444430" },
            ]}
          >
            <Feather name="user-x" size={13} color="#EF4444" />
            <Text style={[det.alertTxt, { color: "#EF4444" }]}>
              Cuenta desactivada
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

        {/* Info */}
        <View
          style={[
            det.section,
            {
              backgroundColor: isDark ? "#222" : "#f8f8f8",
              borderColor: border,
            },
          ]}
        >
          <Text style={[det.sectionTitle, { color: sub }]}>INFORMACIÓN</Text>
          {[
            { icon: "phone", label: "Teléfono", value: user.phone ?? "—" },
            { icon: "mail", label: "Email", value: user.email ?? "—" },
            {
              icon: "calendar",
              label: "Registrado",
              value: new Date(user.createdAt).toLocaleDateString("es-ES"),
            },
            {
              icon: "clock",
              label: "Últ. acceso",
              value: user.lastActiveAt
                ? new Date(user.lastActiveAt).toLocaleDateString("es-ES")
                : "—",
            },
          ].map((r) => (
            <View key={r.label} style={det.infoRow}>
              <Feather name={r.icon as any} size={13} color={sub} />
              <Text style={[det.infoLbl, { color: sub }]}>{r.label}</Text>
              <Text style={[det.infoVal, { color: text }]} numberOfLines={1}>
                {r.value}
              </Text>
            </View>
          ))}
        </View>

        {/* Verificaciones */}
        <View
          style={[
            det.section,
            {
              backgroundColor: isDark ? "#222" : "#f8f8f8",
              borderColor: border,
            },
          ]}
        >
          <Text style={[det.sectionTitle, { color: sub }]}>VERIFICACIONES</Text>
          {[
            { label: "Teléfono verificado", ok: user.phoneVerified },
            { label: "Email verificado", ok: user.emailVerified },
            { label: "Cuenta activa", ok: user.isActive },
          ].map((v) => (
            <View key={v.label} style={det.verifyRow}>
              <Feather
                name={v.ok ? "check-circle" : "x-circle"}
                size={14}
                color={v.ok ? "#10B981" : "#EF4444"}
              />
              <Text style={[det.verifyTxt, { color: text }]}>{v.label}</Text>
            </View>
          ))}
        </View>

        {/* Editar nombre */}
        <View
          style={[
            det.section,
            {
              backgroundColor: isDark ? "#222" : "#f8f8f8",
              borderColor: border,
            },
          ]}
        >
          <View style={det.sectionHeaderRow}>
            <Text style={[det.sectionTitle, { color: sub }]}>NOMBRE</Text>
            {!editName && (
              <TouchableOpacity onPress={() => setEditName(true)}>
                <Feather name="edit-2" size={13} color="#3B82F6" />
              </TouchableOpacity>
            )}
          </View>
          {editName ? (
            <View style={{ gap: 8 }}>
              <TextInput
                style={[
                  det.input,
                  {
                    backgroundColor: inputBg,
                    borderColor: border,
                    color: text,
                  },
                ]}
                value={nameVal}
                onChangeText={setNameVal}
                autoFocus
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => {
                    setEditName(false);
                    setNameVal(user.name);
                  }}
                  style={[det.btnSecondary, { flex: 1, borderColor: border }]}
                >
                  <Text style={[det.btnSecondaryTxt, { color: text }]}>
                    Cancelar
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveName}
                  disabled={processing}
                  style={[det.btnPrimary, { flex: 1 }]}
                >
                  {processing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={det.btnTxt}>Guardar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={[det.infoVal, { color: text }]}>{user.name}</Text>
          )}
        </View>

        {/* Cambiar rol */}
        <View
          style={[
            det.section,
            {
              backgroundColor: isDark ? "#222" : "#f8f8f8",
              borderColor: border,
            },
          ]}
        >
          <View style={det.sectionHeaderRow}>
            <Text style={[det.sectionTitle, { color: sub }]}>ROL</Text>
            {!editRole && (
              <TouchableOpacity
                onPress={() => {
                  setEditRole(true);
                  setNewRole(user.role);
                }}
              >
                <Feather name="edit-2" size={13} color="#3B82F6" />
              </TouchableOpacity>
            )}
          </View>
          {editRole ? (
            <View style={{ gap: 8 }}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => setNewRole(r.id)}
                  style={[
                    det.roleOption,
                    {
                      backgroundColor:
                        newRole === r.id ? r.color + "18" : "transparent",
                      borderColor: newRole === r.id ? r.color : border,
                    },
                  ]}
                >
                  <Feather
                    name={r.icon as any}
                    size={14}
                    color={newRole === r.id ? r.color : sub}
                  />
                  <Text
                    style={[
                      det.roleOptionTxt,
                      { color: newRole === r.id ? r.color : text },
                    ]}
                  >
                    {r.label}
                  </Text>
                  {newRole === r.id && (
                    <Feather
                      name="check"
                      size={13}
                      color={r.color}
                      style={{ marginLeft: "auto" as any }}
                    />
                  )}
                </TouchableOpacity>
              ))}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                <TouchableOpacity
                  onPress={() => setEditRole(false)}
                  style={[det.btnSecondary, { flex: 1, borderColor: border }]}
                >
                  <Text style={[det.btnSecondaryTxt, { color: text }]}>
                    Cancelar
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveRole}
                  disabled={processing}
                  style={[det.btnPrimary, { flex: 1 }]}
                >
                  {processing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={det.btnTxt}>Guardar rol</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View
              style={[
                det.rolePill,
                { backgroundColor: meta.color + "18", alignSelf: "flex-start" },
              ]}
            >
              <Feather name={meta.icon as any} size={12} color={meta.color} />
              <Text style={[det.roleTxt, { color: meta.color }]}>
                {meta.label}
              </Text>
            </View>
          )}
        </View>

        {/* Activar / Desactivar */}
        <TouchableOpacity
          onPress={toggleActive}
          disabled={processing}
          style={[user.isActive ? det.btnDanger : det.btnSuccess]}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather
                name={user.isActive ? "user-x" : "user-check"}
                size={14}
                color="#fff"
              />
              <Text style={det.btnTxt}>
                {user.isActive ? "Desactivar cuenta" : "Activar cuenta"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const det = StyleSheet.create({
  panel: { width: 320, borderLeftWidth: 1 },
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
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#fff",
  },
  name: { fontSize: 15, fontWeight: "700", marginBottom: 3 },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  roleTxt: { fontSize: 10, fontWeight: "700" },
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
  section: { borderRadius: 12, padding: 12, borderWidth: 1, gap: 8 },
  sectionTitle: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoLbl: { fontSize: 11, width: 80 },
  infoVal: { flex: 1, fontSize: 13, fontWeight: "600" },
  verifyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  verifyTxt: { fontSize: 13 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  roleOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  roleOptionTxt: { fontSize: 13, fontWeight: "600" },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: PRIMARY,
  },
  btnDanger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#EF4444",
  },
  btnSuccess: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#10B981",
  },
  btnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  btnSecondaryTxt: { fontSize: 13, fontWeight: "600" },
});
