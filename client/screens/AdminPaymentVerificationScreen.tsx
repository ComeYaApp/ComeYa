// Admin Payment Verification Panel
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { apiRequest } from '../lib/query-client';

export default function AdminPaymentVerificationScreen() {
  const { theme: colors } = useTheme();
  const [proofs, setProofs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProof, setSelectedProof] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadPendingProofs();
  }, []);

  const loadPendingProofs = async () => {
    try {
      const response = await apiRequest('/digital-payments/proof/pending', {
        method: 'GET',
      });

      if (response.success) {
        setProofs(response.proofs);
      }
    } catch (error) {
      console.error('Error loading proofs:', error);
      Alert.alert('Error', 'No se pudieron cargar los comprobantes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPendingProofs();
  };

  const handleViewProof = (proof: any) => {
    setSelectedProof(proof);
    setVerificationNotes('');
    setShowModal(true);
  };

  const handleVerify = async (approved: boolean) => {
    if (!approved && !verificationNotes.trim()) {
      Alert.alert('Error', 'Por favor ingresa una razón para el rechazo');
      return;
    }

    Alert.alert(
      approved ? 'Aprobar Comprobante' : 'Rechazar Comprobante',
      approved
        ? '¿Confirmas que el comprobante es válido? Los fondos serán distribuidos.'
        : '¿Confirmas que el comprobante es inválido? El pedido será cancelado.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: approved ? 'Aprobar' : 'Rechazar',
          style: approved ? 'default' : 'destructive',
          onPress: async () => {
            setProcessing(true);
            try {
              const response = await apiRequest('/digital-payments/proof/verify', {
                method: 'POST',
                body: JSON.stringify({
                  proofId: selectedProof.id,
                  approved,
                  notes: verificationNotes.trim() || undefined,
                }),
              });

              if (response.success) {
                Alert.alert(
                  'Éxito',
                  approved
                    ? 'Comprobante aprobado y fondos distribuidos'
                    : 'Comprobante rechazado',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        setShowModal(false);
                        loadPendingProofs();
                      },
                    },
                  ]
                );
              } else {
                throw new Error(response.message || 'Error al verificar');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message);
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Verificación de Pagos
        </Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {proofs.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Pendientes
          </Text>
        </View>
      </View>

      {/* Proofs List */}
      <ScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {proofs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="checkmark-done-circle"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No hay comprobantes pendientes
            </Text>
          </View>
        ) : (
          proofs.map((proof) => (
            <TouchableOpacity
              key={proof.id}
              style={[styles.proofCard, { backgroundColor: colors.card }]}
              onPress={() => handleViewProof(proof)}
            >
              <View style={styles.proofHeader}>
                <View style={styles.proofInfo}>
                  <Text style={[styles.proofProvider, { color: colors.text }]}>
                    {proof.paymentProvider}
                  </Text>
                  <Text style={[styles.proofReference, { color: colors.textSecondary }]}>
                    Ref: {proof.referenceNumber}
                  </Text>
                </View>
                <View style={styles.proofAmount}>
                  <Text style={[styles.amountValue, { color: colors.primary }]}>
                    {(proof.amount / 100).toFixed(2)} €
                  </Text>
                </View>
              </View>

              <View style={styles.proofFooter}>
                <View style={styles.timeInfo}>
                  <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                    {new Date(proof.submittedAt).toLocaleString('es-VE', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Verification Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Verificar Comprobante
              </Text>
              <TouchableOpacity
                onPress={() => setShowModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selectedProof && (
              <ScrollView style={styles.modalBody}>
                {/* Proof Image */}
                {selectedProof.proofImageUrl && (
                  <View style={styles.imageContainer}>
                    <Image
                      source={{ uri: selectedProof.proofImageUrl }}
                      style={styles.proofImage}
                      resizeMode="contain"
                    />
                  </View>
                )}

                {/* Details */}
                <View style={styles.detailsSection}>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      Método de Pago
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {selectedProof.paymentProvider}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      Referencia
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {selectedProof.referenceNumber}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      Monto
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.primary }]}>
                      {(selectedProof.amount / 100).toFixed(2)} €
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      Enviado
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {new Date(selectedProof.submittedAt).toLocaleString('es-VE')}
                    </Text>
                  </View>
                </View>

                {/* Notes Input */}
                <View style={styles.notesSection}>
                  <Text style={[styles.notesLabel, { color: colors.text }]}>
                    Notas de Verificación (opcional)
                  </Text>
                  <TextInput
                    style={[
                      styles.notesInput,
                      {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="Agregar notas..."
                    placeholderTextColor={colors.textSecondary}
                    value={verificationNotes}
                    onChangeText={setVerificationNotes}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </ScrollView>
            )}

            {/* Action Buttons */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.rejectButton, { backgroundColor: '#FF3B3020' }]}
                onPress={() => handleVerify(false)}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#FF3B30" />
                ) : (
                  <>
                    <Ionicons name="close-circle" size={20} color="#FF3B30" />
                    <Text style={styles.rejectButtonText}>Rechazar</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.approveButton, { backgroundColor: '#34C759' }]}
                onPress={() => handleVerify(true)}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                    <Text style={styles.approveButtonText}>Aprobar</Text>
                  </>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  refreshButton: {
    padding: 8,
  },
  statsCard: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  proofCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  proofHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  proofInfo: {
    flex: 1,
  },
  proofProvider: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  proofReference: {
    fontSize: 14,
  },
  proofAmount: {
    alignItems: 'flex-end',
  },
  amountValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  proofFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
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
  imageContainer: {
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  proofImage: {
    width: '100%',
    height: 300,
  },
  detailsSection: {
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  notesSection: {
    marginBottom: 20,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  notesInput: {
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    borderWidth: 1,
    minHeight: 80,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  approveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
