import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { ThemedText } from './ThemedText';
import { ComeYaColors, Spacing, BorderRadius } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';

interface CountdownTimerProps {
  estimatedArrival: string | Date;
  status: string;
  prepTime?: number;
  deliveryTime?: number;
}

export function CountdownTimer({ estimatedArrival, status, prepTime, deliveryTime }: CountdownTimerProps) {
  const [minutesLeft, setMinutesLeft] = useState(0);
  const [progress, setProgress] = useState(0);
  const progressAnim = new Animated.Value(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const arrival = new Date(estimatedArrival).getTime();
      const diff = arrival - now;
      const minutes = Math.max(0, Math.floor(diff / 60000));
      setMinutesLeft(minutes);

      // Calcular progreso basado en estado
      let totalTime = prepTime && deliveryTime ? prepTime + deliveryTime + 5 : 45;
      let elapsed = totalTime - minutes;
      let progressPercent = Math.min(100, Math.max(0, (elapsed / totalTime) * 100));
      setProgress(progressPercent);

      Animated.timing(progressAnim, {
        toValue: progressPercent,
        duration: 500,
        useNativeDriver: false,
      }).start();
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 30000); // Actualizar cada 30 seg

    return () => clearInterval(interval);
  }, [estimatedArrival, prepTime, deliveryTime]);

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
      case 'accepted':
        return 'clock';
      case 'preparing':
        return 'package';
      case 'ready':
        return 'check-circle';
      case 'picked_up':
      case 'on_the_way':
      case 'in_transit':
        return 'truck';
      case 'delivered':
        return 'check';
      default:
        return 'clock';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return 'Esperando confirmación';
      case 'accepted':
        return 'Pedido aceptado';
      case 'preparing':
        return 'Preparando tu pedido';
      case 'ready':
        return 'Listo para recoger';
      case 'picked_up':
      case 'on_the_way':
      case 'in_transit':
        return 'En camino';
      case 'delivered':
        return '¡Entregado!';
      default:
        return 'Procesando';
    }
  };

  if (status === 'delivered' || status === 'cancelled') {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Feather name={getStatusIcon()} size={24} color={ComeYaColors.primary} />
        </View>
        <View style={styles.textContainer}>
          <ThemedText type="caption" style={styles.statusText}>
            {getStatusText()}
          </ThemedText>
          <ThemedText type="h3" style={styles.timeText}>
            {minutesLeft > 0 ? `${minutesLeft} minutos` : 'Llegando pronto'}
          </ThemedText>
        </View>
      </View>

      {/* Barra de progreso */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>

      {/* Timeline */}
      {prepTime && deliveryTime && (
        <View style={styles.timeline}>
          <View style={styles.timelineItem}>
            <View style={[styles.timelineDot, status === 'preparing' && styles.timelineDotActive]} />
            <ThemedText type="small" style={styles.timelineText}>
              🍕 Preparando ({prepTime} min)
            </ThemedText>
          </View>
          <View style={styles.timelineLine} />
          <View style={styles.timelineItem}>
            <View style={[styles.timelineDot, ['picked_up', 'on_the_way', 'in_transit'].includes(status) && styles.timelineDotActive]} />
            <ThemedText type="small" style={styles.timelineText}>
              🚗 En camino ({deliveryTime} min)
            </ThemedText>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ComeYaColors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  statusText: {
    color: '#666',
    marginBottom: 4,
  },
  timeText: {
    color: ComeYaColors.primary,
    fontWeight: '700',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  progressBar: {
    height: '100%',
    backgroundColor: ComeYaColors.primary,
    borderRadius: 4,
  },
  timeline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E0E0E0',
    marginRight: Spacing.xs,
  },
  timelineDotActive: {
    backgroundColor: ComeYaColors.primary,
  },
  timelineLine: {
    flex: 0.3,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginHorizontal: Spacing.xs,
  },
  timelineText: {
    color: '#666',
    fontSize: 12,
  },
});
