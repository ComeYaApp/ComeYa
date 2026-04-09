// Delivery Confirmation Screen
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { apiRequest } from '../lib/query-client';

interface Props {
  orderId: string;
  orderDetails: {
    businessName: string;
    total: number;
    items: any[];
    deliveredAt: string;
  };
  onConfirmed: () => void;
  onDisputed: () => void;
}

export default function DeliveryConfirmationScreen({
  orderId,
  orderDetails,
  onConfirmed,
  onDisputed,
}: Props) {
  const { colors } = useTheme();
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const issues = [
    { id: 'never_arrived', label: 'El pedido nunca llegó', icon: 'close-circle' },
    { id: 'wrong_items', label: 'Productos incorrectos', icon: 'swap-horizontal' },
    { id: 'damaged', label: 'Productos dañados', icon: 'warning' },
    { id: 'incomplete', label: 'Pedido incompleto', icon: 'remove-circle' },
    { id: 'quality', label: 'Mala calidad', icon: 'thumbs-down' },
    { id: 'other', label: 'Otro problema', icon: 'help-circle' },
  ];

  const handleConfirmDelivery = async () => {
    Alert.alert(
      '¿Confirmar Entrega?',
      'Al confirmar, los fondos serán liberados al negocio y repartidor. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'default',
          onPress: async () => {
            setLoading(true);
            try {
              const response = await apiRequest('/fund-release/confirm-delivery', {
                method: 'POST',
                body: JSON.stringify({ orderId }),
              });

              if (response.success) {
                Alert.alert(
                  '¡Gracias!',
                  'Tu confirmación ha sido registrada. Los fondos han sido liberados.',
                  [{ text: 'OK', onPress: onConfirmed }]
                );
              } else {
                throw new Error(response.message || 'Error al confirmar entrega');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleReportIssue = () => {
    setShowDisputeModal(true);
  };

  const handleSubmitDispute = async () => {
    if (!selectedIssue) {
      Alert.alert('Error', 'Por favor selecciona el tipo de problema');
      return;
    }

    if (selectedIssue === 'other' && !disputeReason.trim()) {
      Alert.alert('Error', 'Por favor describe el problema');
      return;
    }

    setLoading(true);

    try {
      const issue = issues.find((i) => i.id === selectedIssue);
      const reason =
        selectedIssue === 'other'
          ? disputeReason
          : issue?.label || 'Problema con el pedido';

      const response = await apiRequest('/fund-release/dispute', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          reason,
        }),
      });

      if (response.success) {
        setShowDisputeModal(false);
        Alert.alert(
          'Disputa Registrada',
          'Tu caso será revisado por nuestro equipo. Te contactaremos pronto.',
          [{ text: 'OK', onPress: onDisputed }]
        );
      } else {
        throw new Error(response.message || 'Error al registrar disputa');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header Icon */}
        <View style={styles.headerIcon}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: colors.primary + '20' },
            ]}
          >
            <Ionicons name="checkmark-done" size={64} color={colors.primary} />
          </View>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.text }]}>
          ¿Recibiste tu pedido?
        </Text>

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Confirma que todo está correcto para liberar el pago al negocio y
          repartidor
        </Text>

        {/* Order Summary */}
        <View style={[styles.orderCard, { backgroundColor: colors.card }]}>
          <View style={styles.orderHeader}>
            <Ionicons name="restaurant" size={24} color={colors.primary} />
            <Text style={[styles.businessName, { color: colors.text }]}>
              {orderDetails.businessName}
            </Text>
          </View>

          <View style={styles.orderDetail}>
            <Text style={[styles.orderLabel, { color: colors.textSecondary }]}>
              Total Pagado
            </Text>
            <Text style={[styles.orderValue, { color: colors.primary }]}>
              €{orderDetails.total.toFixed(2)}
            </Text>
          </View>

          <View style={styles.orderDetail}>
            <Text style={[styles.orderLabel, { color: colors.textSecondary }]}>
              Entregado
            </Text>
            <Text style={[styles.orderValue, { color: colors.text }]}>
              {new Date(orderDetails.deliveredAt).toLocaleString('es-VE', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>

        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: '#34C75920' }]}>
          <Ionicons name="information-circle" size={24} color="#34C759" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>¿Por qué confirmar?</Text>
            <Text style={styles.infoText}>
              Tu confirmación permite que el negocio y el repartidor reciban su
              pago. Si no confirmas en 24 horas, se liberará automáticamente.
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              { backgroundColor: colors.primary },
            ]}
            onPress={handleConfirmDelivery}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                <Text style={styles.confirmButtonText}>
                  Sí, Todo Está Bien
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.issueButton, { backgroundColor: colors.card }]}
            onPress={handleReportIssue}
            disabled={loading}
          >
            <Ionicons name="alert-circle" size={24} color="#FF3B30" />
            <Text style={[styles.issueButtonText, { color: colors.text }]}>
              Reportar un Problema
            </Text>
          </TouchableOpacity>
        </View>

        {/* Auto-release Info */}
        <View style={[styles.autoReleaseCard, { backgroundColor: colors.card }]}>
          <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.autoReleaseText, { color: colors.textSecondary }]}>
            Si no confirmas en 24 horas, el pago se liberará automáticamente.
            Podrás disputar hasta 3 días después.
          </Text>
        </View>
      </ScrollView>

      {/* Dispute Modal */}
      <Modal
        visible={showDisputeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDisputeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Reportar Problema
              </Text>
              <TouchableOpacity
                onPress={() => setShowDisputeModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={[styles.modalLabel, { color: colors.text }]}>
                ¿Qué problema tuviste?
              </Text>

              {issues.map((issue) => (
                <TouchableOpacity
                  key={issue.id}
                  style={[
                    styles.issueOption,
                    {
                      backgroundColor:
                        selectedIssue === issue.id
                          ? colors.primary + '20'
                          : colors.background,
                      borderColor:
                        selectedIssue === issue.id
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedIssue(issue.id)}
                >
                  <Ionicons
                    name={issue.icon as any}
                    size={24}
                    color={
                      selectedIssue === issue.id
                        ? colors.primary
                        : colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.issueOptionText,
                      {
                        color:
                          selectedIssue === issue.id
                            ? colors.primary
                            : colors.text,
                      },
                    ]}
                  >
                    {issue.label}
                  </Text>
                  {selectedIssue === issue.id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              ))}

              {selectedIssue === 'other' && (
                <TextInput
                  style={[
                    styles.textArea,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="Describe el problema..."
                  placeholderTextColor={colors.textSecondary}
                  value={disputeReason}
                  onChangeText={setDisputeReason}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[
                  styles.submitDisputeButton,
                  {
                    backgroundColor: selectedIssue ? '#FF3B30' : colors.border,
                  },
                ]}
                onPress={handleSubmitDispute}
                disabled={!selectedIssue || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitDisputeButtonText}>
                    Enviar Reporte
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  headerIcon: {
    alignItems: 'center',
    marginVertical: 32,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  orderCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  businessName: {
    fontSize: 18,
    fontWeight: '600',
  },
  orderDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  orderLabel: {
    fontSize: 14,
  },
  orderValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 32,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  actions: {
    gap: 12,
    marginBottom: 20,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    gap: 12,
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  issueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  issueButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  autoReleaseCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 32,
  },
  autoReleaseText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  issueOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
  },
  issueOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  textArea: {
    padding: 16,
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 1,
    marginTop: 12,
    minHeight: 100,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  submitDisputeButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitDisputeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
