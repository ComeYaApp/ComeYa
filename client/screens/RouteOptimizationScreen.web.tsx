import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing } from '@/constants/theme';

export default function RouteOptimizationScreen({ navigation }: any) {
  const { theme } = useTheme();
  return (
    <View style={[s.container, { backgroundColor: theme.backgroundRoot }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
        <Feather name="arrow-left" size={22} color={theme.text} />
      </TouchableOpacity>
      <Feather name="map" size={48} color={theme.textSecondary} />
      <ThemedText type="h4" style={{ marginTop: Spacing.md, textAlign: 'center' }}>
        Optimización de Rutas
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }}>
        Disponible solo en la app móvil
      </ThemedText>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  back: { position: 'absolute', top: Spacing.xl, left: Spacing.lg, padding: Spacing.sm },
});
