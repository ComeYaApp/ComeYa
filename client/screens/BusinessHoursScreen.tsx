import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, Switch, Modal, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface BusinessHour {
  day: string;
  dayKey: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export default function BusinessHoursScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    loadHours();
  }, []);

  const loadHours = async () => {
    try {
      const response = await apiRequest("GET", "/api/business/hours");
      const data = await response.json();
      if (data.success) {
        // Convertir objeto de horarios a array
        const daysMap: Record<string, string> = {
          monday: "Lunes",
          tuesday: "Martes",
          wednesday: "Miércoles",
          thursday: "Jueves",
          friday: "Viernes",
          saturday: "Sábado",
          sunday: "Domingo",
        };

        const hoursArray = Object.entries(data.hours).map(([key, value]: [string, any]) => ({
          day: daysMap[key] || key,
          dayKey: key,
          isOpen: !value.closed,
          openTime: value.open,
          closeTime: value.close,
        }));

        setHours(hoursArray as any);
      }
    } catch (error) {
      console.error("Error loading hours:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (index: number) => {
    const newHours = [...hours];
    newHours[index].isOpen = !newHours[index].isOpen;
    setHours(newHours);
  };

  const updateTime = (index: number, field: "openTime" | "closeTime", value: string) => {
    const newHours = [...hours];
    newHours[index][field] = value;
    setHours(newHours);
  };

  const saveHours = async () => {
    setSaving(true);
    try {
      // Convertir array de vuelta a objeto
      const hoursObject = hours.reduce((acc: any, hour: any) => {
        acc[hour.dayKey] = {
          open: hour.openTime,
          close: hour.closeTime,
          closed: !hour.isOpen,
        };
        return acc;
      }, {});

      await apiRequest("PUT", "/api/business/hours", { hours: hoursObject });
      setShowConfirmModal(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Error saving hours:", error);
      alert("Error al guardar horarios");
    } finally {
      setSaving(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    navigation.goBack();
  };

  return (
    <LinearGradient
      colors={[theme.gradientStart || '#FFFFFF', theme.gradientEnd || '#F5F5F5']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <ThemedText type="h2">Horarios</ThemedText>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {hours.map((hour, index) => (
          <View
            key={hour.day}
            style={[styles.dayCard, { backgroundColor: theme.card }, Shadows.sm]}
          >
            <View style={styles.dayHeader}>
              <ThemedText type="h4">{hour.day}</ThemedText>
              <Switch
                value={hour.isOpen}
                onValueChange={() => toggleDay(index)}
                trackColor={{ false: "#767577", true: ComeYaColors.primary }}
                thumbColor="#fff"
              />
            </View>

            {hour.isOpen && (
              <View style={styles.timeRow}>
                <View style={styles.timeInput}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Apertura
                  </ThemedText>
                  <Pressable
                    style={[styles.timeButton, { backgroundColor: theme.background }]}
                  >
                    <Feather name="clock" size={16} color={ComeYaColors.primary} />
                    <ThemedText type="body" style={{ marginLeft: Spacing.xs }}>
                      {hour.openTime}
                    </ThemedText>
                  </Pressable>
                </View>

                <View style={styles.timeInput}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Cierre
                  </ThemedText>
                  <Pressable
                    style={[styles.timeButton, { backgroundColor: theme.background }]}
                  >
                    <Feather name="clock" size={16} color={ComeYaColors.primary} />
                    <ThemedText type="body" style={{ marginLeft: Spacing.xs }}>
                      {hour.closeTime}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        ))}

        <Pressable
          onPress={() => setShowConfirmModal(true)}
          style={[styles.saveButton, { backgroundColor: ComeYaColors.primary }]}
        >
          <ThemedText type="body" style={{ color: "#FFF", fontWeight: "600" }}>
            Guardar Horarios
          </ThemedText>
        </Pressable>
      </ScrollView>

      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowConfirmModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={[styles.modalIcon, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="clock" size={28} color={ComeYaColors.primary} />
            </View>
            <ThemedText type="h3" style={styles.modalTitle}>
              Guardar horarios
            </ThemedText>
            <ThemedText
              type="body"
              style={[styles.modalMessage, { color: theme.textSecondary }]}
            >
              ¿Estás seguro que deseas actualizar los horarios de atención?
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  { borderColor: theme.border },
                ]}
                onPress={() => setShowConfirmModal(false)}
              >
                <ThemedText type="body" style={{ color: theme.text }}>
                  Cancelar
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, { backgroundColor: ComeYaColors.primary }]}
                onPress={saveHours}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText
                    type="body"
                    style={{ color: "#FFFFFF", fontWeight: "600" }}
                  >
                    Guardar
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={handleSuccessClose}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={handleSuccessClose}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={[styles.modalIcon, { backgroundColor: "#E8F5E9" }]}>
              <Feather name="check-circle" size={28} color={ComeYaColors.success} />
            </View>
            <ThemedText type="h3" style={styles.modalTitle}>
              ¡Horarios guardados!
            </ThemedText>
            <ThemedText
              type="body"
              style={[styles.modalMessage, { color: theme.textSecondary }]}
            >
              Tus horarios de atención se han actualizado correctamente.
            </ThemedText>
            <Pressable
              style={[styles.modalButtonFull, { backgroundColor: ComeYaColors.primary }]}
              onPress={handleSuccessClose}
            >
              <ThemedText
                type="body"
                style={{ color: "#FFFFFF", fontWeight: "600" }}
              >
                Volver al perfil
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  dayCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  timeInput: {
    flex: 1,
  },
  timeButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
  },
  saveButton: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
  },
  modalIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  modalMessage: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    borderWidth: 1,
  },
  modalButtonFull: {
    width: "100%",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
  },
});
