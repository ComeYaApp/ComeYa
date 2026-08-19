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
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

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
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/contexts/ToastContext";

interface SupportTicket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  open: "#FF9800",
  in_progress: "#2196F3",
  resolved: "#4CAF50",
  closed: "#9E9E9E",
};

const statusLabels: Record<string, string> = {
  open: "Abierto",
  in_progress: "En proceso",
  resolved: "Resuelto",
  closed: "Cerrado",
};

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [showNewTicket, setShowNewTicket] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const { data: ticketsData, isLoading } = useQuery<{
    tickets: SupportTicket[];
  }>({
    queryKey: ["/api/support/tickets", user?.id],
    enabled: !!user?.id,
  });

  const createTicketMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/support/tickets", {
        userId: user?.id,
        subject,
        category: "other",
        initialMessage: message,
        priority: "normal",
      });
      return response.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      setShowNewTicket(false);
      setSubject("");
      setMessage("");
      showToast(
        "Ticket creado. Nos pondremos en contacto contigo pronto.",
        "success",
      );
    },
    onError: () => {
      showToast("No se pudo crear el ticket", "error");
    },
  });

  const handleCreateTicket = () => {
    if (!subject.trim() || !message.trim()) {
      showToast("Por favor completa todos los campos", "warning");
      return;
    }
    createTicketMutation.mutate();
  };

  const tickets = ticketsData?.tickets || [];

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Soporte</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      {showNewTicket ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.newTicketContainer}
        >
          <ScrollView contentContainerStyle={styles.formContent}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.lg }}>
              Crear ticket de soporte
            </ThemedText>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate("SupportChat");
              }}
              style={[
                styles.chatPromoCard,
                {
                  backgroundColor: ComeYaColors.primary + "10",
                  borderColor: ComeYaColors.primary,
                },
              ]}
            >
              <View style={styles.chatPromoIcon}>
                <Image
                  source={require("../../assets/images/comeya-logo-final.png")}
                  contentFit="contain"
                />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="h4" style={{ color: ComeYaColors.primary }}>
                  Asistente ComeYa
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Respuestas automáticas instantáneas, sin esperas
                </ThemedText>
              </View>
              <Feather
                name="chevron-right"
                size={20}
                color={ComeYaColors.primary}
              />
            </Pressable>

            <ThemedText type="body" style={styles.label}>
              Asunto
            </ThemedText>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder="Describe brevemente tu problema"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                { backgroundColor: theme.card, color: theme.text },
              ]}
            />

            <ThemedText type="body" style={styles.label}>
              Mensaje
            </ThemedText>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Explica tu problema en detalle..."
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.textArea,
                { backgroundColor: theme.card, color: theme.text },
              ]}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            <View style={styles.buttonRow}>
              <Pressable
                onPress={() => setShowNewTicket(false)}
                style={[
                  styles.cancelButton,
                  { borderColor: theme.textSecondary },
                ]}
              >
                <ThemedText type="body" style={{ color: theme.textSecondary }}>
                  Cancelar
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={handleCreateTicket}
                disabled={createTicketMutation.isPending}
                style={[
                  styles.submitButton,
                  {
                    backgroundColor: ComeYaColors.primary,
                    opacity: createTicketMutation.isPending ? 0.6 : 1,
                  },
                ]}
              >
                <ThemedText
                  type="body"
                  style={{ color: "#FFFFFF", fontWeight: "600" }}
                >
                  {createTicketMutation.isPending ? "Enviando..." : "Enviar"}
                </ThemedText>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowNewTicket(true);
            }}
            style={[
              styles.newTicketButton,
              { backgroundColor: ComeYaColors.primary },
            ]}
          >
            <Feather name="plus" size={20} color="#FFFFFF" />
            <ThemedText
              type="body"
              style={{ color: "#FFFFFF", fontWeight: "600", marginLeft: 8 }}
            >
              Nuevo ticket
            </ThemedText>
          </Pressable>

          <ScrollView
            style={styles.ticketsList}
            contentContainerStyle={{
              paddingBottom: insets.bottom + Spacing.xl,
            }}
          >
            {isLoading ? (
              <View style={styles.emptyState}>
                <ThemedText type="body" style={{ color: theme.textSecondary }}>
                  Cargando...
                </ThemedText>
              </View>
            ) : tickets.length === 0 ? (
              <View style={styles.emptyState}>
                <View
                  style={[
                    styles.emptyIconContainer,
                    { backgroundColor: ComeYaColors.primary + "10" },
                  ]}
                >
                  <Image
                    source={require("../../assets/images/comeya-logo-final.png")}
                    contentFit="contain"
                  />
                </View>
                <ThemedText
                  type="h4"
                  style={{ color: theme.text, marginTop: Spacing.md }}
                >
                  No tienes tickets
                </ThemedText>
                <ThemedText
                  type="body"
                  style={{
                    color: theme.textSecondary,
                    textAlign: "center",
                    marginTop: Spacing.xs,
                  }}
                >
                  Crea un ticket si necesitas ayuda con tu pedido
                </ThemedText>
              </View>
            ) : (
              tickets.map((ticket, index) => (
                <Pressable
                  key={ticket.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate("TicketDetail", {
                      ticketId: ticket.id,
                    });
                  }}
                >
                  <Animated.View
                    entering={FadeInDown.delay(index * 50)}
                    style={[
                      styles.ticketCard,
                      { backgroundColor: theme.card },
                      Shadows.sm,
                    ]}
                  >
                    <View style={styles.ticketHeader}>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: statusColors[ticket.status] + "20",
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: statusColors[ticket.status] },
                          ]}
                        />
                        <ThemedText
                          type="small"
                          style={{
                            color: statusColors[ticket.status],
                            fontWeight: "600",
                          }}
                        >
                          {statusLabels[ticket.status] || ticket.status}
                        </ThemedText>
                      </View>
                      <ThemedText
                        type="small"
                        style={{ color: theme.textSecondary }}
                      >
                        {new Date(ticket.createdAt).toLocaleDateString("es-VE")}
                      </ThemedText>
                    </View>
                    <ThemedText
                      type="body"
                      style={{ fontWeight: "600", marginTop: Spacing.sm }}
                    >
                      {ticket.subject}
                    </ThemedText>
                    <ThemedText
                      type="small"
                      style={{
                        color: theme.textSecondary,
                        marginTop: Spacing.xs,
                      }}
                      numberOfLines={1}
                    >
                      {ticket.category || "General"}
                    </ThemedText>
                  </Animated.View>
                </Pressable>
              ))
            )}
          </ScrollView>
        </>
      )}
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
  newTicketButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  ticketsList: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  ticketCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["4xl"],
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  newTicketContainer: {
    flex: 1,
  },
  chatPromoCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  chatPromoIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  formContent: {
    padding: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.xs,
    fontWeight: "500",
  },
  input: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    fontSize: 16,
  },
  textArea: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    fontSize: 16,
    minHeight: 150,
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  submitButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
});
