import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { ComeYaLogo } from "@/components/ComeYaLogo";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import { useResponsive } from "@/hooks/useResponsive";

interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zipCode?: string;
  isDefault: boolean;
}

type Nav = NativeStackNavigationProp<ProfileStackParamList>;

const PRIMARY = "#DC2626";

export default function SavedAddressesScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<string | null>(null);
  const { isMobile } = useResponsive();

  useEffect(() => {
    loadAddresses();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadAddresses();
    }, []),
  );

  const loadAddresses = async () => {
    try {
      const response = await apiRequest("GET", `/api/users/${user?.id}/addresses`);
      const data = await response.json();
      setAddresses(data.addresses || []);
    } catch (error) {
      console.error("Error loading addresses:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (addressId: string) => {
    try {
      await apiRequest("PUT", `/api/users/${user?.id}/addresses/${addressId}/default`);
      await loadAddresses();
      showToast("Dirección predeterminada actualizada", "success");
    } catch (error) {
      showToast("Error al actualizar dirección", "error");
    }
  };

  const handleDelete = (addressId: string) => {
    setAddressToDelete(addressId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!addressToDelete) return;
    try {
      await apiRequest("DELETE", `/api/users/${user?.id}/addresses/${addressToDelete}`);
      await loadAddresses();
      showToast("Dirección eliminada", "success");
    } catch (error) {
      showToast("Error al eliminar dirección", "error");
    } finally {
      setShowDeleteModal(false);
      setAddressToDelete(null);
    }
  };

  return (
    <>
    <ScrollView style={{ flex: 1, backgroundColor: "#FAFAFA" }} contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap" as any }}>
      {/* LEFT: Hero Section — oculto en móvil */}
      {!isMobile && <View style={styles.heroSection}>
        <View style={styles.heroContent}>
          {/* Logo */}
          <Pressable onPress={() => navigation.goBack()} style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <ComeYaLogo size={48} />
            </View>
            <ThemedText type="h2" style={styles.logoText}>ComeYa</ThemedText>
          </Pressable>

          {/* Headline */}
          <View style={styles.heroTextContainer}>
            <ThemedText type="h1" style={styles.heroTitle}>
              Tus direcciones
            </ThemedText>
            <ThemedText type="body" style={styles.heroSubtitle}>
              Gestiona las direcciones donde recibes tus pedidos
            </ThemedText>
          </View>

          {/* Stats Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroCardHeader}>
              <Feather name="map-pin" size={24} color={PRIMARY} />
              <ThemedText type="h4" style={{ marginLeft: 12 }}>Resumen</ThemedText>
            </View>
            <View style={styles.heroCardDivider} />
            <View style={styles.statRow}>
              <ThemedText type="body" style={{ color: "#6B7280" }}>
                Total de direcciones
              </ThemedText>
              <ThemedText type="h3" style={{ color: PRIMARY }}>
                {addresses.length}
              </ThemedText>
            </View>
            <View style={styles.statRow}>
              <ThemedText type="body" style={{ color: "#6B7280" }}>
                Predeterminada
              </ThemedText>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {addresses.find(a => a.isDefault)?.label || "Ninguna"}
              </ThemedText>
            </View>
          </View>

          {/* Tips */}
          <View style={styles.tipsContainer}>
            <View style={styles.tipItem}>
              <Feather name="info" size={16} color="rgba(255,255,255,0.8)" />
              <ThemedText type="small" style={{ color: "rgba(255,255,255,0.8)", marginLeft: 8 }}>
                La dirección predeterminada se usará automáticamente
              </ThemedText>
            </View>
            <View style={styles.tipItem}>
              <Feather name="info" size={16} color="rgba(255,255,255,0.8)" />
              <ThemedText type="small" style={{ color: "rgba(255,255,255,0.8)", marginLeft: 8 }}>
                Puedes tener múltiples direcciones guardadas
              </ThemedText>
            </View>
          </View>
        </View>
      </View>}

      {/* RIGHT: Content Section */}
      <View style={[styles.contentSection, isMobile && { padding: 16, justifyContent: 'flex-start' }]}>
        <View style={[styles.contentCard, isMobile && { padding: 20, borderRadius: 16 }]}>
            {loading ? (
              <View style={styles.emptyState}>
                <ThemedText type="body" style={{ color: "#6B7280" }}>
                  Cargando...
                </ThemedText>
              </View>
            ) : addresses.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="map-pin" size={64} color="#D1D5DB" />
                <ThemedText type="h3" style={{ marginTop: 24, color: "#1F2937" }}>
                  No tienes direcciones guardadas
                </ThemedText>
                <ThemedText type="body" style={{ color: "#6B7280", marginTop: 12, textAlign: "center" }}>
                  Agrega una dirección para hacer tus pedidos más rápido
                </ThemedText>
                <Pressable
                  onPress={() => navigation.navigate("AddAddress")}
                  style={styles.emptyStateButton}
                >
                  <Feather name="plus" size={20} color="#FFF" />
                  <ThemedText type="body" style={{ color: "#FFF", marginLeft: 12, fontWeight: "600" }}>
                    Agregar primera dirección
                  </ThemedText>
                </Pressable>
              </View>
            ) : (
              <>
                {addresses.map((address) => (
                  <View key={address.id} style={styles.addressCard}>
                    <View style={styles.addressHeader}>
                      <View style={styles.addressLabelRow}>
                        <View style={styles.iconCircle}>
                          <Feather
                            name={
                              address.label === "Casa"
                                ? "home"
                                : address.label === "Trabajo"
                                  ? "briefcase"
                                  : "map-pin"
                            }
                            size={20}
                            color={PRIMARY}
                          />
                        </View>
                        <ThemedText type="h4" style={{ marginLeft: 12 }}>
                          {address.label}
                        </ThemedText>
                      </View>
                      {address.isDefault && (
                        <View style={styles.defaultBadge}>
                          <Feather name="check-circle" size={14} color="#059669" />
                          <ThemedText type="small" style={{ color: "#059669", marginLeft: 6, fontWeight: "600" }}>
                            Predeterminada
                          </ThemedText>
                        </View>
                      )}
                    </View>

                    <ThemedText type="body" style={{ color: "#6B7280", marginTop: 12 }}>
                      {address.street}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: "#9CA3AF", marginTop: 4 }}>
                      {address.city}, {address.state} {address.zipCode}
                    </ThemedText>

                    <View style={styles.addressActions}>
                      <Pressable
                        style={styles.actionButton}
                        onPress={() => navigation.navigate("AddAddress", { address })}
                      >
                        <Feather name="edit-2" size={16} color={PRIMARY} />
                        <ThemedText type="small" style={{ color: PRIMARY, marginLeft: 8, fontWeight: "600" }}>
                          Editar
                        </ThemedText>
                      </Pressable>
                      {!address.isDefault && (
                        <Pressable
                          style={styles.actionButton}
                          onPress={() => handleSetDefault(address.id)}
                        >
                          <Feather name="check" size={16} color={PRIMARY} />
                          <ThemedText type="small" style={{ color: PRIMARY, marginLeft: 8, fontWeight: "600" }}>
                            Predeterminada
                          </ThemedText>
                        </Pressable>
                      )}
                      <Pressable
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => handleDelete(address.id)}
                      >
                        <Feather name="trash-2" size={16} color="#DC2626" />
                        <ThemedText type="small" style={{ color: "#DC2626", marginLeft: 8, fontWeight: "600" }}>
                          Eliminar
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                ))}

                {/* Add New Button */}
                <Pressable
                  onPress={() => navigation.navigate("AddAddress")}
                  style={styles.addNewButton}
                >
                  <Feather name="plus" size={20} color={PRIMARY} />
                  <ThemedText type="body" style={{ color: PRIMARY, marginLeft: 12, fontWeight: "600" }}>
                    Agregar nueva dirección
                  </ThemedText>
                </Pressable>
              </>
            )}
          </View>
        </View>
    </ScrollView>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        visible={showDeleteModal}
        title="Eliminar dirección"
        message="¿Estás seguro de eliminar esta dirección?"
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowDeleteModal(false);
          setAddressToDelete(null);
        }}
        confirmText="Eliminar"
      />
    </>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#FAFAFA",
    minHeight: "100vh",
    flexWrap: "wrap" as any,
    ...Platform.select({
      web: {
        height: "100vh",
        overflow: "hidden",
      },
    }),
  },
  // LEFT: Hero Section
  heroSection: {
    flex: 1,
    minWidth: 300,
    maxWidth: 600,
    backgroundColor: PRIMARY,
    padding: 48,
    justifyContent: "center",
  },
  heroContent: {
    maxWidth: 480,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 48,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  logoText: {
    color: "#FFF",
    marginLeft: 16,
    fontSize: 28,
    fontWeight: "700",
  },
  heroTextContainer: {
    marginBottom: 48,
  },
  heroTitle: {
    fontSize: 48,
    fontWeight: "800",
    color: "#FFF",
    marginBottom: 16,
    lineHeight: 56,
  },
  heroSubtitle: {
    fontSize: 18,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 28,
  },
  heroCard: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 32,
    marginBottom: 32,
    ...Platform.select({
      web: {
        boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
      },
    }),
  },
  heroCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  heroCardDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginBottom: 16,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  tipsContainer: {
    gap: 16,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  // RIGHT: Content Section
  contentSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 48,
  },
  contentScrollView: {
    flex: 1,
    width: "100%",
  },
  contentScrollContent: {
    alignItems: "center",
    paddingVertical: 48,
  },
  contentCard: {
    width: "100%",
    maxWidth: 720,
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 48,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      },
    }),
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  emptyStateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginTop: 32,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 12px rgba(220, 38, 38, 0.3)",
      },
    }),
  },
  addressCard: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addressLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  defaultBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  addressActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    flexWrap: "wrap",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  deleteButton: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },
  addNewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
    borderWidth: 2,
    borderColor: PRIMARY,
    borderStyle: "dashed",
    paddingVertical: 20,
    borderRadius: 16,
    marginTop: 8,
  },
});
