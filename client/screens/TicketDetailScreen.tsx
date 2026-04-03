import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";

interface Message {
  id: string;
  chatId: string;
  userId: string;
  message: string;
  isBot: boolean;
  isAdmin: boolean;
  createdAt: string;
}

export default function TicketDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { ticketId } = route.params as { ticketId: string };
  const [replyText, setReplyText] = useState("");

  const { data: messagesData, isLoading } = useQuery<{ messages: Message[] }>({
    queryKey: ["/api/support/tickets", ticketId, "messages"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/support/tickets/${ticketId}/messages`);
      return response.json();
    },
  });

  const sendReplyMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/support/tickets/${ticketId}/messages`, {
        message: replyText,
      });
      return response.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", ticketId, "messages"] });
      setReplyText("");
      showToast("Mensaje enviado", "success");
    },
    onError: () => {
      showToast("No se pudo enviar el mensaje", "error");
    },
  });

  const handleSendReply = () => {
    if (!replyText.trim()) {
      showToast("Escribe un mensaje", "warning");
      return;
    }
    sendReplyMutation.mutate();
  };

  const messages = messagesData?.messages || [];

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">Conversación</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.content}
        keyboardVerticalOffset={insets.top + 60}
      >
        <ScrollView
          style={styles.messagesList}
          contentContainerStyle={{
            paddingBottom: Spacing.xl,
            paddingHorizontal: Spacing.lg,
          }}
        >
          {isLoading ? (
            <View style={styles.emptyState}>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                Cargando mensajes...
              </ThemedText>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="message-circle" size={48} color={theme.textSecondary} />
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                No hay mensajes
              </ThemedText>
            </View>
          ) : (
            messages.map((msg) => {
              const isFromUser = msg.userId === user?.id && !msg.isAdmin;
              return (
                <View
                  key={msg.id}
                  style={[
                    styles.messageBubble,
                    isFromUser ? styles.userMessage : styles.adminMessage,
                    {
                      backgroundColor: isFromUser
                        ? ComeYaColors.primary
                        : theme.card,
                    },
                  ]}
                >
                  {!isFromUser && (
                    <View style={styles.adminBadge}>
                      <Feather name="shield" size={12} color={ComeYaColors.primary} />
                      <ThemedText type="small" style={{ color: ComeYaColors.primary, fontWeight: "600", marginLeft: 4 }}>
                        Soporte ComeYa
                      </ThemedText>
                    </View>
                  )}
                  <ThemedText
                    type="body"
                    style={{
                      color: isFromUser ? "#FFFFFF" : theme.text,
                    }}
                  >
                    {msg.message}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{
                      color: isFromUser ? "#FFFFFF99" : theme.textSecondary,
                      marginTop: Spacing.xs,
                    }}
                  >
                    {new Date(msg.createdAt).toLocaleString("es-VE", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </ThemedText>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={[styles.replyBox, { backgroundColor: theme.card }, Shadows.md]}>
          <TextInput
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Escribe tu respuesta..."
            placeholderTextColor={theme.textSecondary}
            style={[styles.replyInput, { color: theme.text }]}
            multiline
            maxLength={500}
          />
          <Pressable
            onPress={handleSendReply}
            disabled={sendReplyMutation.isPending || !replyText.trim()}
            style={[
              styles.sendButton,
              {
                backgroundColor: ComeYaColors.primary,
                opacity: sendReplyMutation.isPending || !replyText.trim() ? 0.5 : 1,
              },
            ]}
          >
            <Feather name="send" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  content: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["4xl"],
  },
  messageBubble: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    maxWidth: "80%",
  },
  userMessage: {
    alignSelf: "flex-end",
  },
  adminMessage: {
    alignSelf: "flex-start",
  },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  replyBox: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  replyInput: {
    flex: 1,
    maxHeight: 100,
    fontSize: 16,
    paddingVertical: Spacing.sm,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
});
