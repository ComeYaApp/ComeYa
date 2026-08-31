import React, { useState, useEffect, useCallback } from "react";
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
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

const GREEN = "#16A34A";
const RED = "#EF4444";
const AMBER = "#F59E0B";

const STATUS_META: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  pending: { label: "Pendiente", color: AMBER, icon: "clock" },
  confirmed: { label: "Confirmada", color: GREEN, icon: "check-circle" },
  rejected: { label: "Rechazada", color: RED, icon: "x-circle" },
  cancelled: { label: "Cancelada", color: "#6B7280", icon: "slash" },
};

export default function BusinessReservationsScreenWeb() {
  const { isDark } = useTheme();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("upcoming");
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);

  const bg = isDark ? "#0d0d0d" : "#f2f3f5";
  const card = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#ebebeb";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#9a9a9a" : "#777";

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/reservations/business");
      const data = await res.json();
      if (data.success) setReservations(data.reservations || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const act = async (r: any, status: "confirmed" | "rejected") => {
    setActingId(r.id);
    try {
      await apiRequest(
        "PUT",
        `/api/reservations/business/${r.id}/status`,
        {
          status,
          businessNote: noteDraft[r.id] || "",
        },
      );
      load();
    } catch {
    } finally {
      setActingId(null);
    }
  };

  const displayed = reservations.filter((r: any) =>
    filter === "upcoming"
      ? r.status === "pending" || r.status === "confirmed"
      : true,
  );

  const pendingCount = reservations.filter(
    (r: any) => r.status === "pending",
  ).length;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={[s.header, { backgroundColor: card, borderBottomColor: border }]}>
        <View style={s.headerLeft}>
          <Text style={[s.title, { color: text }]}>📅 Reservas</Text>
          <Text style={[s.subtitle, { color: sub }]}>
            {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""} de confirmar
          </Text>
        </View>
        <View style={s.filterRow}>
          {[
            { id: "upcoming", label: "Pendientes y confirmadas" },
            { id: "all", label: "Todas" },
          ].map((f) => (
            <TouchableOpacity
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[
                s.filterChip,
                {
                  borderColor: filter === f.id ? RED : border,
                  backgroundColor: filter === f.id ? RED + "12" : "transparent",
                },
              ]}
            >
              <Text
                style={[s.filterChipTxt, { color: filter === f.id ? RED : sub }]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {loading && (
          <ActivityIndicator size="large" color={RED} style={{ marginTop: 40 }} />
        )}
        {!loading && displayed.length === 0 && (
          <View style={s.emptyState}>
            <Feather name="calendar" size={48} color={sub} />
            <Text style={[s.emptyTxt, { color: sub }]}>
              No hay reservas. Cuando un cliente reserve mesa aparecerá aquí.
            </Text>
          </View>
        )}

        {displayed.map((r: any) => {
          const meta = STATUS_META[r.status] || STATUS_META.pending;
          return (
            <View
              key={r.id}
              style={[s.card, { backgroundColor: card, borderColor: border }]}
            >
              <View style={s.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.customerName, { color: text }]}>
                    {r.customerName || "Cliente"}
                    {r.businessName ? (
                      <Text style={{ color: sub, fontWeight: "400" }}>
                        {" "}
                        · {r.businessName}
                      </Text>
                    ) : null}
                  </Text>
                  <Text style={[s.detailTxt, { color: sub }]}>
                    {new Date(`${r.date}T00:00:00`).toLocaleDateString("es-ES", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}{" "}
                    · {r.time} · {r.partySize} comensales
                    {r.customerPhone ? ` · 📞 ${r.customerPhone}` : ""}
                  </Text>
                  {r.notes ? (
                    <Text style={[s.detailTxt, { color: text, marginTop: 4 }]}>
                      📝 {r.notes}
                    </Text>
                  ) : null}
                </View>
                <View
                  style={[s.statusPill, { backgroundColor: meta.color + "18" }]}
                >
                  <Feather name={meta.icon as any} size={12} color={meta.color} />
                  <Text
                    style={[
                      s.statusPillTxt,
                      { color: meta.color },
                    ]}
                  >
                    {meta.label}
                  </Text>
                </View>
              </View>

              {r.status === "pending" && (
                <>
                  <TextInput
                    value={noteDraft[r.id] || ""}
                    onChangeText={(t) =>
                      setNoteDraft((prev) => ({ ...prev, [r.id]: t }))
                    }
                    placeholder="Nota para el cliente (opcional)"
                    placeholderTextColor={sub}
                    style={[
                      s.noteInput,
                      { color: text, borderColor: border },
                    ]}
                  />
                  <View style={s.actionsRow}>
                    <TouchableOpacity
                      onPress={() => act(r, "rejected")}
                      disabled={actingId === r.id}
                      style={[s.actionBtn, { backgroundColor: RED + "12", borderColor: RED + "40" }]}
                    >
                      <Feather name="x" size={14} color={RED} />
                      <Text style={[s.actionBtnTxt, { color: RED }]}>
                        Rechazar
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => act(r, "confirmed")}
                      disabled={actingId === r.id}
                      style={[s.actionBtn, { backgroundColor: GREEN, borderColor: GREEN }]}
                    >
                      <Feather name="check" size={14} color="#fff" />
                      <Text style={[s.actionBtnTxt, { color: "#fff" }]}>
                        Confirmar
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    flexWrap: "wrap",
    gap: 12,
  },
  headerLeft: { flex: 1, minWidth: 220 },
  title: { fontSize: 20, fontWeight: "800" },
  subtitle: { fontSize: 12, marginTop: 2 },
  filterRow: { flexDirection: "row", gap: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterChipTxt: { fontSize: 12, fontWeight: "700" },
  content: { padding: 24, paddingBottom: 60 },
  emptyState: { alignItems: "center", marginTop: 48, gap: 12 },
  emptyTxt: { fontSize: 14, textAlign: "center" },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start" },
  customerName: { fontSize: 15, fontWeight: "700" },
  detailTxt: { fontSize: 12.5, marginTop: 3 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginLeft: 8,
  },
  statusPillTxt: { fontSize: 11.5, fontWeight: "700", marginLeft: 4 },
  noteInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    marginTop: 12,
  },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnTxt: { fontSize: 13, fontWeight: "700" },
});
