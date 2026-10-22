import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ComeYaLogo } from "@/components/ComeYaLogo";
import { useTheme } from "@/hooks/useTheme";
import { getApiUrl } from "@/lib/query-client";
import { getWebTabBarHeight } from "@/constants/layout";

const PRIMARY = "#E60000";
const GRAPHITE = "#1A1A1A";
const TEASER_KEY = "comeya_ai_teaser_seen";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "¡Hola! Soy el asistente de ComeYa. ¿Puedo ayudarte en algo?",
};

const SUGGESTIONS = [
  "¿Dónde está mi pedido?",
  "¿Cómo puedo pagar?",
  "¿Qué incluye ComeYaPass?",
];

/**
 * Chat de IA flotante para la versión web. Vive fuera del árbol de pantallas
 * para estar disponible en toda la app (inicio, negocios, perfil, etc.).
 * No abre el panel automáticamente: muestra un aviso discreto y espera clic.
 */
export function WebAIChatWidget({
  hidden = false,
}: {
  hidden?: boolean;
}) {
  const { isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const card = isDark ? "#1e1e1e" : "#ffffff";
  const border = isDark ? "#333333" : "#e8e8e8";
  const text = isDark ? "#ffffff" : "#1a1a1a";
  const sub = isDark ? "#9ca3af" : "#6b7280";
  const botBubble = isDark ? "#262626" : "#f5f5f5";
  const panelWidth = Math.min(370, Math.max(300, width - 28));
  const isMobile = width < 768;

  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "";
  const isAuthRoute = /^\/(login|signup|verifyphone)/i.test(pathname);
  const isSupportRoute = /support/i.test(pathname);
  const withoutTabBar =
    /^\/(login|signup|cart|businessdetail|publictracking|support|supportchat|verifyphone)/i.test(
      pathname,
    );
  const bottomOffset = withoutTabBar
    ? 20 + Math.max(insets.bottom, 0)
    : getWebTabBarHeight(isMobile, insets.bottom) + 16;

  const panelMaxHeight = Math.min(560, Math.max(320, height - 150));
  const messagesMaxHeight = Math.max(140, panelMaxHeight - 170);

  useEffect(() => {
    if (hidden || isAuthRoute || isSupportRoute) {
      setTeaser(false);
      return;
    }
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    let dismissed = false;
    try {
      dismissed = window.sessionStorage.getItem(TEASER_KEY) === "1";
    } catch {}
    if (dismissed) return;

    const timer = setTimeout(() => setTeaser(true), 5000);
    return () => clearTimeout(timer);
  }, [hidden, isAuthRoute, isSupportRoute]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      120,
    );
    return () => clearTimeout(timer);
  }, [messages, open, loading]);

  const openChat = () => {
    setTeaser(false);
    setOpen(true);
    try {
      window.sessionStorage.setItem(TEASER_KEY, "1");
    } catch {}
  };

  const close = () => {
    setOpen(false);
    try {
      window.sessionStorage.setItem(TEASER_KEY, "1");
    } catch {}
  };

  const dismissTeaser = () => {
    setTeaser(false);
    try {
      window.sessionStorage.setItem(TEASER_KEY, "1");
    } catch {}
  };

  const send = async (raw?: string) => {
    const content = (raw ?? input).trim();
    if (!content || loading) return;

    const userMessage: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("token")
          : null;
      const endpoint = token ? "/api/support/chat" : "/api/support/chat-public";
      const history = messages
        .filter((m) => m.id !== "welcome")
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(new URL(endpoint, getApiUrl()).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: content,
          history,
        }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !data?.response) {
        const error: any = new Error(data?.error || `Error ${res.status}`);
        error.code = data?.code;
        throw error;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.response,
        },
      ]);
    } catch (error: any) {
      const aborted = error?.name === "AbortError";
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: aborted
            ? "El asistente tardó demasiado. Intenta de nuevo o crea un ticket desde Ayuda y soporte."
            : error?.code === "AI_NOT_CONFIGURED"
              ? "El asistente de IA todavía no está activado. Crea un ticket desde Ayuda y soporte."
              : "No pude responder en este momento. Intenta de nuevo o crea un ticket desde Ayuda y soporte.",
        },
      ]);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  if (Platform.OS !== "web" || hidden || isAuthRoute || isSupportRoute) {
    return null;
  }

  return (
    <View
      style={[
        styles.root,
        { right: isMobile ? 12 : 20, bottom: bottomOffset },
      ]}
      pointerEvents="box-none"
    >
      {teaser && !open && (
        <View style={styles.teaserWrap}>
          <Pressable
            onPress={openChat}
            style={[
              styles.teaser,
              { backgroundColor: card, borderColor: border },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Abrir chat: ¿Puedo ayudarte en algo?"
          >
            <View style={styles.teaserTextWrap}>
              <Text style={[styles.teaserLabel, { color: PRIMARY }]}>
                Asistente ComeYa
              </Text>
              <Text style={[styles.teaserText, { color: text }]}>
                ¿Puedo ayudarte en algo?
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={sub} />
          </Pressable>
          <Pressable
            onPress={dismissTeaser}
            style={styles.teaserClose}
            accessibilityLabel="Cerrar aviso del asistente"
            hitSlop={8}
          >
            <Feather name="x" size={12} color="#fff" />
          </Pressable>
        </View>
      )}

      {open && (
        <View
          style={[
            styles.panel,
            {
              width: panelWidth,
              maxHeight: panelMaxHeight,
              backgroundColor: card,
              borderColor: border,
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerLogo}>
              <ComeYaLogo size={42} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Asistente ComeYa</Text>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>En línea</Text>
              </View>
            </View>
            <Pressable
              onPress={close}
              style={styles.closeBtn}
              accessibilityLabel="Cerrar chat"
            >
              <Feather name="x" size={18} color="#fff" />
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            style={[styles.messages, { maxHeight: messagesMaxHeight }]}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <View
                  key={message.id}
                  style={[
                    styles.bubble,
                    isUser
                      ? [styles.userBubble, { backgroundColor: PRIMARY }]
                      : [styles.botBubble, { backgroundColor: botBubble }],
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      { color: isUser ? "#fff" : text },
                    ]}
                  >
                    {message.content}
                  </Text>
                </View>
              );
            })}

            {messages.length === 1 && (
              <View style={styles.suggestions}>
                {SUGGESTIONS.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    onPress={() => send(suggestion)}
                    style={[
                      styles.suggestion,
                      { borderColor: PRIMARY + "55" },
                    ]}
                  >
                    <Text style={[styles.suggestionText, { color: PRIMARY }]}>
                      {suggestion}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {loading && (
              <View
                style={[styles.botBubble, { backgroundColor: botBubble }]}
              >
                <View style={styles.typingRow}>
                  <ActivityIndicator size="small" color={PRIMARY} />
                  <Text style={[styles.typingText, { color: sub }]}>
                    Escribiendo…
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={[styles.inputRow, { borderTopColor: border }]}>
            <TextInput
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => send()}
              onKeyPress={(event: any) => {
                if (
                  Platform.OS === "web" &&
                  event?.nativeEvent?.key === "Enter" &&
                  !event?.nativeEvent?.shiftKey
                ) {
                  event.preventDefault?.();
                  send();
                }
              }}
              placeholder="Escribe tu pregunta…"
              placeholderTextColor={sub}
              editable={!loading}
              multiline
              style={[
                styles.input,
                {
                  color: text,
                  backgroundColor: isDark ? "#141414" : "#f7f7f7",
                  borderColor: border,
                },
              ]}
            />
            <Pressable
              onPress={() => send()}
              disabled={loading || !input.trim()}
              style={[
                styles.sendBtn,
                { opacity: loading || !input.trim() ? 0.45 : 1 },
              ]}
              accessibilityLabel="Enviar mensaje"
            >
              <Feather name="send" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>
      )}

      <Pressable
        onPress={() => (open ? close() : openChat())}
        style={[styles.fab, { backgroundColor: "#EB0000" }]}
        accessibilityLabel="Abrir chat de ayuda"
        accessibilityState={{ expanded: open }}
      >
        <ComeYaLogo size={56} style={{ borderRadius: 28 }} />
        <View style={styles.fabBadge}>
          <Feather name="message-circle" size={10} color="#fff" />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    zIndex: 10000,
    alignItems: "flex-end",
    gap: 10,
    ...(Platform.OS === "web"
      ? ({ pointerEvents: "box-none" } as any)
      : {}),
  },
  teaserWrap: {
    position: "relative",
    maxWidth: 250,
    alignItems: "flex-end",
  },
  teaser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 15,
    ...(Platform.OS === "web"
      ? ({
          boxShadow: "0 14px 38px rgba(26,26,26,0.2)",
        } as any)
      : { elevation: 8 }),
  },
  teaserTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  teaserLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  teaserText: {
    fontSize: 12.5,
    fontWeight: "600",
    lineHeight: 17,
  },
  teaserClose: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: "#1A1A1A",
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  panel: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? ({
          boxShadow: "0 18px 50px rgba(0,0,0,0.28)",
        } as any)
      : { elevation: 12 }),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: GRAPHITE,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerLogo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EB0000",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  statusText: { color: "#D1D5DB", fontSize: 11, fontWeight: "600" },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFFFFF1A",
    alignItems: "center",
    justifyContent: "center",
  },
  messages: {},
  messagesContent: { padding: 14, gap: 10 },
  bubble: {
    maxWidth: "86%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  userBubble: { alignSelf: "flex-end", borderBottomRightRadius: 5 },
  botBubble: { alignSelf: "flex-start", borderBottomLeftRadius: 5 },
  bubbleText: { fontSize: 13.5, lineHeight: 19 },
  suggestions: { gap: 7, marginTop: 4 },
  suggestion: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
    alignSelf: "flex-start",
    backgroundColor: "#E6000010",
  },
  suggestionText: { fontSize: 12.5, fontWeight: "700" },
  typingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  typingText: { fontSize: 12.5 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 96,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#EB0000",
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0 8px 24px rgba(235,0,0,0.35)" } as any)
      : { elevation: 10 }),
  },
  fabBadge: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: PRIMARY,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
