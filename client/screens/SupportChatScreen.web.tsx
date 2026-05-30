import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Text,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/query-client";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";

const PRIMARY = "#DC2626";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  timestamp: new Date(),
  content:
    "¡Hola! Soy el asistente virtual de ComeYa. Estoy aquí para ayudarte con:\n\n• Información sobre tus pedidos\n• Consultas sobre productos y negocios\n• Tiempos de entrega\n• Métodos de pago\n• Cualquier otra duda\n\n¿En qué puedo ayudarte hoy?",
};

export default function SupportChatScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const cardBg = isDark ? "#2a2a2a" : "#f9fafb";

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        new URL("/api/support/chat", getApiUrl()).toString(),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: user?.id,
            message: userMsg.content,
            history: messages
              .slice(-10)
              .map((m) => ({ role: m.role, content: m.content })),
          }),
        },
      );
      const data = await res.json();
      if (data.response) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: data.response,
            timestamp: new Date(),
          },
        ]);
      } else throw new Error(data.error);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            "Lo siento, hubo un problema. Intenta de nuevo o contáctanos por WhatsApp.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: any) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <MobileSidebarWrapper
        title="Chat de Soporte"
        sidebarStyle={[
          s.sidebar,
          { backgroundColor: card, borderRightColor: border },
        ]}
      >
        <View style={[s.sideHeader, { borderBottomColor: border }]}>
          <View style={[s.botAvatar, { backgroundColor: PRIMARY + "15" }]}>
            <Feather name="message-circle" size={32} color={PRIMARY} />
          </View>
          <Text style={[s.sideTitle, { color: text }]}>Asistente ComeYa</Text>
          <Text style={[s.sideSub, { color: sub }]}>
            Respuestas instantáneas con IA
          </Text>
          <View
            style={[
              s.onlineBadge,
              { backgroundColor: "#10B98120", borderColor: "#10B98140" },
            ]}
          >
            <View style={[s.onlineDot, { backgroundColor: "#10B981" }]} />
            <Text style={{ color: "#10B981", fontSize: 12, fontWeight: "600" }}>
              En línea
            </Text>
          </View>
        </View>
        <View style={s.sideInfo}>
          <Text style={[s.sideInfoTitle, { color: text }]}>
            Puedo ayudarte con:
          </Text>
          {[
            "Estado de pedidos",
            "Métodos de pago",
            "Tiempos de entrega",
            "Problemas con productos",
            "Información general",
          ].map((item) => (
            <View key={item} style={s.sideInfoRow}>
              <Feather name="check" size={13} color={PRIMARY} />
              <Text style={[s.sideInfoText, { color: sub }]}>{item}</Text>
            </View>
          ))}
        </View>
        <View style={[s.sideFooter, { borderTopColor: border }]}>
          <Pressable
            onPress={() => navigation.navigate("Support")}
            style={s.backBtn}
          >
            <Feather name="arrow-left" size={16} color={sub} />
            <Text style={[s.backBtnText, { color: text }]}>Ver tickets</Text>
          </Pressable>
        </View>
      </MobileSidebarWrapper>

      {/* Chat area */}
      <View style={s.chatArea}>
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={s.messages}
          contentContainerStyle={s.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            const time = msg.timestamp.toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <View
                key={msg.id}
                style={[
                  s.bubbleWrap,
                  isUser ? s.bubbleWrapUser : s.bubbleWrapBot,
                ]}
              >
                {!isUser && (
                  <View
                    style={[
                      s.botAvatarSmall,
                      { backgroundColor: PRIMARY + "15" },
                    ]}
                  >
                    <Feather name="message-circle" size={14} color={PRIMARY} />
                  </View>
                )}
                <View
                  style={[
                    s.bubble,
                    isUser
                      ? [s.bubbleUser, { backgroundColor: PRIMARY }]
                      : [
                          s.bubbleBot,
                          { backgroundColor: card, borderColor: border },
                        ],
                  ]}
                >
                  {!isUser && (
                    <Text style={[s.bubbleName, { color: PRIMARY }]}>
                      ComeYa
                    </Text>
                  )}
                  <Text
                    style={[s.bubbleText, { color: isUser ? "#fff" : text }]}
                  >
                    {msg.content}
                  </Text>
                  <Text
                    style={[
                      s.bubbleTime,
                      { color: isUser ? "rgba(255,255,255,0.7)" : sub },
                    ]}
                  >
                    {time}
                  </Text>
                </View>
              </View>
            );
          })}
          {loading && (
            <View style={[s.bubbleWrap, s.bubbleWrapBot]}>
              <View
                style={[s.botAvatarSmall, { backgroundColor: PRIMARY + "15" }]}
              >
                <Feather name="message-circle" size={14} color={PRIMARY} />
              </View>
              <View
                style={[
                  s.bubble,
                  s.bubbleBot,
                  { backgroundColor: card, borderColor: border },
                ]}
              >
                <View style={s.typingDots}>
                  <View style={[s.dot, { backgroundColor: sub }]} />
                  <View style={[s.dot, { backgroundColor: sub }]} />
                  <View style={[s.dot, { backgroundColor: sub }]} />
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View
          style={[
            s.inputArea,
            { backgroundColor: card, borderTopColor: border },
          ]}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Escribe tu pregunta... (Enter para enviar)"
            placeholderTextColor={sub}
            multiline
            maxLength={1000}
            editable={!loading}
            onKeyPress={handleKey}
            style={[
              s.input,
              { backgroundColor: cardBg, color: text, borderColor: border },
            ]}
          />
          <Pressable
            onPress={sendMessage}
            disabled={!input.trim() || loading}
            style={[
              s.sendBtn,
              { backgroundColor: input.trim() && !loading ? PRIMARY : cardBg },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={sub} />
            ) : (
              <Feather
                name="send"
                size={18}
                color={input.trim() ? "#fff" : sub}
              />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", overflow: "hidden" as any },
  sidebar: { width: 280, borderRightWidth: 1, flexDirection: "column" as any },
  sideHeader: { padding: 24, alignItems: "center", borderBottomWidth: 1 },
  botAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  sideTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  sideSub: { fontSize: 12, textAlign: "center", marginBottom: 10 },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  sideInfo: { flex: 1, padding: 20 },
  sideInfoTitle: { fontSize: 13, fontWeight: "700", marginBottom: 10 },
  sideInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  sideInfoText: { fontSize: 13 },
  sideFooter: { borderTopWidth: 1, padding: 16 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backBtnText: { fontSize: 14, fontWeight: "600" },
  chatArea: { flex: 1, flexDirection: "column" },
  messages: { flex: 1 },
  messagesContent: { padding: 24, paddingBottom: 16, gap: 12 },
  bubbleWrap: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  bubbleWrapUser: { justifyContent: "flex-end" },
  bubbleWrapBot: { justifyContent: "flex-start" },
  botAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  bubble: { maxWidth: "70%", padding: 14, borderRadius: 16 },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleBot: { borderBottomLeftRadius: 4, borderWidth: 1 },
  bubbleName: { fontSize: 11, fontWeight: "700", marginBottom: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontSize: 11, alignSelf: "flex-end", marginTop: 4 },
  typingDots: { flexDirection: "row", gap: 4, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
});
