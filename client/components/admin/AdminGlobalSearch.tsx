import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest, getApiErrorMessage } from "@/lib/query-client";

export type AdminSearchResult = {
  type: "user" | "business" | "order" | "driver";
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  total?: number;
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (result: AdminSearchResult) => void;
}

const GROUP_META: Array<{
  key: "users" | "businesses" | "orders" | "drivers";
  label: string;
  type: AdminSearchResult["type"];
  icon: string;
  color: string;
}> = [
  { key: "users", label: "USUARIOS", type: "user", icon: "user", color: "#F59E0B" },
  {
    key: "businesses",
    label: "NEGOCIOS",
    type: "business",
    icon: "briefcase",
    color: "#10B981",
  },
  {
    key: "orders",
    label: "PEDIDOS",
    type: "order",
    icon: "package",
    color: "#3B82F6",
  },
  {
    key: "drivers",
    label: "REPARTIDORES",
    type: "driver",
    icon: "truck",
    color: "#8B5CF6",
  },
];

export function AdminGlobalSearch({ visible, onClose, onSelect }: Props) {
  const { theme } = useTheme();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setGroups(null);
      setError(null);
      setLoading(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const q = query.trim();
    if (q.length < 2) {
      setGroups(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const res = await apiRequest(
          "GET",
          `/api/admin/search?q=${encodeURIComponent(q)}&limit=5`,
        );
        const data = await res.json();
        if (id !== requestId.current) return;
        if (data.success) {
          setGroups(data.groups ?? null);
          setError(null);
        } else {
          setError(data.error ?? "Error de búsqueda");
        }
      } catch (err) {
        if (id !== requestId.current) return;
        setError(getApiErrorMessage(err, "Error de búsqueda"));
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, visible]);

  const totalResults = useMemo(() => {
    if (!groups) return 0;
    return GROUP_META.reduce(
      (sum, group) => sum + (groups[group.key]?.items?.length ?? 0),
      0,
    );
  }, [groups]);

  const handleSelect = (result: AdminSearchResult) => {
    onSelect(result);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View
          style={[
            s.panel,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={[s.searchRow, { borderBottomColor: theme.border }]}>
            <Feather name="search" size={18} color={theme.textSecondary} />
            <TextInput
              style={[s.input, { color: theme.text }]}
              placeholder="Buscar usuario, negocio, pedido o repartidor..."
              placeholderTextColor={theme.textSecondary}
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
            />
            {loading ? (
              <ActivityIndicator size="small" color="#E60000" />
            ) : query.length > 0 ? (
              <Pressable onPress={() => setQuery("")}>
                <Feather name="x" size={17} color={theme.textSecondary} />
              </Pressable>
            ) : null}
            <Pressable onPress={onClose} style={s.closeBtn}>
              <Feather name="x" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={{ maxHeight: 420 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 12 }}
          >
            {error ? (
              <Text style={[s.hint, { color: "#EF4444" }]}>{error}</Text>
            ) : query.trim().length < 2 ? (
              <Text style={[s.hint, { color: theme.textSecondary }]}>
                Escribe al menos 2 caracteres para buscar.
              </Text>
            ) : loading && !groups ? (
              <View style={s.center}>
                <ActivityIndicator color="#E60000" />
              </View>
            ) : totalResults === 0 ? (
              <Text style={[s.hint, { color: theme.textSecondary }]}>
                Sin resultados para “{query.trim()}”.
              </Text>
            ) : (
              GROUP_META.map((group) => {
                const data = groups?.[group.key];
                if (!data?.items?.length) return null;
                return (
                  <View key={group.key} style={{ marginBottom: 14 }}>
                    <Text
                      style={[
                        s.groupLabel,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {group.label}
                      {data.hasMore ? " · más resultados" : ""}
                    </Text>
                    {data.items.map((item: AdminSearchResult) => (
                      <Pressable
                        key={`${item.type}:${item.id}`}
                        onPress={() => handleSelect(item)}
                        style={[
                          s.result,
                          {
                            backgroundColor: theme.backgroundSecondary,
                            borderColor: theme.border,
                          },
                        ]}
                      >
                        <View
                          style={[
                            s.resultIcon,
                            { backgroundColor: group.color + "18" },
                          ]}
                        >
                          <Feather
                            name={group.icon as any}
                            size={15}
                            color={group.color}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[s.resultTitle, { color: theme.text }]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          {item.subtitle ? (
                            <Text
                              style={[
                                s.resultSub,
                                { color: theme.textSecondary },
                              ]}
                              numberOfLines={1}
                            >
                              {item.subtitle}
                            </Text>
                          ) : null}
                        </View>
                        <Feather
                          name="chevron-right"
                          size={15}
                          color={theme.textSecondary}
                        />
                      </Pressable>
                    ))}
                  </View>
                );
              })
            )}
          </ScrollView>

          <View style={[s.footer, { borderTopColor: theme.border }]}>
            <Text style={[s.footerText, { color: theme.textSecondary }]}>
              {Platform.OS === "web"
                ? "Ctrl/Cmd + K para abrir · Esc para cerrar"
                : "Busca en todo el panel"}
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 80,
    paddingHorizontal: 16,
  },
  panel: {
    width: "100%",
    maxWidth: 620,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  input: { flex: 1, fontSize: 15, padding: 0 },
  closeBtn: { padding: 4 },
  center: { paddingVertical: 28, alignItems: "center" },
  hint: { fontSize: 13, paddingVertical: 20, textAlign: "center" },
  groupLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 6,
  },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  resultIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  resultTitle: { fontSize: 13, fontWeight: "700" },
  resultSub: { fontSize: 11, marginTop: 1 },
  footer: { borderTopWidth: 1, padding: 9, alignItems: "center" },
  footerText: { fontSize: 10 },
});
