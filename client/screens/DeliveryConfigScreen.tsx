import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { apiRequest } from '@/lib/query-client';
import { useTheme } from '@/hooks/useTheme';
import { ComeYaColors } from '@/constants/theme';

export default function DeliveryConfigScreen() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    baseFee: '15',
    perKm: '8',
    minFee: '15',
    maxFee: '40',
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await apiRequest('GET', '/api/delivery/config');
      const data = await response.json();
      if (data.success) {
        setConfig({
          baseFee: data.config.baseFee.toString(),
          perKm: data.config.perKm.toString(),
          minFee: data.config.minFee.toString(),
          maxFee: data.config.maxFee.toString(),
        });
      }
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await apiRequest('PUT', '/api/delivery/config', {
        baseFee: parseFloat(config.baseFee),
        perKm: parseFloat(config.perKm),
        minFee: parseFloat(config.minFee),
        maxFee: parseFloat(config.maxFee),
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert('Éxito', 'Configuración actualizada correctamente');
      } else {
        Alert.alert('Error', 'No se pudo actualizar la configuración');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: ComeYaColors.primary }]}>
        <Text style={styles.title}>Configuración de Tarifas de Delivery</Text>
        <Text style={styles.subtitle}>Soria, España</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.text }]}>Tarifa Base (€)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
            value={config.baseFee}
            onChangeText={(text) => setConfig({ ...config, baseFee: text })}
            keyboardType="numeric"
            placeholder="15"
            placeholderTextColor={theme.textSecondary}
          />
          <Text style={[styles.help, { color: theme.textSecondary }]}>Costo mínimo por cualquier entrega</Text>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.text }]}>Costo por Kilómetro (€)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
            value={config.perKm}
            onChangeText={(text) => setConfig({ ...config, perKm: text })}
            keyboardType="numeric"
            placeholder="8"
            placeholderTextColor={theme.textSecondary}
          />
          <Text style={[styles.help, { color: theme.textSecondary }]}>Se suma por cada km de distancia</Text>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.text }]}>Tarifa Mínima (€)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
            value={config.minFee}
            onChangeText={(text) => setConfig({ ...config, minFee: text })}
            keyboardType="numeric"
            placeholder="15"
            placeholderTextColor={theme.textSecondary}
          />
          <Text style={[styles.help, { color: theme.textSecondary }]}>Mínimo a cobrar</Text>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.text }]}>Tarifa Máxima (€)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
            value={config.maxFee}
            onChangeText={(text) => setConfig({ ...config, maxFee: text })}
            keyboardType="numeric"
            placeholder="40"
            placeholderTextColor={theme.textSecondary}
          />
          <Text style={[styles.help, { color: theme.textSecondary }]}>Tope máximo (Soria es pequeño)</Text>
        </View>

        <View style={[styles.preview, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.previewTitle, { color: ComeYaColors.primary }]}>Vista Previa de Tarifas:</Text>
          <Text style={[styles.previewItem, { color: theme.text }]}>• 1 km = €{(parseFloat(config.baseFee) + parseFloat(config.perKm) * 1).toFixed(2)}</Text>
          <Text style={[styles.previewItem, { color: theme.text }]}>• 2 km = €{(parseFloat(config.baseFee) + parseFloat(config.perKm) * 2).toFixed(2)}</Text>
          <Text style={[styles.previewItem, { color: theme.text }]}>• 3 km = €{Math.min(parseFloat(config.baseFee) + parseFloat(config.perKm) * 3, parseFloat(config.maxFee)).toFixed(2)}</Text>
          <Text style={[styles.previewItem, { color: theme.text }]}>• 5+ km = €{config.maxFee} (máximo)</Text>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: ComeYaColors.primary }, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.buttonText}>
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
  },
  form: {
    padding: 20,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  help: {
    fontSize: 12,
    marginTop: 4,
  },
  preview: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    borderWidth: 1,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  previewItem: {
    fontSize: 14,
    marginBottom: 4,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
