import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { useToast } from "@/contexts/ToastContext";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const STATUS_LABELS: Record<string, string> = {
  pending: "Buscando repartidor...",
  accepted: "Repartidor asignado",
  picked_up: "Recogido",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export default function LogisticsRequestScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { selectedBusiness } = useBusiness();

  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = async () => {
    try {
      const res = await apiRequest("GET", "/api/delivery-requests/mine");
      const data = await res.json();
      setRequests(data.requests || []);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const submit = async () => {
    if (!pickupAddress.trim() || !dropoffAddress.trim()) {
      showToast("Indica dirección de recogida y de entrega", "error");
      return;
    }
    setSending(true);
    try {
      const res = await apiRequest("POST", "/api/delivery-requests", {
        businessId: selectedBusiness?.id || user?.businessId,
        pickupAddress: pickupAddress.trim(),
        dropoffAddress: dropoffAddress.trim(),
        contactPhone: contactPhone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      const data = await res.json();
      if (data.success) {
        showToast("Solicitud enviada a los repartidores", "success");
        setPickupAddress("");
        setDropoffAddress("");
        setContactPhone("");
        setNotes("");
        loadRequests();
      } else {
        showToast(data.error || "No se pudo enviar", "error");
      }
    } catch (e: any) {
      showToast(e.message || "Error de conexión", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">Logística Local</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: Spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          Solicita un repartidor de la flota para tus ventas por WhatsApp,
          Instagram o web. Tarifa plana: 3,50 € por entrega.
        </ThemedText>

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.card,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="Dirección de recogida (tu comercio)"
          placeholderTextColor={theme.textSecondary}
          value={pickupAddress}
          onChangeText={setPickupAddress}
        />
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.card,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="Dirección de entrega (cliente)"
          placeholderTextColor={theme.textSecondary}
          value={dropoffAddress}
          onChangeText={setDropoffAddress}
        />
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.card,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="Teléfono de contacto (opcional)"
          placeholderTextColor={theme.textSecondary}
          value={contactPhone}
          onChangeText={setContactPhone}
          keyboardType="phone-pad"
        />
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.card,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="Notas (opcional)"
          placeholderTextColor={theme.textSecondary}
          value={notes}
          onChangeText={setNotes}
        />

        <Pressable
          onPress={submit}
          disabled={sending}
          style={[
            styles.submitBtn,
            { backgroundColor: sending ? "#999" : ComeYaColors.primary },
          ]}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="send" size={18} color="#fff" />
              <ThemedText
                type="body"
                style={{ color: "#fff", marginLeft: Spacing.sm, fontWeight: "700" }}
              >
                Solicitar repartidor — 3,50 €
              </ThemedText>
            </>
          )}
        </Pressable>

        <ThemedText type="h4" style={{ marginTop: Spacing.xl }}>
          Mis solicitudes
        </ThemedText>
        {loading ? (
          <ActivityIndicator color={ComeYaColors.primary} style={{ marginTop: Spacing.lg }} />
        ) : requests.length === 0 ? (
          <ThemedText
            type="caption"
            style={{ color: theme.textSecondary, marginTop: Spacing.md }}
          >
            Aún no has solicitado ningún repartidor.
          </ThemedText>
        ) : (
          requests.map((r) => (
            <View
              key={r.id}
              style={[
                styles.requestCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View style={styles.requestHeader}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {r.pickupAddress}
                </ThemedText>
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor:
                        r.status === "delivered"
                          ? "#22C55E"
                          : r.status === "cancelled"
                            ? "#EF4444"
                            : ComeYaColors.primary,
                    },
                  ]}
                >
                  <ThemedText type="caption" style={{ color: "#fff" }}>
                    {STATUS_LABELS[r.status] || r.status}
                  </ThemedText>
                </View>
              </View>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                → {r.dropoffAddress}
              </ThemedText>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: { padding: Spacing.xs },
  content: { flex: 1, paddingHorizontal: Spacing.lg },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
  },
  requestCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
});
