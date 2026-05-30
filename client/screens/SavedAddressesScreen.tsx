import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

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

export default function SavedAddressesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

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
      const response = await apiRequest(
        "GET",
        `/api/users/${user?.id}/addresses`,
      );
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
      await apiRequest(
        "PUT",
        `/api/users/${user?.id}/addresses/${addressId}/default`,
      );
      await loadAddresses();
      showToast("Dirección predeterminada actualizada", "success");
    } catch (error) {
      showToast("Error al actualizar dirección", "error");
    }
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<string | null>(null);

  const handleDelete = (addressId: string) => {
    console.log("🗑️ Delete button pressed for:", addressId);
    setAddressToDelete(addressId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!addressToDelete) return;

    try {
      await apiRequest(
        "DELETE",
        `/api/users/${user?.id}/addresses/${addressToDelete}`,
      );
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
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: Spacing.md }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">Direcciones Guardadas</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={ComeYaColors.primary} />
          </View>
        ) : addresses.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="map-pin" size={48} color={theme.textSecondary} />
            <ThemedText type="h4" style={{ marginTop: Spacing.lg }}>
              No tienes direcciones guardadas
            </ThemedText>
            <ThemedText
              type="body"
              style={{
                color: theme.textSecondary,
                marginTop: Spacing.sm,
                textAlign: "center",
              }}
            >
              Agrega una dirección para hacer tus pedidos más rápido
            </ThemedText>
          </View>
        ) : (
          addresses.map((address) => (
            <View
              key={address.id}
              style={[
                styles.addressCard,
                {
                  backgroundColor: theme.card,
                  borderColor: address.isDefault
                    ? ComeYaColors.primary
                    : theme.border,
                  borderWidth: 1.5,
                },
                Shadows.sm,
              ]}
            >
              <View style={styles.addressHeader}>
                <View style={styles.addressLabel}>
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: ComeYaColors.primary + "15" },
                    ]}
                  >
                    <Feather
                      name={
                        address.label === "Casa"
                          ? "home"
                          : address.label === "Trabajo"
                            ? "briefcase"
                            : "map-pin"
                      }
                      size={20}
                      color={ComeYaColors.primary}
                    />
                  </View>
                  <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
                    {address.label}
                  </ThemedText>
                </View>
                {address.isDefault && (
                  <View
                    style={[
                      styles.defaultBadge,
                      { backgroundColor: ComeYaColors.success + "20" },
                    ]}
                  >
                    <Feather
                      name="check-circle"
                      size={14}
                      color={ComeYaColors.success}
                    />
                    <ThemedText
                      type="caption"
                      style={{
                        color: ComeYaColors.success,
                        marginLeft: Spacing.xs,
                      }}
                    >
                      Predeterminada
                    </ThemedText>
                  </View>
                )}
              </View>

              <View style={styles.addressDetails}>
                <ThemedText
                  type="body"
                  style={{ color: theme.text, fontWeight: "500" }}
                >
                  {address.street}
                </ThemedText>
                <ThemedText
                  type="body"
                  style={{ color: theme.textSecondary, marginTop: 4 }}
                >
                  {address.city}, {address.state} {address.zipCode}
                </ThemedText>
              </View>

              <View style={styles.addressActions}>
                <Pressable
                  style={[
                    styles.actionButton,
                    { backgroundColor: ComeYaColors.primary + "15" },
                  ]}
                  onPress={() => navigation.navigate("AddAddress", { address })}
                >
                  <Feather
                    name="edit-2"
                    size={16}
                    color={ComeYaColors.primary}
                  />
                  <ThemedText
                    type="small"
                    style={{
                      color: ComeYaColors.primary,
                      marginLeft: Spacing.xs,
                    }}
                  >
                    Editar
                  </ThemedText>
                </Pressable>
                {!address.isDefault && (
                  <Pressable
                    style={[
                      styles.actionButton,
                      { backgroundColor: ComeYaColors.success + "15" },
                    ]}
                    onPress={() => handleSetDefault(address.id)}
                  >
                    <Feather
                      name="check"
                      size={16}
                      color={ComeYaColors.success}
                    />
                    <ThemedText
                      type="small"
                      style={{
                        color: ComeYaColors.success,
                        marginLeft: Spacing.xs,
                      }}
                    >
                      Predeterminar
                    </ThemedText>
                  </Pressable>
                )}
                <Pressable
                  style={[
                    styles.actionButton,
                    { backgroundColor: ComeYaColors.error + "15" },
                  ]}
                  onPress={() => handleDelete(address.id)}
                >
                  <Feather
                    name="trash-2"
                    size={16}
                    color={ComeYaColors.error}
                  />
                  <ThemedText
                    type="small"
                    style={{
                      color: ComeYaColors.error,
                      marginLeft: Spacing.xs,
                    }}
                  >
                    Eliminar
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + Spacing.lg,
            backgroundColor: theme.background,
          },
        ]}
      >
        <Button
          onPress={() => navigation.navigate("AddAddress")}
          style={styles.addButton}
        >
          <Feather name="plus" size={20} color="#FFFFFF" />
          <ThemedText
            type="body"
            style={{
              color: "#FFFFFF",
              marginLeft: Spacing.sm,
              fontWeight: "600",
            }}
          >
            Agregar nueva dirección
          </ThemedText>
        </Button>
      </View>

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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  backButton: {
    padding: Spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["4xl"],
    paddingHorizontal: Spacing.xl,
  },
  addressCard: {
    padding: Spacing.lg,
    borderRadius: 16,
    marginBottom: Spacing.md,
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  addressLabel: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  addressDetails: {
    marginTop: Spacing.sm,
  },
  defaultBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
  },
  addressActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    flexWrap: "wrap",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: Spacing.md,
  },
});
