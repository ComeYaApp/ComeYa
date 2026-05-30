import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface ChatMessage {
  id: string;
  orderId: string;
  senderId: string;
  receiverId: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

export default function OrderChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute() as any;
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const flatListRef = useRef<FlatList>(null);

  const { orderId, receiverId, receiverName } = route.params || {};
  const [messageText, setMessageText] = useState("");
  const [orderMeta, setOrderMeta] = useState<any>(null);

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const inputBg = isDark ? "#2a2a2a" : "#f5f5f5";

  useEffect(() => {
    if (!orderId) return;
    apiRequest("GET", `/api/orders/${orderId}`)
      .then((r) => r.json())
      .then((d) => setOrderMeta(d?.order || d))
      .catch(() => {});
  }, [orderId]);

  const resolvedReceiverId = useMemo(() => {
    if (receiverId) return receiverId;
    if (!orderMeta || !user) return undefined;
    if (user.role === "delivery_driver")
      return orderMeta.userId || orderMeta.customerId;
    if (user.role === "customer")
      return orderMeta.deliveryPersonId || orderMeta.businessId;
    if (user.role === "business_owner")
      return orderMeta.userId || orderMeta.customerId;
    return undefined;
  }, [receiverId, orderMeta, user]);

  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/orders", orderId, "chat"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/orders/${orderId}/chat`);
      const data = await res.json();
      return data || [];
    },
    refetchInterval: 3000,
    enabled: !!orderId,
  });

  const sendMutation = useMutation({
    mutationFn: async (msg: string) => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/chat`, {
        senderId: user?.id,
        receiverId: resolvedReceiverId,
        message: msg,
      });
      if (!res.ok) throw new Error("No se pudo enviar el mensaje");
      return res.json();
    },
    onMutate: async (msg: string) => {
      if (!user?.id) return;
      const optimistic: ChatMessage = {
        id: `temp-${Date.now()}`,
        orderId,
        senderId: user.id,
        receiverId: resolvedReceiverId || "",
        message: msg,
        createdAt: new Date().toISOString(),
        isRead: false,
      };
      await queryClient.cancelQueries({
        queryKey: ["/api/orders", orderId, "chat"],
      });
      const prev =
        queryClient.getQueryData<ChatMessage[]>([
          "/api/orders",
          orderId,
          "chat",
        ]) || [];
      queryClient.setQueryData(
        ["/api/orders", orderId, "chat"],
        [...prev, optimistic],
      );
      setMessageText("");
      return { prev };
    },
    onError: (_, __, ctx) => {
      if (ctx?.prev)
        queryClient.setQueryData(["/api/orders", orderId, "chat"], ctx.prev);
      showToast("No se pudo enviar el mensaje", "error");
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["/api/orders", orderId, "chat"],
      }),
  });

  const handleSend = () => {
    if (!messageText.trim() || !resolvedReceiverId) return;
    sendMutation.mutate(messageText.trim());
  };

  const handleKeyDown = (e: any) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* Header */}
      <View
        style={[s.header, { backgroundColor: card, borderBottomColor: border }]}
      >
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={text} />
        </Pressable>
        <View
          style={[
            s.avatarCircle,
            { backgroundColor: ComeYaColors.primary + "20" },
          ]}
        >
          <Feather name="user" size={18} color={ComeYaColors.primary} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[s.headerName, { color: text }]}>
            {receiverName || "Chat"}
          </Text>
          <Text style={[s.headerSub, { color: sub }]}>
            Pedido #{orderId?.slice(-6)}
          </Text>
        </View>
      </View>

      {/* Messages */}
      <View style={s.messagesArea}>
        {sortedMessages.length === 0 ? (
          <View style={s.empty}>
            <Feather name="message-circle" size={48} color={sub} />
            <Text style={[s.emptyText, { color: sub }]}>
              Inicia una conversación
            </Text>
          </View>
        ) : (
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {sortedMessages.map((msg) => {
              const isOwn = msg.senderId === user?.id;
              const time = new Date(msg.createdAt).toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    justifyContent: isOwn ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "70%",
                      padding: "10px 14px",
                      borderRadius: isOwn
                        ? "18px 18px 4px 18px"
                        : "18px 18px 18px 4px",
                      backgroundColor: isOwn ? ComeYaColors.primary : card,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        color: isOwn ? "#fff" : text,
                        fontSize: 15,
                        lineHeight: 1.4,
                      }}
                    >
                      {msg.message}
                    </p>
                    <p
                      style={{
                        margin: "4px 0 0",
                        color: isOwn ? "rgba(255,255,255,0.7)" : sub,
                        fontSize: 11,
                        textAlign: "right",
                      }}
                    >
                      {time}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </View>

      {/* Input */}
      <View
        style={[s.inputArea, { backgroundColor: card, borderTopColor: border }]}
      >
        <textarea
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje... (Enter para enviar)"
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            border: `1.5px solid ${border}`,
            borderRadius: 12,
            padding: "10px 14px",
            fontSize: 15,
            backgroundColor: inputBg,
            color: text,
            outline: "none",
            fontFamily: "inherit",
            maxHeight: 100,
          }}
        />
        <Pressable
          onPress={handleSend}
          disabled={
            !messageText.trim() || sendMutation.isPending || !resolvedReceiverId
          }
          style={[
            s.sendBtn,
            {
              backgroundColor: messageText.trim()
                ? ComeYaColors.primary
                : border,
            },
          ]}
        >
          {sendMutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Feather name="send" size={18} color="#fff" />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "column" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerName: { fontSize: 16, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 1 },
  messagesArea: { flex: 1, overflow: "hidden" } as any,
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingVertical: 80,
  },
  emptyText: { fontSize: 15 },
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
});
