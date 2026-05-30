import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Input } from "@/components/Input";
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

interface Address {
  id: string;
  userId: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zipCode?: string;
  isDefault: boolean;
  createdAt: string;
}

export default function AddressesScreen() {
  const insets = useSafeAreaInsets();
  const contentTopPadding = Spacing.lg;
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);

  const [newAddress, setNewAddress] = useState({
    label: "",
    street: "",
    city: "",
    state: "",
    zipCode: "",
  });

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "Mis direcciones",
    });
  }, [navigation]);

  const { data: addressesData, isLoading } = useQuery<{ addresses: Address[] }>(
    {
      queryKey: ["/api/users", user?.id, "addresses"],
      enabled: !!user?.id,
    },
  );

  const addresses = addressesData?.addresses || [];

  const createAddressMutation = useMutation({
    mutationFn: async (addressData: typeof newAddress) => {
      const response = await apiRequest("POST", "/api/addresses", {
        ...addressData,
        userId: user?.id,
        isDefault: addresses.length === 0,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/users", user?.id, "addresses"],
      });
      setShowAddModal(false);
      setNewAddress({
        label: "",
        street: "",
        city: "",
        state: "",
        zipCode: "",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Dirección agregada correctamente", "success");
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast("No se pudo agregar la dirección", "error");
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (addressId: string) => {
      const response = await apiRequest(
        "PATCH",
        `/api/addresses/${addressId}/default`,
        {},
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/users", user?.id, "addresses"],
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast("Dirección predeterminada actualizada", "success");
    },
    onError: () => {
      showToast("No se pudo actualizar la dirección", "error");
    },
  });

  const deleteAddressMutation = useMutation({
    mutationFn: async (addressId: string) => {
      const response = await apiRequest(
        "DELETE",
        `/api/addresses/${addressId}`,
        {},
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/users", user?.id, "addresses"],
      });
      setShowDeleteModal(false);
      setSelectedAddress(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Dirección eliminada", "success");
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast("No se pudo eliminar la dirección", "error");
    },
  });

  const handleAddAddress = () => {
    if (
      !newAddress.label.trim() ||
      !newAddress.street.trim() ||
      !newAddress.city.trim() ||
      !newAddress.state.trim()
    ) {
      showToast("Por favor completa todos los campos obligatorios", "warning");
      return;
    }
    createAddressMutation.mutate(newAddress);
  };

  const handleDeletePress = (address: Address) => {
    setSelectedAddress(address);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (selectedAddress) {
      deleteAddressMutation.mutate(selectedAddress.id);
    }
  };

  const renderAddressCard = (address: Address) => (
    <View
      key={address.id}
      style={[
        styles.addressCard,
        { backgroundColor: theme.card },
        address.isDefault && {
          borderColor: ComeYaColors.primary,
          borderWidth: 2,
        },
        Shadows.sm,
      ]}
    >
      <View style={styles.addressHeader}>
        <View
          style={[
            styles.labelBadge,
            { backgroundColor: ComeYaColors.primary + "20" },
          ]}
        >
          <Feather name="map-pin" size={14} color={ComeYaColors.primary} />
          <ThemedText
            type="caption"
            style={{
              color: ComeYaColors.primary,
              marginLeft: 4,
              fontWeight: "600",
            }}
          >
            {address.label}
          </ThemedText>
        </View>
        {address.isDefault ? (
          <View
            style={[
              styles.defaultBadge,
              { backgroundColor: ComeYaColors.success + "20" },
            ]}
          >
            <ThemedText type="caption" style={{ color: ComeYaColors.success }}>
              Predeterminada
            </ThemedText>
          </View>
        ) : null}
      </View>

      <ThemedText type="body" style={{ marginTop: Spacing.sm }}>
        {address.street}
      </ThemedText>
      <ThemedText type="small" style={{ color: theme.textSecondary }}>
        {address.city}, {address.state}{" "}
        {address.zipCode ? `• ${address.zipCode}` : ""}
      </ThemedText>

      <View style={styles.addressActions}>
        {!address.isDefault ? (
          <Pressable
            onPress={() => setDefaultMutation.mutate(address.id)}
            style={[styles.actionButton, { borderColor: theme.border }]}
          >
            <Feather
              name="check-circle"
              size={16}
              color={ComeYaColors.primary}
            />
            <ThemedText
              type="caption"
              style={{ color: ComeYaColors.primary, marginLeft: 4 }}
            >
              Predeterminada
            </ThemedText>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => handleDeletePress(address)}
          style={[
            styles.actionButton,
            { borderColor: ComeYaColors.error + "40" },
          ]}
        >
          <Feather name="trash-2" size={16} color={ComeYaColors.error} />
          <ThemedText
            type="caption"
            style={{ color: ComeYaColors.error, marginLeft: 4 }}
          >
            Eliminar
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: contentTopPadding,
            paddingBottom: insets.bottom + Spacing.xl + 80,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {addresses.length === 0 ? (
          <View style={styles.emptyState}>
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Feather name="map-pin" size={48} color={theme.textSecondary} />
            </View>
            <ThemedText
              type="h3"
              style={{ marginTop: Spacing.lg, textAlign: "center" }}
            >
              Sin direcciones guardadas
            </ThemedText>
            <ThemedText
              type="body"
              style={{
                color: theme.textSecondary,
                textAlign: "center",
                marginTop: Spacing.sm,
              }}
            >
              Agrega una dirección para recibir tus pedidos más rápido
            </ThemedText>
          </View>
        ) : (
          addresses.map(renderAddressCard)
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + Spacing.lg,
            backgroundColor: theme.backgroundDefault,
          },
        ]}
      >
        <Button onPress={() => setShowAddModal(true)} style={styles.addButton}>
          <View style={styles.addButtonContent}>
            <Feather name="plus" size={20} color="#FFFFFF" />
            <ThemedText
              type="body"
              style={{
                color: "#FFFFFF",
                marginLeft: Spacing.sm,
                fontWeight: "600",
              }}
            >
              Agregar dirección
            </ThemedText>
          </View>
        </Button>
      </View>

      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <ThemedView style={styles.modalContainer}>
          <View
            style={[styles.modalHeader, { borderBottomColor: theme.border }]}
          >
            <Pressable
              onPress={() => setShowAddModal(false)}
              style={styles.closeButton}
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <ThemedText type="h3">Nueva dirección</ThemedText>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={[
              styles.modalContent,
              { paddingBottom: insets.bottom + 100 },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <Input
              label="Etiqueta"
              leftIcon="tag"
              value={newAddress.label}
              onChangeText={(text) =>
                setNewAddress({ ...newAddress, label: text })
              }
              placeholder="Ej: Casa, Oficina, etc."
            />

            <Input
              label="Calle y número"
              leftIcon="map"
              value={newAddress.street}
              onChangeText={(text) =>
                setNewAddress({ ...newAddress, street: text })
              }
              placeholder="Calle, número, colonia"
            />

            <Input
              label="Ciudad"
              leftIcon="map-pin"
              value={newAddress.city}
              onChangeText={(text) =>
                setNewAddress({ ...newAddress, city: text })
              }
              placeholder="Ciudad"
            />

            <Input
              label="Estado"
              leftIcon="compass"
              value={newAddress.state}
              onChangeText={(text) =>
                setNewAddress({ ...newAddress, state: text })
              }
              placeholder="Estado"
            />

            <Input
              label="Código postal (opcional)"
              leftIcon="hash"
              value={newAddress.zipCode}
              onChangeText={(text) =>
                setNewAddress({ ...newAddress, zipCode: text })
              }
              placeholder="Código postal"
              keyboardType="number-pad"
            />
          </ScrollView>

          <View
            style={[
              styles.modalFooter,
              {
                paddingBottom: insets.bottom + Spacing.lg,
                backgroundColor: theme.backgroundDefault,
              },
            ]}
          >
            <Button
              onPress={handleAddAddress}
              loading={createAddressMutation.isPending}
              disabled={createAddressMutation.isPending}
            >
              Guardar dirección
            </Button>
          </View>
        </ThemedView>
      </Modal>

      <ConfirmModal
        visible={showDeleteModal}
        title="Eliminar dirección"
        message={`¿Estás seguro que deseas eliminar "${selectedAddress?.label}"?`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["4xl"],
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  addressCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  labelBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  defaultBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  addressActions: {
    flexDirection: "row",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  addButton: {
    width: "100%",
  },
  addButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  modalFooter: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
});
