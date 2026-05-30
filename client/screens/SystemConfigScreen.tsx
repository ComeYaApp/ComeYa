import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Switch,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { Colors } from "../constants/Colors";
import { useAuth } from "../contexts/AuthContext";

interface SystemConfig {
  commissions: {
    platform: number;
    business: number;
    delivery: number;
  };
  deliveryZones: Array<{
    id: string;
    name: string;
    radius: number;
    baseFee: number;
    active: boolean;
  }>;
  operatingHours: {
    start: string;
    end: string;
    timezone: string;
  };
  pricing: {
    minimumOrder: number;
    deliveryFee: number;
    serviceFee: number;
  };
  features: {
    cashPayments: boolean;
    biometricAuth: boolean;
    aiSupport: boolean;
    realTimeTracking: boolean;
  };
}

export default function SystemConfigScreen() {
  const { user } = useAuth();
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSystemConfig();
  }, []);

  const loadSystemConfig = async () => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/admin/system-config`,
        {
          headers: {
            Authorization: `Bearer ${user?.token}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error("Error loading system config:", error);
      Alert.alert("Error", "No se pudo cargar la configuración del sistema");
    } finally {
      setLoading(false);
    }
  };

  const saveSystemConfig = async () => {
    if (!config) return;

    setSaving(true);
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/admin/system-config`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user?.token}`,
          },
          body: JSON.stringify(config),
        },
      );

      if (response.ok) {
        Alert.alert("Éxito", "Configuración guardada correctamente");
      } else {
        throw new Error("Error saving config");
      }
    } catch (error) {
      console.error("Error saving system config:", error);
      Alert.alert("Error", "No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const updateCommission = (
    type: keyof SystemConfig["commissions"],
    value: number,
  ) => {
    if (!config) return;

    const newCommissions = { ...config.commissions, [type]: value };
    const total =
      newCommissions.platform +
      newCommissions.business +
      newCommissions.delivery;

    if (total !== 100) {
      Alert.alert("Error", "Las comisiones deben sumar exactamente 100%");
      return;
    }

    setConfig({
      ...config,
      commissions: newCommissions,
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando configuración...</Text>
      </View>
    );
  }

  if (!config) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error al cargar la configuración</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Configuración del Sistema</Text>

      {/* Comisiones */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Comisiones (%)</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Plataforma:</Text>
          <TextInput
            style={styles.input}
            value={config.commissions.platform.toString()}
            onChangeText={(text) =>
              updateCommission("platform", parseFloat(text) || 0)
            }
            keyboardType="numeric"
            placeholder="15"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Negocio:</Text>
          <TextInput
            style={styles.input}
            value={config.commissions.business.toString()}
            onChangeText={(text) =>
              updateCommission("business", parseFloat(text) || 0)
            }
            keyboardType="numeric"
            placeholder="70"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Repartidor:</Text>
          <TextInput
            style={styles.input}
            value={config.commissions.delivery.toString()}
            onChangeText={(text) =>
              updateCommission("delivery", parseFloat(text) || 0)
            }
            keyboardType="numeric"
            placeholder="15"
          />
        </View>

        <Text style={styles.totalText}>
          Total:{" "}
          {config.commissions.platform +
            config.commissions.business +
            config.commissions.delivery}
          %
        </Text>
      </View>

      {/* Precios */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configuración de Precios</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Pedido Mínimo ($):</Text>
          <TextInput
            style={styles.input}
            value={config.pricing.minimumOrder.toString()}
            onChangeText={(text) =>
              setConfig({
                ...config,
                pricing: {
                  ...config.pricing,
                  minimumOrder: parseFloat(text) || 0,
                },
              })
            }
            keyboardType="numeric"
            placeholder="50"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tarifa de Entrega ($):</Text>
          <TextInput
            style={styles.input}
            value={config.pricing.deliveryFee.toString()}
            onChangeText={(text) =>
              setConfig({
                ...config,
                pricing: {
                  ...config.pricing,
                  deliveryFee: parseFloat(text) || 0,
                },
              })
            }
            keyboardType="numeric"
            placeholder="25"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tarifa de Servicio ($):</Text>
          <TextInput
            style={styles.input}
            value={config.pricing.serviceFee.toString()}
            onChangeText={(text) =>
              setConfig({
                ...config,
                pricing: {
                  ...config.pricing,
                  serviceFee: parseFloat(text) || 0,
                },
              })
            }
            keyboardType="numeric"
            placeholder="10"
          />
        </View>
      </View>

      {/* Horarios de Operación */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Horarios de Operación</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Hora de Inicio:</Text>
          <TextInput
            style={styles.input}
            value={config.operatingHours.start}
            onChangeText={(text) =>
              setConfig({
                ...config,
                operatingHours: { ...config.operatingHours, start: text },
              })
            }
            placeholder="06:00"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Hora de Cierre:</Text>
          <TextInput
            style={styles.input}
            value={config.operatingHours.end}
            onChangeText={(text) =>
              setConfig({
                ...config,
                operatingHours: { ...config.operatingHours, end: text },
              })
            }
            placeholder="23:00"
          />
        </View>
      </View>

      {/* Características del Sistema */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Características del Sistema</Text>

        <View style={styles.switchGroup}>
          <Text style={styles.label}>Pagos en Efectivo:</Text>
          <Switch
            value={config.features.cashPayments}
            onValueChange={(value) =>
              setConfig({
                ...config,
                features: { ...config.features, cashPayments: value },
              })
            }
            trackColor={{
              false: Colors.light.tabIconDefault,
              true: Colors.light.tint,
            }}
          />
        </View>

        <View style={styles.switchGroup}>
          <Text style={styles.label}>Autenticación Biométrica:</Text>
          <Switch
            value={config.features.biometricAuth}
            onValueChange={(value) =>
              setConfig({
                ...config,
                features: { ...config.features, biometricAuth: value },
              })
            }
            trackColor={{
              false: Colors.light.tabIconDefault,
              true: Colors.light.tint,
            }}
          />
        </View>

        <View style={styles.switchGroup}>
          <Text style={styles.label}>Soporte con IA:</Text>
          <Switch
            value={config.features.aiSupport}
            onValueChange={(value) =>
              setConfig({
                ...config,
                features: { ...config.features, aiSupport: value },
              })
            }
            trackColor={{
              false: Colors.light.tabIconDefault,
              true: Colors.light.tint,
            }}
          />
        </View>

        <View style={styles.switchGroup}>
          <Text style={styles.label}>Seguimiento en Tiempo Real:</Text>
          <Switch
            value={config.features.realTimeTracking}
            onValueChange={(value) =>
              setConfig({
                ...config,
                features: { ...config.features, realTimeTracking: value },
              })
            }
            trackColor={{
              false: Colors.light.tabIconDefault,
              true: Colors.light.tint,
            }}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={saveSystemConfig}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? "Guardando..." : "Guardar Configuración"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.light.text,
    marginBottom: 20,
    textAlign: "center",
  },
  section: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 16,
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  switchGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  label: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.light.tabIconDefault,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "white",
  },
  totalText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.tint,
    textAlign: "center",
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 40,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.light.tabIconDefault,
  },
  saveButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  loadingText: {
    fontSize: 18,
    color: Colors.light.text,
    textAlign: "center",
    marginTop: 50,
  },
  errorText: {
    fontSize: 18,
    color: "red",
    textAlign: "center",
    marginTop: 50,
  },
});
