import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, RefreshControl } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

const PRIMARY = "#DC2626";
const GREEN   = "#84CC16";

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  high:   { label: "Alta",   color: "#EF4444" },
  medium: { label: "Media",  color: "#F59E0B" },
  low:    { label: "Baja",   color: "#10B981" },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  open:        { label: "Abierto",     color: "#3B82F6" },
  in_progress: { label: "En proceso",  color: "#F59E0B" },
  closed:      { label: "Cerrado",     color: "#6B7280" },
};

interface Ticket {
  id: string;
  userId: string;
  userName: string;
  subject: string;
  status: string;
  priority: string;
  category: string | null;
  createdAt: string;
}

interface Message {
  id: string;
  message: string;
  isBot: boolean;
  senderName: string;
  createdAt: string;
}

interface Props {
  theme?: any;
  showToast?: (msg: string, type?: string) => void;
}

export function SupportTab({ }: Props) {
  const { isDark } = useTheme();
  const [tickets, setTickets]         = useState<Ticket[]>([]);
  const [filtered, setFiltered]       = useState<Ticket[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [filter, setFilter]           = useState<"all" | "open" | "in_progress" | "closed">("open");
  const [search, setSearch]           = useState("");
  const [selected, setSelected]       = useState<Ticket | null>(null);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [reply, setReply]             = useState("");
  const [sending, setSending]         = useState(false);
  const [updating, setUpdating]       = useState<string | null>(null);
  const [msg, setMsg]                 = useState<{ ok: boolean; text: string } | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const bg      = isDark ? "#0d0d0d" : "#f2f3f5";
  const card    = isDark ? "#1a1a1a" : "#fff";
  const border  = isDark ? "#2a2a2a" : "#ebebeb";
  const text    = isDark ? "#fff"    : "#111";
  const sub     = isDark ? "#666"    : "#aaa";
  const inputBg = isDark ? "#222"    : "#f8f8f8";
  const msgBg   = isDark ? "#222"    : "#f0f0f0";

  const load = useCallback(async () => {
    try {
      const res  = await apiRequest("GET", "/api/support/admin/pending");
      const data = await res.json();
      setTickets(data.tickets ?? []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let list = tickets;
    if (filter !== "all") list = list.filter(t => t.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.subject?.toLowerCase().includes(q) ||
        t.userName?.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [filter, search, tickets]);

  const flash = (ok: boolean, t: string) => {
    setMsg({ ok, text: t });
    setTimeout(() => setMsg(null), 3000);
  };

  const openTicket = async (ticket: Ticket) => {
    setSelected(ticket);
    setLoadingMsgs(true);
    try {
      const res  = await apiRequest("GET", `/api/support/tickets/${ticket.id}/messages`);
      const data = await res.json();
      setMessages(data.messages ?? []);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
    } catch {}
    finally { setLoadingMsgs(false); }
  };

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    try {
      await apiRequest("POST", `/api/support/tickets/${selected.id}/messages`, {
        message: reply.trim(), isBot: false,
      });
      setReply("");
      const res  = await apiRequest("GET", `/api/support/tickets/${selected.id}/messages`);
      const data = await res.json();
      setMessages(data.messages ?? []);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      flash(true, "Respuesta enviada");
    } catch { flash(false, "Error al enviar"); }
    finally { setSending(false); }
  };

  const updateStatus = async (ticketId: string, status: string) => {
    setUpdating(ticketId);
    try {
      await apiRequest("PATCH", `/api/support/tickets/${ticketId}/status`, { status });
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status } : t));
      if (selected?.id === ticketId) setSelected(prev => prev ? { ...prev, status } : null);
      flash(true, "Estado actualizado");
    } catch { flash(false, "Error al actualizar"); }
    finally { setUpdating(null); }
  };

  const openCount  = tickets.filter(t => t.status === "open").length;
  const inProgCount = tickets.filter(t => t.status === "in_progress").length;

  const FILTERS = [
    { id: "all",         label: "Todos",       count: tickets.length, color: GREEN    },
    { id: "open",        label: "Abiertos",    count: openCount,      color: "#3B82F6" },
    { id: "in_progress", label: "En proceso",  count: inProgCount,    color: "#F59E0B" },
    { id: "closed",      label: "Cerrados",    count: tickets.filter(t => t.status === "closed").length, color: "#6B7280" },
  ] as const;

  if (loading) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: bg }}>
      <ActivityIndicator size="large" color={PRIMARY} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: bg, flexDirection: "row" }}>

      {/* ── Lista ── */}
      <View style={{ width: selected ? 380 : undefined, flex: selected ? undefined : 1 }}>

        {/* KPI bar */}
        <View style={[kpi.bar, { backgroundColor: card, borderBottomColor: border }]}>
          {[
            { label: "Total",      value: tickets.length, color: GREEN    },
            { label: "Abiertos",   value: openCount,      color: "#3B82F6" },
            { label: "En proceso", value: inProgCount,    color: "#F59E0B" },
          ].map(k => (
            <View key={k.label} style={kpi.item}>
              <Text style={[kpi.val, { color: k.color }]}>{k.value}</Text>
              <Text style={[kpi.lbl, { color: sub }]}>{k.label}</Text>
            </View>
          ))}
        </View>

        {/* Toolbar */}
        <View style={[tb.bar, { backgroundColor: card, borderBottomColor: border }]}>
          <View style={[tb.searchWrap, { backgroundColor: inputBg, borderColor: border }]}>
            <Feather name="search" size={14} color={sub} />
            <TextInput
              style={[tb.input, { color: text }]}
              placeholder="Buscar asunto, usuario..."
              placeholderTextColor={sub}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Feather name="x" size={14} color={sub} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={[tb.count, { color: sub }]}>{filtered.length}</Text>
        </View>

        {/* Filtros */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={[tb.filterRow, { borderBottomColor: border }]}
          contentContainerStyle={tb.filterContent}
        >
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[tb.chip, {
                backgroundColor: filter === f.id ? f.color : inputBg,
                borderColor: filter === f.id ? f.color : border,
              }]}
            >
              <Text style={[tb.chipTxt, { color: filter === f.id ? "#fff" : text }]}>{f.label}</Text>
              <View style={[tb.chipBadge, { backgroundColor: filter === f.id ? "rgba(255,255,255,0.25)" : f.color + "20" }]}>
                <Text style={[tb.chipBadgeTxt, { color: filter === f.id ? "#fff" : f.color }]}>{f.count}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Feedback */}
        {msg && (
          <View style={[tb.msgBar, { backgroundColor: msg.ok ? "#10B98115" : "#EF444415" }]}>
            <Feather name={msg.ok ? "check-circle" : "alert-circle"} size={13} color={msg.ok ? "#10B981" : "#EF4444"} />
            <Text style={[tb.msgTxt, { color: msg.ok ? "#10B981" : "#EF4444" }]}>{msg.text}</Text>
          </View>
        )}

        {/* Lista */}
        {filtered.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 10 }}>
            <Feather name="message-circle" size={40} color={sub} />
            <Text style={{ color: sub, fontSize: 15 }}>Sin tickets</Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 14, gap: 8 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={PRIMARY} />}
          >
            {filtered.map(ticket => {
              const statusMeta   = STATUS_META[ticket.status]   ?? STATUS_META.open;
              const priorityMeta = PRIORITY_META[ticket.priority] ?? PRIORITY_META.low;
              const isSelected   = selected?.id === ticket.id;

              return (
                <TouchableOpacity
                  key={ticket.id}
                  onPress={() => openTicket(ticket)}
                  style={[li.card, {
                    backgroundColor: card,
                    borderColor: isSelected ? GREEN : border,
                    borderLeftColor: priorityMeta.color,
                  }]}
                >
                  <View style={li.top}>
                    <Text style={[li.subject, { color: text }]} numberOfLines={1}>{ticket.subject}</Text>
                    <View style={[li.priorityPill, { backgroundColor: priorityMeta.color + "18" }]}>
                      <Text style={[li.priorityTxt, { color: priorityMeta.color }]}>{priorityMeta.label}</Text>
                    </View>
                  </View>
                  <Text style={[li.user, { color: sub }]}>{ticket.userName}</Text>
                  <View style={li.bottom}>
                    <View style={[li.statusPill, { backgroundColor: statusMeta.color + "15" }]}>
                      <View style={[li.statusDot, { backgroundColor: statusMeta.color }]} />
                      <Text style={[li.statusTxt, { color: statusMeta.color }]}>{statusMeta.label}</Text>
                    </View>
                    <Text style={[li.date, { color: sub }]}>{new Date(ticket.createdAt).toLocaleDateString("es-ES")}</Text>
                  </View>

                  {/* Acciones rápidas */}
                  {ticket.status !== "closed" && (
                    <View style={li.actions}>
                      {ticket.status === "open" && (
                        <TouchableOpacity
                          onPress={() => updateStatus(ticket.id, "in_progress")}
                          disabled={updating === ticket.id}
                          style={[li.actionBtn, { backgroundColor: "#F59E0B15", borderColor: "#F59E0B30" }]}
                        >
                          <Feather name="loader" size={11} color="#F59E0B" />
                          <Text style={[li.actionTxt, { color: "#F59E0B" }]}>En proceso</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => updateStatus(ticket.id, "closed")}
                        disabled={updating === ticket.id}
                        style={[li.actionBtn, { backgroundColor: "#10B98115", borderColor: "#10B98130" }]}
                      >
                        <Feather name="check" size={11} color="#10B981" />
                        <Text style={[li.actionTxt, { color: "#10B981" }]}>Cerrar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ── Panel chat ── */}
      {selected && (
        <View style={[chat.panel, { backgroundColor: card, borderLeftColor: border, flex: 1 }]}>
          {/* Header */}
          <View style={[chat.header, { borderBottomColor: border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[chat.subject, { color: text }]} numberOfLines={1}>{selected.subject}</Text>
              <View style={chat.metaRow}>
                <Text style={[chat.user, { color: sub }]}>{selected.userName}</Text>
                <View style={[chat.statusPill, { backgroundColor: (STATUS_META[selected.status]?.color ?? "#888") + "18" }]}>
                  <Text style={[chat.statusTxt, { color: STATUS_META[selected.status]?.color ?? "#888" }]}>
                    {STATUS_META[selected.status]?.label ?? selected.status}
                  </Text>
                </View>
              </View>
            </View>
            {/* Status actions */}
            <View style={chat.headerActions}>
              {selected.status !== "closed" && (
                <>
                  {selected.status === "open" && (
                    <TouchableOpacity
                      onPress={() => updateStatus(selected.id, "in_progress")}
                      style={[chat.headerBtn, { backgroundColor: "#F59E0B15", borderColor: "#F59E0B30" }]}
                    >
                      <Text style={[chat.headerBtnTxt, { color: "#F59E0B" }]}>En proceso</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => updateStatus(selected.id, "closed")}
                    style={[chat.headerBtn, { backgroundColor: "#10B98115", borderColor: "#10B98130" }]}
                  >
                    <Text style={[chat.headerBtnTxt, { color: "#10B981" }]}>Cerrar ticket</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 4 }}>
                <Feather name="x" size={18} color={sub} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Messages */}
          {loadingMsgs ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color={PRIMARY} />
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, gap: 10 }}
              showsVerticalScrollIndicator={false}
            >
              {messages.length === 0 && (
                <View style={{ alignItems: "center", paddingVertical: 40, gap: 8 }}>
                  <Feather name="message-circle" size={32} color={sub} />
                  <Text style={{ color: sub, fontSize: 13 }}>Sin mensajes aún</Text>
                </View>
              )}
              {messages.map(m => {
                const isAdmin = !m.isBot;
                return (
                  <View key={m.id} style={[msg_s.wrap, isAdmin && msg_s.wrapRight]}>
                    <View style={[
                      msg_s.bubble,
                      { backgroundColor: isAdmin ? GREEN + "20" : msgBg },
                      isAdmin && { borderBottomRightRadius: 4 },
                      !isAdmin && { borderBottomLeftRadius: 4 },
                    ]}>
                      <Text style={[msg_s.sender, { color: isAdmin ? GREEN : sub }]}>{m.senderName}</Text>
                      <Text style={[msg_s.body, { color: text }]}>{m.message}</Text>
                      <Text style={[msg_s.time, { color: sub }]}>{new Date(m.createdAt).toLocaleString("es-ES")}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Reply box */}
          {selected.status !== "closed" ? (
            <View style={[chat.replyBox, { borderTopColor: border, backgroundColor: card }]}>
              <TextInput
                style={[chat.replyInput, { backgroundColor: inputBg, borderColor: border, color: text }]}
                placeholder="Escribe tu respuesta..."
                placeholderTextColor={sub}
                value={reply}
                onChangeText={setReply}
                multiline
                onSubmitEditing={sendReply}
              />
              <TouchableOpacity
                onPress={sendReply}
                disabled={sending || !reply.trim()}
                style={[chat.sendBtn, { backgroundColor: reply.trim() ? GREEN : sub }]}
              >
                {sending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Feather name="send" size={16} color="#fff" />
                }
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[chat.closedBar, { borderTopColor: border, backgroundColor: "#6B728010" }]}>
              <Feather name="lock" size={13} color={sub} />
              <Text style={[chat.closedTxt, { color: sub }]}>Ticket cerrado — no se pueden enviar más mensajes</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const kpi = StyleSheet.create({
  bar:  { flexDirection: "row", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  item: { flex: 1, alignItems: "center", gap: 2 },
  val:  { fontSize: 18, fontWeight: "800" },
  lbl:  { fontSize: 10, fontWeight: "600" },
});

const tb = StyleSheet.create({
  bar:           { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  searchWrap:    { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  input:         { flex: 1, fontSize: 13 } as any,
  count:         { fontSize: 12, fontWeight: "600" },
  filterRow:     { flexGrow: 0, borderBottomWidth: 1 },
  filterContent: { paddingHorizontal: 14, paddingVertical: 10, gap: 8, flexDirection: "row", alignItems: "center" },
  chip:          { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, alignSelf: "flex-start" },
  chipTxt:       { fontSize: 12, fontWeight: "600" },
  chipBadge:     { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 },
  chipBadgeTxt:  { fontSize: 10, fontWeight: "700" },
  msgBar:        { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  msgTxt:        { fontSize: 12, fontWeight: "600" },
});

const li = StyleSheet.create({
  card:        { borderRadius: 12, padding: 12, borderWidth: 1, borderLeftWidth: 3, gap: 6 },
  top:         { flexDirection: "row", alignItems: "center", gap: 8 },
  subject:     { flex: 1, fontSize: 13, fontWeight: "700" },
  priorityPill:{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  priorityTxt: { fontSize: 10, fontWeight: "700" },
  user:        { fontSize: 11 },
  bottom:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusPill:  { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  statusDot:   { width: 5, height: 5, borderRadius: 3 },
  statusTxt:   { fontSize: 10, fontWeight: "700" },
  date:        { fontSize: 10 },
  actions:     { flexDirection: "row", gap: 6 },
  actionBtn:   { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  actionTxt:   { fontSize: 10, fontWeight: "600" },
});

const chat = StyleSheet.create({
  panel:        { borderLeftWidth: 1, flexDirection: "column" },
  header:       { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderBottomWidth: 1 },
  subject:      { fontSize: 14, fontWeight: "700" },
  metaRow:      { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  user:         { fontSize: 11 },
  statusPill:   { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  statusTxt:    { fontSize: 10, fontWeight: "700" },
  headerActions:{ flexDirection: "row", alignItems: "center", gap: 6 },
  headerBtn:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  headerBtnTxt: { fontSize: 11, fontWeight: "700" },
  replyBox:     { flexDirection: "row", alignItems: "flex-end", gap: 10, padding: 12, borderTopWidth: 1 },
  replyInput:   { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, maxHeight: 100 },
  sendBtn:      { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  closedBar:    { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderTopWidth: 1 },
  closedTxt:    { fontSize: 12 },
});

const msg_s = StyleSheet.create({
  wrap:      { alignItems: "flex-start" },
  wrapRight: { alignItems: "flex-end" },
  bubble:    { maxWidth: "75%", borderRadius: 14, padding: 12, gap: 3 },
  sender:    { fontSize: 10, fontWeight: "700" },
  body:      { fontSize: 13, lineHeight: 18 },
  time:      { fontSize: 10, marginTop: 2 },
});
