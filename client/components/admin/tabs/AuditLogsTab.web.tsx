import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

const PRIMARY = "#E60000";

const ACTION_COLORS: Record<string, string> = {
  LOGIN_SUCCESS: "#10B981",
  LOGIN_FAILED: "#EF4444",
  RATE_LIMIT_BLOCKED: "#EF4444",
  CREATE: "#3B82F6",
  UPDATE: "#F59E0B",
  DELETE: "#EF4444",
  APPROVE: "#10B981",
  REJECT: "#EF4444",
  BLOCK: "#EF4444",
  UNBLOCK: "#10B981",
};

export function AuditLogsTab() {
  const { isDark } = useTheme();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const bg = isDark ? "#0d0d0d" : "#f2f3f5";
  const card = isDark ? "#1a1a1a" : "#fff";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#aaa" : "#666";
  const border = isDark ? "#333" : "#e8e8e8";

  useEffect(() => {
    setLoading(true);
    apiRequest(
      "GET",
      `/api/admin/logs?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setLogs(data.logs || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  if (loading)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: bg,
          padding: 40,
        }}
      >
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <View style={{ padding: 28, paddingBottom: 12 }}>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "800",
            color: text,
            marginBottom: 4,
          }}
        >
          Logs de Auditoría
        </Text>
        <Text style={{ fontSize: 14, color: sub }}>
          {logs.length} registros
        </Text>
      </View>

      {logs.length === 0 ? (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 40,
          }}
        >
          <Feather name="file-text" size={48} color={sub} />
          <Text style={{ color: sub, marginTop: 16, fontSize: 16 }}>
            No hay registros de auditoría
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 28,
            paddingTop: 0,
            paddingBottom: 60,
          }}
          showsVerticalScrollIndicator={false}
        >
          {logs.map((log: any) => {
            const actionColor = ACTION_COLORS[log.action] || sub;
            return (
              <View
                key={log.id}
                style={{
                  backgroundColor: card,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: border,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: actionColor + "20",
                      paddingVertical: 4,
                      paddingHorizontal: 10,
                      borderRadius: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: actionColor,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {log.action}
                    </Text>
                  </View>
                  <Text style={{ color: sub, fontSize: 12 }}>
                    {new Date(log.createdAt || log.created_at).toLocaleString(
                      "es-ES",
                    )}
                  </Text>
                </View>
                <Text style={{ color: text, fontSize: 13, marginBottom: 4 }}>
                  {log.entityType || log.entity_type || "—"}
                  {log.entityId || log.entity_id
                    ? ` · ID: ${(log.entityId || log.entity_id).slice(0, 8)}...`
                    : ""}
                </Text>
                {log.changes ? (
                  <Text style={{ color: sub, fontSize: 12, marginBottom: 2 }}>
                    Cambios: {log.changes}
                  </Text>
                ) : null}
                <View style={{ flexDirection: "row", gap: 16, marginTop: 4 }}>
                  {log.userId || log.user_id ? (
                    <Text style={{ color: sub, fontSize: 11 }}>
                      Usuario: {(log.userId || log.user_id).slice(0, 8)}...
                    </Text>
                  ) : null}
                  {log.ipAddress || log.ip_address ? (
                    <Text style={{ color: sub, fontSize: 11 }}>
                      IP: {log.ipAddress || log.ip_address}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              gap: 12,
              marginTop: 8,
            }}
          >
            <Pressable
              onPress={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: page === 0 ? border : PRIMARY,
              }}
            >
              <Text
                style={{ color: page === 0 ? sub : "#fff", fontWeight: "600" }}
              >
                ← Anterior
              </Text>
            </Pressable>
            <Text style={{ color: sub, alignSelf: "center" }}>
              Página {page + 1}
            </Text>
            <Pressable
              onPress={() => setPage((p) => p + 1)}
              disabled={logs.length < PAGE_SIZE}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: logs.length < PAGE_SIZE ? border : PRIMARY,
              }}
            >
              <Text
                style={{
                  color: logs.length < PAGE_SIZE ? sub : "#fff",
                  fontWeight: "600",
                }}
              >
                Siguiente →
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
