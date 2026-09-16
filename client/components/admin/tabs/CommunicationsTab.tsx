import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { apiRequest } from "@/lib/query-client";
import { useTheme } from "@/hooks/useTheme";
import { ComeYaColors } from "../../../constants/theme";

const TARGETS = [
  { key: "clients", label: "Clientes", icon: "users", desc: "Todos los clientes de la app" },
  { key: "businesses", label: "Negocios", icon: "briefcase", desc: "Dueños de negocios" },
  { key: "drivers", label: "Repartidores", icon: "truck", desc: "Todos los repartidores" },
];

// El admin elige a quién llega cada promoción/oferta/novedad
export const CommunicationsTab: React.FC<{
  theme: any;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}> = ({ theme, showToast }) => {
  const [targets, setTargets] = useState<string[]>(["clients"]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [deeplink, setDeeplink] = useState("");
  const [sending, setSending] = useState(false);

  const toggleTarget = (key: string) => {
    setTargets((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key],
    );
  };

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      showToast("Escribe el título y el mensaje", "error");
      return;
    }
    setSending(true);
    try {
      const res = await apiRequest("POST", "/api/admin/notifications/broadcast", {
        targets,
        title: title.trim(),
        body: body.trim(),
        data: deeplink.trim() ? { screen: deeplink.trim() } : {},
        category: "promotions",
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          `Enviada a ${data.sent} usuarios (${targets.join(", ")})`,
          "success",
        );
        setTitle("");
        setBody("");
        setDeeplink("");
      } else {
        showToast(data.error || "No se pudo enviar", "error");
      }
    } catch {
      showToast("Error de conexión al enviar", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <Text style={[styles.title, { color: theme.text }]}>Comunicaciones</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Envía una promoción, oferta o novedad eligiendo a quién le llega:
        clientes, negocios y/o repartidores. Se respetan las preferencias de
        notificación de cada usuario.
      </Text>

      <Text style={[styles.label, { color: theme.text }]}>¿A quién se envía?</Text>
      {TARGETS.map((t) => {
        const active = targets.includes(t.key);
        return (
          <TouchableOpacity
            key={t.key}
            style={[
              styles.targetRow,
              {
                backgroundColor: active ? ComeYaColors.primary + "12" : theme.card,
                borderColor: active ? ComeYaColors.primary : theme.border,
              },
            ]}
            onPress={() => toggleTarget(t.key)}
          >
            <Feather name={t.icon as any} size={20} color={active ? ComeYaColors.primary : theme.textSecondary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.targetLabel, { color: theme.text }]}>{t.label}</Text>
              <Text style={[styles.targetDesc, { color: theme.textSecondary }]}>{t.desc}</Text>
            </View>
            {active && <Feather name="check-circle" size={20} color={ComeYaColors.primary} />}
          </TouchableOpacity>
        );
      })}

      <Text style={[styles.label, { color: theme.text }]}>Título</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
        value={title}
        onChangeText={setTitle}
        placeholder="Ej: ¡Oferta del fin de semana! 🎉"
        placeholderTextColor={theme.textSecondary}
        maxLength={100}
      />

      <Text style={[styles.label, { color: theme.text }]}>Mensaje</Text>
      <TextInput
        style={[styles.input, styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
        value={body}
        onChangeText={setBody}
        placeholder="Escribe el contenido de la notificación…"
        placeholderTextColor={theme.textSecondary}
        multiline
        maxLength={300}
      />

      <Text style={[styles.label, { color: theme.text }]}>Pantalla de destino (opcional)</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
        value={deeplink}
        onChangeText={setDeeplink}
        placeholder="Ej: GiftCards, Subscriptions, BusinessMap…"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
      />

      <TouchableOpacity
        style={[styles.sendBtn, { backgroundColor: sending ? "#CCC" : ComeYaColors.primary }]}
        onPress={send}
        disabled={sending}
      >
        {sending ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Feather name="send" size={18} color="#FFF" />
        )}
        <Text style={styles.sendText}>{sending ? "Enviando…" : "Enviar notificación"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 12, lineHeight: 18, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 8, marginTop: 12 },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  targetLabel: { fontSize: 14, fontWeight: "600" },
  targetDesc: { fontSize: 11, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
  },
  sendText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
});
