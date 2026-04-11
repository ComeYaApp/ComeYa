import React, { useState, useEffect } from "react";
import { View, ActivityIndicator, Pressable, Modal, TextInput, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, ComeYaColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { tabStyles } from "./styles";

interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
}

interface Message {
  id: string;
  message: string;
  isBot: boolean;
  senderName: string;
  createdAt: string;
}

interface TabProps {
  theme: any;
  showToast: (message: string, type: "success" | "error") => void;
}

export function SupportTab({ theme, showToast }: TabProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "closed">("all");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await apiRequest("GET", "/api/support/admin/tickets");
      const data = await res.json();
      setTickets(data.tickets || []);
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateTicketStatus = async (id: string, status: string) => {
    try {
      await apiRequest("PUT", `/api/support/tickets/${id}`, { status });
      showToast("Estado actualizado", "success");
      fetchTickets();
    } catch (error) {
      showToast("Error al actualizar ticket", "error");
    }
  };

  const openTicket = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setLoadingMessages(true);
    try {
      const res = await apiRequest("GET", `/api/support/tickets/${ticket.id}/messages`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (error) {
      showToast("Error al cargar mensajes", "error");
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    setSending(true);
    try {
      await apiRequest("POST", `/api/support/tickets/${selectedTicket.id}/messages`, {
        message: replyText,
        isBot: false,
      });
      setReplyText("");
      openTicket(selectedTicket);
      showToast("Respuesta enviada", "success");
    } catch (error) {
      showToast("Error al enviar respuesta", "error");
    } finally {
      setSending(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (filter === "all") return true;
    if (filter === "open") return t.status !== "closed";
    return t.status === "closed";
  });

  if (loading) {
    return (
      <View style={tabStyles.centered}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );
  }

  return (
    <View style={tabStyles.container}>
      <View style={tabStyles.sectionTabs}>
        {(["all", "open", "closed"] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[tabStyles.sectionTab, filter === f && { backgroundColor: ComeYaColors.primary }]}
          >
            <ThemedText type="small" style={{ color: filter === f ? "#fff" : theme.text }}>
              {f === "all" ? "Todos" : f === "open" ? "Abiertos" : "Cerrados"}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
        Tickets ({filteredTickets.length})
      </ThemedText>

      {filteredTickets.length === 0 ? (
        <View style={[tabStyles.emptyState, { backgroundColor: theme.card }]}>
          <Feather name="message-circle" size={48} color={theme.textSecondary} />
          <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
            No hay tickets
          </ThemedText>
        </View>
      ) : (
        filteredTickets.map((ticket) => (
          <View key={ticket.id} style={[tabStyles.card, { backgroundColor: theme.card }]}>
            <View style={tabStyles.cardHeader}>
              <View style={{ flex: 1 }}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {ticket.subject}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {ticket.userName} - {new Date(ticket.createdAt).toLocaleDateString("es-ES")}
                </ThemedText>
              </View>
              <View style={[tabStyles.priorityBadge, {
                backgroundColor:
                  ticket.priority === "high" ? ComeYaColors.error + "20" :
                  ticket.priority === "medium" ? ComeYaColors.warning + "20" :
                  ComeYaColors.success + "20"
              }]}>
                <ThemedText type="small" style={{
                  color:
                    ticket.priority === "high" ? ComeYaColors.error :
                    ticket.priority === "medium" ? ComeYaColors.warning :
                    ComeYaColors.success
                }}>
                  {ticket.priority === "high" ? "Alta" : ticket.priority === "medium" ? "Media" : "Baja"}
                </ThemedText>
              </View>
            </View>
            <View style={tabStyles.cardActions}>
              <Pressable
                onPress={() => openTicket(ticket)}
                style={[tabStyles.actionBtn, { backgroundColor: ComeYaColors.primary + "20" }]}
              >
                <ThemedText type="small" style={{ color: ComeYaColors.primary }}>
                  Ver / Responder
                </ThemedText>
              </Pressable>
              {ticket.status !== "closed" ? (
                <>
                  <Pressable
                    onPress={() => updateTicketStatus(ticket.id, "in_progress")}
                    style={[tabStyles.actionBtn, { backgroundColor: ComeYaColors.warning + "20" }]}
                  >
                    <ThemedText type="small" style={{ color: ComeYaColors.warning }}>
                      En Proceso
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => updateTicketStatus(ticket.id, "closed")}
                    style={[tabStyles.actionBtn, { backgroundColor: ComeYaColors.success + "20" }]}
                  >
                    <ThemedText type="small" style={{ color: ComeYaColors.success }}>
                      Cerrar
                    </ThemedText>
                  </Pressable>
                </>
              ) : (
                <View style={[tabStyles.statusBadge, { backgroundColor: ComeYaColors.success + "20" }]}>
                  <ThemedText type="small" style={{ color: ComeYaColors.success }}>
                    Cerrado
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        ))
      )}

      <Modal visible={!!selectedTicket} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: theme.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <ThemedText type="h4">{selectedTicket?.subject}</ThemedText>
              <Pressable onPress={() => setSelectedTicket(null)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            {loadingMessages ? (
              <View style={{ padding: Spacing.xl, alignItems: "center" }}>
                <ActivityIndicator size="large" color={ComeYaColors.primary} />
              </View>
            ) : (
              <>
                <ScrollView style={{ flex: 1, padding: Spacing.lg }}>
                  {messages.map((msg) => (
                    <View key={msg.id} style={{ marginBottom: Spacing.md, alignItems: msg.isBot ? "flex-start" : "flex-end" }}>
                      <View style={{ backgroundColor: msg.isBot ? theme.card : ComeYaColors.primary + "20", padding: Spacing.md, borderRadius: 12, maxWidth: "80%" }}>
                        <ThemedText type="small" style={{ fontWeight: "600", marginBottom: 4 }}>
                          {msg.senderName}
                        </ThemedText>
                        <ThemedText type="body">{msg.message}</ThemedText>
                        <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>
                          {new Date(msg.createdAt).toLocaleString("es-ES")}
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </ScrollView>

                <View style={{ padding: Spacing.lg, borderTopWidth: 1, borderTopColor: theme.border }}>
                  <TextInput
                    value={replyText}
                    onChangeText={setReplyText}
                    placeholder="Escribe tu respuesta..."
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    style={{ backgroundColor: theme.card, color: theme.text, padding: Spacing.md, borderRadius: 8, minHeight: 80, marginBottom: Spacing.md }}
                  />
                  <Pressable
                    onPress={sendReply}
                    disabled={sending || !replyText.trim()}
                    style={{ backgroundColor: ComeYaColors.primary, padding: Spacing.md, borderRadius: 8, alignItems: "center", opacity: sending || !replyText.trim() ? 0.5 : 1 }}
                  >
                    {sending ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <ThemedText type="body" style={{ color: "#fff", fontWeight: "600" }}>
                        Enviar Respuesta
                      </ThemedText>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
