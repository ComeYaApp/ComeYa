import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ComeYaColors, Spacing, BorderRadius } from "../../../constants/theme";
import { apiRequest } from "@/lib/query-client";

interface SettingsTabProps {
  theme: any;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

interface SystemSetting {
  key: string;
  value: string;
  description: string;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ theme, showToast }) => {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await apiRequest("GET", "/api/admin/settings");
      const data = await res.json();
      setSettings(data.settings || []);
      const values: Record<string, string> = {};
      data.settings?.forEach((s: SystemSetting) => {
        values[s.key] = s.value;
      });
      setEditValues(values);
    } catch (error) {
      showToast("Error al cargar configuración", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: string) => {
    try {
      await apiRequest("PUT", "/api/admin/settings", {
        key,
        value: editValues[key],
      });
      showToast("Configuración actualizada", "success");
      loadSettings();
    } catch (error) {
      showToast("Error al guardar", "error");
    }
  };

  const handleInitialize = async () => {
    try {
      await apiRequest("POST", "/api/admin/settings/initialize");
      showToast("Configuraciones inicializadas", "success");
      loadSettings();
    } catch (error) {
      showToast("Error al inicializar", "error");
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Configuración del Sistema</Text>
        {settings.length === 0 && (
          <Pressable
            onPress={handleInitialize}
            style={[styles.initBtn, { backgroundColor: ComeYaColors.primary }]}
          >
            <Feather name="settings" size={16} color="#FFF" />
            <Text style={styles.initBtnText}>Inicializar</Text>
          </Pressable>
        )}
      </View>
      
      {settings.map((setting) => (
        <View key={setting.key} style={[styles.settingCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.settingLabel, { color: theme.text }]}>{setting.description}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              value={editValues[setting.key] || ""}
              onChangeText={(text) => setEditValues({ ...editValues, [setting.key]: text })}
              placeholder={setting.value}
              placeholderTextColor={theme.textSecondary}
            />
            <Pressable
              onPress={() => handleSave(setting.key)}
              style={[styles.saveBtn, { backgroundColor: ComeYaColors.primary }]}
            >
              <Feather name="check" size={18} color="#FFF" />
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  initBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  initBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  settingCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
  },
  input: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
  },
  saveBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
});
