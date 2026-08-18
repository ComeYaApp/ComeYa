import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Switch,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/contexts/ToastContext";
import { apiRequest } from "@/lib/query-client";
import {
  ComeYaColors,
  Spacing,
  BorderRadius,
  Shadows,
} from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";

export default function NotificationPreferencesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [promotions, setPromotions] = useState(true);
  const [news, setNews] = useState(true);

  useEffect(() => {
    navigation.setOptions({ headerTitle: "Notificaciones" });
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const res = await apiRequest(
        "GET",
        "/api/users/notification-preferences",
      );
      const data = await res.json();
      if (data.success && data.preferences) {
        setPromotions(data.preferences.promotions !== false);
        setNews(data.preferences.news !== false);
      }
    } catch {
      showToast("No se pudieron cargar las preferencias", "error");
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async (next: {
    promotions: boolean;
    news: boolean;
  }) => {
    setSaving(true);
    try {
      const res = await apiRequest(
        "PUT",
        "/api/users/notification-preferences",
        next,
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    } catch {
      showToast("No se pudo guardar el cambio", "error");
      // Revertir al estado guardado en servidor
      loadPreferences();
    } finally {
      setSaving(false);
    }
  };

  const renderRow = (
    icon: keyof typeof Feather.glyphMap,
    title: string,
    description: string,
    value: boolean,
    onValueChange: (v: boolean) => void,
    locked = false,
  ) => (
    <View
      key={title}
      style={[styles.row, { backgroundColor: theme.card }]}
    >
      <View style={styles.rowIcon}>
        <Feather name={icon} size={20} color={ComeYaColors.primary} />
      </View>
      <View style={styles.rowText}>
        <ThemedText type="body" style={styles.rowTitle}>
          {title}
        </ThemedText>
        <ThemedText
          type="caption"
          style={{ color: theme.textSecondary, marginTop: 2 }}
        >
          {description}
        </ThemedText>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={locked || saving}
        trackColor={{ false: "#D1D5DB", true: ComeYaColors.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {loading ? (
        <ActivityIndicator
          size="large"
          color={ComeYaColors.primary}
          style={styles.loader}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText type="caption" style={styles.sectionTitle}>
            PEDIDOS Y SEGURIDAD
          </ThemedText>
          {renderRow(
            "package",
            "Avisos de pedidos",
            "Estado de tus pedidos, pagos y entregas. Necesarios para usar la app.",
            true,
            () => {},
            true,
          )}

          <ThemedText type="caption" style={styles.sectionTitle}>
            NOVEDADES
          </ThemedText>
          {renderRow(
            "percent",
            "Promociones y ofertas",
            "Descuentos, cupones y ofertas de negocios cercanos.",
            promotions,
            (v) => {
              setPromotions(v);
              savePreferences({ promotions: v, news });
            },
          )}
          {renderRow(
            "bell",
            "Novedades de ComeYa",
            "Anuncios de la plataforma y nuevas funcionalidades.",
            news,
            (v) => {
              setNews(v);
              savePreferences({ promotions, news: v });
            },
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { marginTop: 48 },
  content: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 40 },
  sectionTitle: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    letterSpacing: 1,
    opacity: 0.7,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: ComeYaColors.primary + "18",
  },
  rowText: { flex: 1 },
  rowTitle: { fontWeight: "600" },
});
