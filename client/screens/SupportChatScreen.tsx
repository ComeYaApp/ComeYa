import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "¡Hola! Soy el asistente virtual de ComeYa. Estoy aquí para ayudarte con:\n\n• Información sobre tus pedidos\n• Consultas sobre productos y negocios\n• Tiempos de entrega\n• Métodos de pago\n• Cualquier otra duda\n\n¿En qué puedo ayudarte hoy?",
  timestamp: new Date(),
};

function MessageBubble({ message }: { message: Message }) {
  const { theme } = useTheme();
  const isUser = message.role === "user";
  const time = message.timestamp.toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Animated.View
      entering={FadeInUp.springify()}
      style={[
        styles.messageBubble,
        isUser ? styles.userMessage : styles.assistantMessage,
        {
          backgroundColor: isUser ? ComeYaColors.primary : theme.card,
          ...Shadows.sm,
        },
      ]}
    >
      {!isUser ? (
        <View style={styles.assistantHeader}>
          <View
            style={[
              styles.botIcon,
              { backgroundColor: ComeYaColors.primary + "20" },
            ]}
          >
            <Image
              source={require("../../assets/images/comeya-logo-final.png")}
              style={{ width: 16, height: 16 }}
              resizeMode="contain"
            />
          </View>
          <ThemedText
            type="caption"
            style={{ color: ComeYaColors.primary, fontWeight: "600" }}
          >
            ComeYa
          </ThemedText>
        </View>
      ) : null}
      <ThemedText
        type="body"
        style={{ color: isUser ? "#FFFFFF" : theme.text }}
      >
        {message.content}
      </ThemedText>
      <ThemedText
        type="caption"
        style={{
          color: isUser ? "rgba(255,255,255,0.7)" : theme.textSecondary,
          alignSelf: "flex-end",
          marginTop: Spacing.xs,
        }}
      >
        {time}
      </ThemedText>
    </Animated.View>
  );
}

function EmptyState() {
  const { theme } = useTheme();
  return (
    <View style={styles.emptyState}>
      <View
        style={[
          styles.emptyIcon,
          { backgroundColor: ComeYaColors.primary + "20" },
        ]}
      >
        <Feather name="message-circle" size={48} color={ComeYaColors.primary} />
      </View>
      <Image
        source={require("../../assets/images/comeya-logo-final.png")}
        style={{ width: 80, height: 80, marginTop: Spacing.md }}
        resizeMode="contain"
      />
      <ThemedText
        type="h3"
        style={{ marginTop: Spacing.lg, textAlign: "center" }}
      >
        Chat de Soporte
      </ThemedText>
      <ThemedText
        type="body"
        style={{
          color: theme.textSecondary,
          textAlign: "center",
          marginTop: Spacing.sm,
          paddingHorizontal: Spacing.xl,
        }}
      >
        Pregúntame lo que necesites sobre ComeYa
      </ThemedText>
    </View>
  );
}

function TypingIndicator() {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.typingContainer,
        { backgroundColor: theme.card },
        Shadows.sm,
      ]}
    >
      <View style={styles.typingDots}>
        <View style={[styles.dot, { backgroundColor: theme.textSecondary }]} />
        <View style={[styles.dot, { backgroundColor: theme.textSecondary }]} />
        <View style={[styles.dot, { backgroundColor: theme.textSecondary }]} />
      </View>
      <ThemedText
        type="caption"
        style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}
      >
        Escribiendo...
      </ThemedText>
    </View>
  );
}

export default function SupportChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "Soporte",
    });
  }, [navigation]);

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputText.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        throw new Error("No hay sesión activa (token requerido)");
      }

      const response = await fetch(
        new URL("/api/support/chat", getApiUrl()).toString(),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: user?.id,
            message: userMessage.content,
            history: messages.slice(-10).map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        },
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `Error ${response.status}: ${text || response.statusText}`,
        );
      }

      const data = await response.json();

      if (data.response) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        throw new Error(data.error || "Sin respuesta del asistente");
      }
    } catch (error: any) {
      console.error("Support chat error:", error?.message || error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          error?.message?.includes("401") || error?.message?.includes("session")
            ? "No pudimos autenticarte. Cierra sesión y vuelve a entrar, luego intenta de nuevo."
            : "Lo siento, hubo un problema al procesar tu mensaje. Intenta de nuevo o contáctanos por WhatsApp.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageBubble message={item} />
  );

  const displayMessages = [...messages].reverse();

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={displayMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          inverted={messages.length > 0}
          ListEmptyComponent={EmptyState}
          ListHeaderComponent={isLoading ? <TypingIndicator /> : null}
          contentContainerStyle={[
            styles.messagesList,
            { paddingTop: Spacing.md },
          ]}
          showsVerticalScrollIndicator={false}
        />

        <View
          style={[
            styles.inputContainer,
            { paddingBottom: insets.bottom + Spacing.sm },
          ]}
        >
          <View
            style={[
              styles.inputWrapper,
              { backgroundColor: theme.card },
              Shadows.sm,
            ]}
          >
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Escribe tu pregunta..."
              placeholderTextColor={theme.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
              editable={!isLoading}
            />
            <Pressable
              onPress={sendMessage}
              disabled={!inputText.trim() || isLoading}
              style={[
                styles.sendButton,
                {
                  backgroundColor:
                    inputText.trim() && !isLoading
                      ? ComeYaColors.primary
                      : theme.backgroundSecondary,
                  opacity: isLoading ? 0.6 : 1,
                },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={theme.textSecondary} />
              ) : (
                <Feather
                  name="send"
                  size={20}
                  color={inputText.trim() ? "#FFFFFF" : theme.textSecondary}
                />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: "85%",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  userMessage: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  assistantMessage: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  assistantHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  botIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.xs,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 100,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  typingContainer: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  typingDots: {
    flexDirection: "row",
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  inputContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: BorderRadius.lg,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: Spacing.sm,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.xs,
  },
});
