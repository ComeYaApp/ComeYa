import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { apiRequest } from '@/lib/query-client';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/contexts/ToastContext';
import { ComeYaColors } from '@/constants/theme';

export default function DeliveryConfigScreen() {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [config, setConfig]   = useState({
    tier1:      '2.50',
    tier2:      '4.00',
    tier3:      '5.00',
    extraPerKm: '1.00',
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res  = await apiRequest('GET', '/api/delivery/config');
      const data = await res.json();
      if (data.success) {
        setConfig({
          tier1:      data.config.tier1.toFixed(2),
          tier2:      data.config.tier2.toFixed(2),
          tier3:      data.config.tier3.toFixed(2),
          extraPerKm: data.config.extraPerKm.toFixed(2),
        });
      }
    } catch {
      showToast('Error al cargar tarifas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res  = await apiRequest('PUT', '/api/delivery/config', {
        tier1:      parseFloat(config.tier1),
        tier2:      parseFloat(config.tier2),
        tier3:      parseFloat(config.tier3),
        extraPerKm: parseFloat(config.extraPerKm),
      });
      const data = await res.json();
      if (data.success) showToast('Tarifas actualizadas', 'success');
      else showToast('Error al guardar', 'error');
    } catch {
      showToast('Error de conexion', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Preview calculado
  const t1 = parseFloat(config.tier1)      || 0;
  const t2 = parseFloat(config.tier2)      || 0;
  const t3 = parseFloat(config.tier3)      || 0;
  const ex = parseFloat(config.extraPerKm) || 0;

  const feeFor = (km: number) => {
    if (km <= 2) return t1;
    if (km <= 3) return t2;
    if (km <= 4) return t3;
    return t3 + Math.ceil(km - 4) * ex;
  };

  const s = st(theme);

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={ComeYaColors.primary} /></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 80 }}>

      {/* Info */}
      <View style={[s.infoBox, { backgroundColor: ComeYaColors.primary + '12', borderColor: ComeYaColors.primary + '30' }]}>
        <Feather name="info" size={14} color={ComeYaColors.primary} />
        <Text style={[s.infoText, { color: ComeYaColors.primary }]}>
          Tarifa por tramos segun distancia entre negocio y cliente. Soria es una ciudad pequena, maxima distancia ~8 km.
        </Text>
      </View>

      {/* Tramos */}
      {[
        { key: 'tier1',      label: 'Tramo 1-2 km',          hint: 'Entregas cercanas' },
        { key: 'tier2',      label: 'Tramo 2-3 km',          hint: 'Distancia media' },
        { key: 'tier3',      label: 'Tramo 3-4 km',          hint: 'Distancia larga' },
        { key: 'extraPerKm', label: 'Extra por km (>4 km)',   hint: 'Se suma por cada km adicional a partir de 4 km' },
      ].map(field => (
        <View key={field.key} style={[s.card, { backgroundColor: theme.card }]}>
          <Text style={[s.label, { color: theme.text }]}>{field.label}</Text>
          <Text style={[s.hint, { color: theme.textSecondary }]}>{field.hint}</Text>
          <View style={s.row}>
            <Text style={[s.euro, { color: theme.textSecondary }]}>€</Text>
            <TextInput
              style={[s.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              value={config[field.key as keyof typeof config]}
              onChangeText={v => setConfig(prev => ({ ...prev, [field.key]: v }))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={theme.textSecondary}
            />
          </View>
        </View>
      ))}

      {/* Preview */}
      <View style={[s.preview, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[s.previewTitle, { color: theme.text }]}>Vista previa</Text>
        {[1.5, 2.5, 3.5, 5, 6, 8].map(km => (
          <View key={km} style={s.previewRow}>
            <Text style={[s.previewKm, { color: theme.textSecondary }]}>{km} km</Text>
            <Text style={[s.previewFee, { color: ComeYaColors.success }]}>€{feeFor(km).toFixed(2)}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[s.btn, { backgroundColor: ComeYaColors.primary, opacity: saving ? 0.7 : 1 }]}
        onPress={save}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color="#FFF" />
          : <><Feather name="save" size={16} color="#FFF" /><Text style={s.btnText}>Guardar tarifas</Text></>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const st = (theme: any) => StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: theme.backgroundRoot },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  infoBox:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 16 },
  infoText:  { flex: 1, fontSize: 12, lineHeight: 18 },
  card:      { borderRadius: 12, padding: 14, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2 },
  label:     { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  hint:      { fontSize: 12, marginBottom: 10 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  euro:      { fontSize: 16, fontWeight: '600' },
  input:     { flex: 1, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16 },
  preview:   { borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1 },
  previewTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  previewRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  previewKm:    { fontSize: 14 },
  previewFee:   { fontSize: 14, fontWeight: '700' },
  btn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 12 },
  btnText:   { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
