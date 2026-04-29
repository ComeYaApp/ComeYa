import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

const PRIMARY = "#DC2626";

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; desc: string }> = {
  restaurant: { label: "Restaurantes",  icon: "coffee",    color: "#F97316", desc: "Comida preparada, menús y platos del día" },
  market:     { label: "Mercados",      icon: "shopping-bag", color: "#10B981", desc: "Supermercados, fruterías y tiendas de alimentación" },
  store:      { label: "Tiendas",       icon: "package",   color: "#8B5CF6", desc: "Comercios locales y tiendas especializadas" },
  other:      { label: "Otros",         icon: "grid",      color: "#6B7280", desc: "Negocios sin categoría específica" },
};

interface Props {
  theme?: any;
  showToast?: (msg: string, type?: string) => void;
}

export const CategoriesTab: React.FC<Props> = () => {
  const { isDark } = useTheme();
  const [groups, setGroups]       = useState<Record<string, any[]>>({});
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded]   = useState<string | null>(null);

  const bg     = isDark ? "#0d0d0d" : "#f2f3f5";
  const card   = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#ebebeb";
  const text   = isDark ? "#fff"    : "#111";
  const sub    = isDark ? "#666"    : "#aaa";
  const rowBg  = isDark ? "#222"    : "#fafafa";

  const load = useCallback(async () => {
    try {
      const res  = await apiRequest("GET", "/api/admin/businesses");
      const data = await res.json();
      const list: any[] = data?.businesses ?? [];

      const grouped: Record<string, any[]> = {};
      list.forEach(b => {
        const key = b.type ?? "other";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(b);
      });
      setGroups(grouped);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalBusinesses = Object.values(groups).reduce((s, arr) => s + arr.length, 0);

  if (loading) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: bg }}>
      <ActivityIndicator size="large" color={PRIMARY} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View style={[hd.bar, { backgroundColor: card, borderBottomColor: border }]}>
        <View style={[hd.icon, { backgroundColor: "#8B5CF615" }]}>
          <Feather name="grid" size={16} color="#8B5CF6" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[hd.title, { color: text }]}>Categorías de negocios</Text>
          <Text style={[hd.sub, { color: sub }]}>{totalBusinesses} negocios en {Object.keys(groups).length} categorías</Text>
        </View>
        <View style={[hd.infoPill, { backgroundColor: "#3B82F610", borderColor: "#3B82F630" }]}>
          <Feather name="info" size={11} color="#3B82F6" />
          <Text style={[hd.infoTxt, { color: "#3B82F6" }]}>Solo lectura · el tipo se edita en cada negocio</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={PRIMARY} />}
      >
        {Object.entries(groups).length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 60, gap: 12 }}>
            <Feather name="grid" size={40} color={sub} />
            <Text style={{ color: sub, fontSize: 15 }}>Sin negocios registrados</Text>
          </View>
        ) : (
          Object.entries(groups).map(([type, bizList]) => {
            const cfg     = TYPE_CONFIG[type] ?? TYPE_CONFIG.other;
            const isOpen  = expanded === type;
            const active  = bizList.filter(b => b.isActive).length;
            const inactive = bizList.length - active;

            return (
              <View key={type} style={[cat.card, { backgroundColor: card, borderColor: border, borderLeftColor: cfg.color }]}>
                {/* Category header */}
                <TouchableOpacity
                  onPress={() => setExpanded(isOpen ? null : type)}
                  style={cat.header}
                >
                  <View style={[cat.iconWrap, { backgroundColor: cfg.color + "15" }]}>
                    <Feather name={cfg.icon as any} size={18} color={cfg.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[cat.catName, { color: text }]}>{cfg.label}</Text>
                    <Text style={[cat.catDesc, { color: sub }]}>{cfg.desc}</Text>
                  </View>
                  {/* Stats */}
                  <View style={cat.statsRow}>
                    <View style={[cat.statPill, { backgroundColor: cfg.color + "15" }]}>
                      <Text style={[cat.statTxt, { color: cfg.color }]}>{bizList.length} total</Text>
                    </View>
                    <View style={[cat.statPill, { backgroundColor: "#10B98115" }]}>
                      <Text style={[cat.statTxt, { color: "#10B981" }]}>{active} activos</Text>
                    </View>
                    {inactive > 0 && (
                      <View style={[cat.statPill, { backgroundColor: "#EF444415" }]}>
                        <Text style={[cat.statTxt, { color: "#EF4444" }]}>{inactive} inactivos</Text>
                      </View>
                    )}
                  </View>
                  <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={sub} style={{ marginLeft: 8 }} />
                </TouchableOpacity>

                {/* Business list */}
                {isOpen && (
                  <View style={[cat.listWrap, { borderTopColor: border }]}>
                    {bizList.map((biz, i) => (
                      <View
                        key={biz.id}
                        style={[
                          cat.bizRow,
                          { backgroundColor: rowBg, borderBottomColor: border },
                          i === bizList.length - 1 && { borderBottomWidth: 0 },
                        ]}
                      >
                        <View style={[cat.bizDot, { backgroundColor: biz.isActive ? "#10B981" : "#EF4444" }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={[cat.bizName, { color: text }]}>{biz.name}</Text>
                          {biz.address && (
                            <Text style={[cat.bizAddr, { color: sub }]} numberOfLines={1}>{biz.address}</Text>
                          )}
                        </View>
                        <View style={[cat.bizStatus, { backgroundColor: biz.isActive ? "#10B98112" : "#EF444412" }]}>
                          <Text style={[cat.bizStatusTxt, { color: biz.isActive ? "#10B981" : "#EF4444" }]}>
                            {biz.isActive ? "Activo" : "Inactivo"}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const hd = StyleSheet.create({
  bar:     { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  icon:    { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  title:   { fontSize: 15, fontWeight: "700" },
  sub:     { fontSize: 11, marginTop: 1 },
  infoPill:{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  infoTxt: { fontSize: 10, fontWeight: "600" },
});

const cat = StyleSheet.create({
  card:     { borderRadius: 14, borderWidth: 1, borderLeftWidth: 3, overflow: "hidden" },
  header:   { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  catName:  { fontSize: 15, fontWeight: "700" },
  catDesc:  { fontSize: 11, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  statPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statTxt:  { fontSize: 11, fontWeight: "700" },
  listWrap: { borderTopWidth: 1 },
  bizRow:   { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  bizDot:   { width: 7, height: 7, borderRadius: 4 },
  bizName:  { fontSize: 13, fontWeight: "600" },
  bizAddr:  { fontSize: 11, marginTop: 1 },
  bizStatus:{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  bizStatusTxt: { fontSize: 10, fontWeight: "700" },
});
