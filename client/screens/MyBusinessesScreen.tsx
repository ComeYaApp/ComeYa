import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  RouteProp,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { BackButton } from "@/components/BackButton";
import { useTheme } from "@/hooks/useTheme";
import { useBusiness, Business } from "@/contexts/BusinessContext";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type MyBusinessesRouteProp = RouteProp<RootStackParamList, "MyBusinesses">;

const BUSINESS_TYPES = [
  { id: "restaurant", name: "Restaurante", icon: "coffee" },
  { id: "market", name: "Mercado", icon: "shopping-bag" },
  { id: "bakery", name: "Panadería", icon: "award" },
  { id: "grocery", name: "Abarrotes", icon: "package" },
  { id: "pharmacy", name: "Farmacia", icon: "plus-circle" },
  { id: "other", name: "Otro", icon: "grid" },
];

export default function MyBusinessesScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<MyBusinessesRouteProp>();
  const { user } = useAuth();
  const {
    businesses,
    selectedBusiness,
    isLoading,
    loadBusinesses,
    selectBusiness,
    createBusiness,
    deleteBusiness,
  } = useBusiness();

  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [businessToDelete, setBusinessToDelete] = useState<Business | null>(
    null,
  );
  const [businessToEdit, setBusinessToEdit] = useState<Business | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [newBusiness, setNewBusiness] = useState({
    name: "",
    description: "",
    type: "restaurant",
    address: "",
    phone: "",
    image: "",
  });

  useEffect(() => {
    const params = route.params;
    if (!params) return;

    if (params.openAddModal) {
      setShowAddModal(true);
    }

    if (params.draft) {
      setNewBusiness((prev) => ({
        ...prev,
        name: params.draft?.name || prev.name,
        type: params.draft?.type || prev.type,
        address: params.draft?.address || prev.address,
        phone: params.draft?.phone || prev.phone || user?.phone || "",
      }));
    }

    if (params.openAddModal || params.draft) {
      navigation.setParams({ openAddModal: undefined, draft: undefined });
    }
  }, [navigation, route.params, user?.phone]);

  useFocusEffect(
    useCallback(() => {
      loadBusinesses();
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBusinesses();
    setRefreshing(false);
  };

  const handleSelectBusiness = async (business: Business) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await selectBusiness(business);
    navigation.goBack();
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      try {
        const response = await apiRequest(
          "POST",
          "/api/upload/business-image",
          {
            image: `data:image/jpeg;base64,${result.assets[0].base64}`,
          },
        );
        const data = await response.json();
        if (data.success && data.imageUrl) {
          setNewBusiness((prev) => ({ ...prev, image: data.imageUrl }));
        }
      } catch (error) {
        console.error("Error uploading image:", error);
      }
    }
  };

  const handleCreateBusiness = async () => {
    if (!newBusiness.name.trim()) {
      Alert.alert("Error", "El nombre del negocio es requerido");
      return;
    }

    setSubmitting(true);
    try {
      await createBusiness(newBusiness);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAddModal(false);
      setNewBusiness({
        name: "",
        description: "",
        type: "restaurant",
        address: "",
        phone: "",
        image: "",
      });
    } catch (error: any) {
      Alert.alert("Error", error.message || "No se pudo crear el negocio");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (business: Business) => {
    setBusinessToDelete(business);
    setShowDeleteModal(true);
  };

  const handleDeleteBusiness = async () => {
    if (!businessToDelete) return;

    setSubmitting(true);
    try {
      await deleteBusiness(businessToDelete.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowDeleteModal(false);
      setBusinessToDelete(null);
    } catch (error: any) {
      Alert.alert("Error", error.message || "No se pudo eliminar el negocio");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditBusiness = async () => {
    if (!businessToEdit || !newBusiness.name.trim()) {
      Alert.alert("Error", "El nombre del negocio es requerido");
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("PUT", `/api/business/${businessToEdit.id}`, {
        name: newBusiness.name,
        description: newBusiness.description,
        type: newBusiness.type,
        address: newBusiness.address,
        phone: newBusiness.phone,
        image: newBusiness.image,
      });
      await loadBusinesses();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowEditModal(false);
      setBusinessToEdit(null);
      setNewBusiness({
        name: "",
        description: "",
        type: "restaurant",
        address: "",
        phone: "",
        image: "",
      });
      Alert.alert("Éxito", "Negocio actualizado correctamente");
    } catch (error: any) {
      Alert.alert("Error", error.message || "No se pudo actualizar el negocio");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (business: Business) => {
    setBusinessToEdit(business);
    setNewBusiness({
      name: business.name || "",
      description: business.description || "",
      type: business.type || "restaurant",
      address: business.address || "",
      phone: business.phone || "",
      image: business.image || "",
    });
    setShowEditModal(true);
  };

  const formatCurrency = (amount: number) => {
    return `€${(amount / 100).toFixed(2)}`;
  };

  const getImageUrl = (imagePath: string | undefined): string | undefined => {
    if (!imagePath) return undefined;
    if (imagePath.startsWith("http")) return imagePath;
    return `${getApiUrl()}${imagePath}`;
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.theme.backgroundRoot,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: insets.top + Spacing.md,
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
      backgroundColor: ComeYaColors.primary,
    },
    backButton: {
      marginRight: Spacing.md,
      padding: Spacing.xs,
    },
    headerContent: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: "#fff",
    },
    headerSubtitle: {
      fontSize: 14,
      color: "rgba(255,255,255,0.8)",
      marginTop: 4,
    },
    content: {
      flex: 1,
      padding: Spacing.lg,
    },
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: ComeYaColors.primary,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.lg,
      ...Shadows.md,
    },
    addButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
      marginLeft: Spacing.sm,
    },
    businessCard: {
      backgroundColor: theme.theme.card,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.md,
      overflow: "hidden",
      ...Shadows.sm,
    },
    selectedCard: {
      borderWidth: 2,
      borderColor: ComeYaColors.primary,
    },
    businessImage: {
      width: "100%",
      height: 120,
      backgroundColor: theme.theme.border,
    },
    businessImagePlaceholder: {
      width: "100%",
      height: 120,
      backgroundColor: theme.theme.border,
      justifyContent: "center",
      alignItems: "center",
    },
    businessInfo: {
      padding: Spacing.md,
    },
    businessHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    businessName: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.theme.text,
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.sm,
      marginLeft: Spacing.sm,
    },
    openBadge: {
      backgroundColor: ComeYaColors.success + "20",
    },
    closedBadge: {
      backgroundColor: theme.theme.border,
    },
    statusText: {
      fontSize: 12,
      fontWeight: "600",
    },
    businessType: {
      fontSize: 14,
      color: theme.theme.textSecondary,
      marginTop: 2,
    },
    statsRow: {
      flexDirection: "row",
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.theme.border,
    },
    statItem: {
      flex: 1,
      alignItems: "center",
    },
    statValue: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.theme.text,
    },
    statLabel: {
      fontSize: 12,
      color: theme.theme.textSecondary,
      marginTop: 2,
    },
    actionsRow: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: theme.theme.border,
    },
    actionButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: Spacing.md,
    },
    actionButtonDanger: {
      borderLeftWidth: 1,
      borderLeftColor: theme.theme.border,
    },
    actionText: {
      fontSize: 14,
      fontWeight: "600",
      marginLeft: Spacing.xs,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: theme.theme.card,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      padding: Spacing.lg,
      paddingBottom: insets.bottom + Spacing.lg,
      maxHeight: "90%",
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.theme.text,
      marginBottom: Spacing.lg,
      textAlign: "center",
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.theme.text,
      marginBottom: Spacing.xs,
    },
    input: {
      backgroundColor: theme.theme.background,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      fontSize: 16,
      color: theme.theme.text,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: theme.theme.border,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: "top",
    },
    typeSelector: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginBottom: Spacing.md,
      gap: Spacing.sm,
    },
    typeOption: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.theme.background,
      borderWidth: 1,
      borderColor: theme.theme.border,
    },
    typeOptionSelected: {
      backgroundColor: ComeYaColors.primary + "20",
      borderColor: ComeYaColors.primary,
    },
    typeOptionText: {
      fontSize: 14,
      marginLeft: Spacing.xs,
      color: theme.theme.text,
    },
    imagePickerButton: {
      backgroundColor: theme.theme.background,
      borderRadius: BorderRadius.md,
      padding: Spacing.lg,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: theme.theme.border,
      borderStyle: "dashed",
      minHeight: 120,
    },
    selectedImage: {
      width: "100%",
      height: 120,
      borderRadius: BorderRadius.md,
    },
    imagePickerText: {
      fontSize: 14,
      color: theme.theme.textSecondary,
      marginTop: Spacing.sm,
    },
    modalButtons: {
      flexDirection: "row",
      gap: Spacing.md,
      marginTop: Spacing.lg,
    },
    modalButton: {
      flex: 1,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      alignItems: "center",
    },
    cancelButton: {
      backgroundColor: theme.theme.background,
      borderWidth: 1,
      borderColor: theme.theme.border,
    },
    confirmButton: {
      backgroundColor: ComeYaColors.primary,
    },
    deleteButton: {
      backgroundColor: ComeYaColors.error,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: "600",
    },
    deleteModalContent: {
      backgroundColor: theme.theme.card,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      marginHorizontal: Spacing.lg,
      alignItems: "center",
    },
    deleteIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: ComeYaColors.error + "20",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: Spacing.md,
    },
    deleteMessage: {
      fontSize: 16,
      color: theme.theme.textSecondary,
      textAlign: "center",
      marginTop: Spacing.sm,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: Spacing.xxl,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.theme.border,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: Spacing.lg,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.theme.text,
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.theme.textSecondary,
      marginTop: Spacing.xs,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
  });

  if (isLoading && businesses.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>Mis Negocios</ThemedText>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ComeYaColors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton />
        <View style={styles.headerContent}>
          <ThemedText style={styles.headerTitle}>Mis Negocios</ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            {businesses.length}{" "}
            {businesses.length === 1 ? "negocio" : "negocios"} registrados
          </ThemedText>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ComeYaColors.primary}
          />
        }
      >
        <Pressable
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Feather name="plus" size={20} color="#fff" />
          <ThemedText style={styles.addButtonText}>
            Agregar Nuevo Negocio
          </ThemedText>
        </Pressable>

        {businesses.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather
                name="briefcase"
                size={36}
                color={theme.theme.textSecondary}
              />
            </View>
            <ThemedText style={styles.emptyText}>Sin negocios</ThemedText>
            <ThemedText style={styles.emptySubtext}>
              Agrega tu primer negocio para comenzar
            </ThemedText>
          </View>
        ) : (
          businesses.map((business: any, index: number) => (
            <Animated.View
              key={business.id}
              entering={FadeInDown.delay(index * 100)}
            >
              <Pressable
                style={[
                  styles.businessCard,
                  selectedBusiness?.id === business.id && styles.selectedCard,
                ]}
                onPress={() => handleSelectBusiness(business)}
              >
                {business.image ? (
                  <Image
                    source={{ uri: getImageUrl(business.image) }}
                    style={styles.businessImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.businessImagePlaceholder}>
                    <Feather
                      name="image"
                      size={32}
                      color={theme.theme.textSecondary}
                    />
                  </View>
                )}

                <View style={styles.businessInfo}>
                  <View style={styles.businessHeader}>
                    <ThemedText style={styles.businessName} numberOfLines={1}>
                      {business.name}
                    </ThemedText>
                    <View
                      style={[
                        styles.statusBadge,
                        business.isOpen ? styles.openBadge : styles.closedBadge,
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.statusText,
                          {
                            color: business.isOpen
                              ? ComeYaColors.success
                              : theme.theme.textSecondary,
                          },
                        ]}
                      >
                        {business.isOpen ? "Abierto" : "Cerrado"}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText style={styles.businessType}>
                    {BUSINESS_TYPES.find((t) => t.id === business.type)?.name ||
                      "Negocio"}
                  </ThemedText>

                  {business.stats && (
                    <View style={styles.statsRow}>
                      <View style={styles.statItem}>
                        <ThemedText style={styles.statValue}>
                          {business.stats.pendingOrders}
                        </ThemedText>
                        <ThemedText style={styles.statLabel}>
                          Pendientes
                        </ThemedText>
                      </View>
                      <View style={styles.statItem}>
                        <ThemedText style={styles.statValue}>
                          {business.stats.totalOrders}
                        </ThemedText>
                        <ThemedText style={styles.statLabel}>
                          Completadas
                        </ThemedText>
                      </View>
                      <View style={styles.statItem}>
                        <ThemedText style={styles.statValue}>
                          {formatCurrency(business.stats.totalRevenue)}
                        </ThemedText>
                        <ThemedText style={styles.statLabel}>
                          Ingresos
                        </ThemedText>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.actionsRow}>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => handleSelectBusiness(business)}
                  >
                    <Feather
                      name={
                        selectedBusiness?.id === business.id
                          ? "check-circle"
                          : "circle"
                      }
                      size={18}
                      color={
                        selectedBusiness?.id === business.id
                          ? ComeYaColors.primary
                          : theme.theme.textSecondary
                      }
                    />
                    <ThemedText
                      style={[
                        styles.actionText,
                        {
                          color:
                            selectedBusiness?.id === business.id
                              ? ComeYaColors.primary
                              : theme.theme.textSecondary,
                        },
                      ]}
                    >
                      {selectedBusiness?.id === business.id
                        ? "Seleccionado"
                        : "Seleccionar"}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.actionButton,
                      {
                        borderLeftWidth: 1,
                        borderLeftColor: theme.theme.border,
                      },
                    ]}
                    onPress={() => openEditModal(business)}
                  >
                    <Feather
                      name="edit-2"
                      size={18}
                      color={ComeYaColors.primary}
                    />
                    <ThemedText
                      style={[
                        styles.actionText,
                        { color: ComeYaColors.primary },
                      ]}
                    >
                      Editar
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, styles.actionButtonDanger]}
                    onPress={() => confirmDelete(business)}
                  >
                    <Feather
                      name="trash-2"
                      size={18}
                      color={ComeYaColors.error}
                    />
                    <ThemedText
                      style={[styles.actionText, { color: ComeYaColors.error }]}
                    >
                      Eliminar
                    </ThemedText>
                  </Pressable>
                </View>
              </Pressable>
            </Animated.View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Nuevo Negocio</ThemedText>

            <ThemedText style={styles.inputLabel}>Nombre *</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Nombre del negocio"
              placeholderTextColor={theme.theme.textSecondary}
              value={newBusiness.name}
              onChangeText={(text) =>
                setNewBusiness((prev) => ({ ...prev, name: text }))
              }
            />

            <ThemedText style={styles.inputLabel}>Descripción</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Breve descripción de tu negocio"
              placeholderTextColor={theme.theme.textSecondary}
              value={newBusiness.description}
              onChangeText={(text) =>
                setNewBusiness((prev) => ({ ...prev, description: text }))
              }
              multiline
            />

            <ThemedText style={styles.inputLabel}>Tipo de negocio</ThemedText>
            <View style={styles.typeSelector}>
              {BUSINESS_TYPES.map((type) => (
                <Pressable
                  key={type.id}
                  style={[
                    styles.typeOption,
                    newBusiness.type === type.id && styles.typeOptionSelected,
                  ]}
                  onPress={() =>
                    setNewBusiness((prev) => ({ ...prev, type: type.id }))
                  }
                >
                  <Feather
                    name={type.icon as any}
                    size={16}
                    color={
                      newBusiness.type === type.id
                        ? ComeYaColors.primary
                        : theme.theme.text
                    }
                  />
                  <ThemedText style={styles.typeOptionText}>
                    {type.name}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText style={styles.inputLabel}>Dirección</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Dirección del negocio"
              placeholderTextColor={theme.theme.textSecondary}
              value={newBusiness.address}
              onChangeText={(text) =>
                setNewBusiness((prev) => ({ ...prev, address: text }))
              }
            />

            <ThemedText style={styles.inputLabel}>Teléfono</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Número de contacto"
              placeholderTextColor={theme.theme.textSecondary}
              value={newBusiness.phone}
              onChangeText={(text) =>
                setNewBusiness((prev) => ({ ...prev, phone: text }))
              }
              keyboardType="phone-pad"
            />

            <ThemedText style={styles.inputLabel}>
              Imagen del negocio
            </ThemedText>
            <Pressable
              style={styles.imagePickerButton}
              onPress={handlePickImage}
            >
              {newBusiness.image ? (
                <Image
                  source={{ uri: getImageUrl(newBusiness.image) }}
                  style={styles.selectedImage}
                  resizeMode="cover"
                />
              ) : (
                <>
                  <Feather
                    name="camera"
                    size={32}
                    color={theme.theme.textSecondary}
                  />
                  <ThemedText style={styles.imagePickerText}>
                    Toca para seleccionar imagen
                  </ThemedText>
                </>
              )}
            </Pressable>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}
              >
                <ThemedText
                  style={[styles.buttonText, { color: theme.theme.text }]}
                >
                  Cancelar
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleCreateBusiness}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={[styles.buttonText, { color: "#fff" }]}>
                    Crear Negocio
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={[styles.modalOverlay, { justifyContent: "center" }]}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteIcon}>
              <Feather
                name="alert-triangle"
                size={32}
                color={ComeYaColors.error}
              />
            </View>
            <ThemedText style={styles.modalTitle}>Eliminar Negocio</ThemedText>
            <ThemedText style={styles.deleteMessage}>
              Esta acción no se puede deshacer. Si el negocio tiene pedidos
              activos, no podrá ser eliminado.
            </ThemedText>

            <View style={[styles.modalButtons, { width: "100%" }]}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDeleteModal(false)}
              >
                <ThemedText
                  style={[styles.buttonText, { color: theme.theme.text }]}
                >
                  Cancelar
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.deleteButton]}
                onPress={handleDeleteBusiness}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={[styles.buttonText, { color: "#fff" }]}>
                    Eliminar
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Editar Negocio</ThemedText>

            <ThemedText style={styles.inputLabel}>Nombre *</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Nombre del negocio"
              placeholderTextColor={theme.theme.textSecondary}
              value={newBusiness.name}
              onChangeText={(text) =>
                setNewBusiness((prev) => ({ ...prev, name: text }))
              }
            />

            <ThemedText style={styles.inputLabel}>Descripción</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Breve descripción de tu negocio"
              placeholderTextColor={theme.theme.textSecondary}
              value={newBusiness.description}
              onChangeText={(text) =>
                setNewBusiness((prev) => ({ ...prev, description: text }))
              }
              multiline
            />

            <ThemedText style={styles.inputLabel}>Tipo de negocio</ThemedText>
            <View style={styles.typeSelector}>
              {BUSINESS_TYPES.map((type) => (
                <Pressable
                  key={type.id}
                  style={[
                    styles.typeOption,
                    newBusiness.type === type.id && styles.typeOptionSelected,
                  ]}
                  onPress={() =>
                    setNewBusiness((prev) => ({ ...prev, type: type.id }))
                  }
                >
                  <Feather
                    name={type.icon as any}
                    size={16}
                    color={
                      newBusiness.type === type.id
                        ? ComeYaColors.primary
                        : theme.theme.text
                    }
                  />
                  <ThemedText style={styles.typeOptionText}>
                    {type.name}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText style={styles.inputLabel}>Dirección</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Dirección del negocio"
              placeholderTextColor={theme.theme.textSecondary}
              value={newBusiness.address}
              onChangeText={(text) =>
                setNewBusiness((prev) => ({ ...prev, address: text }))
              }
            />

            <ThemedText style={styles.inputLabel}>Teléfono</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Número de contacto"
              placeholderTextColor={theme.theme.textSecondary}
              value={newBusiness.phone}
              onChangeText={(text) =>
                setNewBusiness((prev) => ({ ...prev, phone: text }))
              }
              keyboardType="phone-pad"
            />

            <ThemedText style={styles.inputLabel}>
              Imagen del negocio
            </ThemedText>
            <Pressable
              style={styles.imagePickerButton}
              onPress={handlePickImage}
            >
              {newBusiness.image ? (
                <Image
                  source={{ uri: getImageUrl(newBusiness.image) }}
                  style={styles.selectedImage}
                  resizeMode="cover"
                />
              ) : (
                <>
                  <Feather
                    name="camera"
                    size={32}
                    color={theme.theme.textSecondary}
                  />
                  <ThemedText style={styles.imagePickerText}>
                    Toca para seleccionar imagen
                  </ThemedText>
                </>
              )}
            </Pressable>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowEditModal(false)}
              >
                <ThemedText
                  style={[styles.buttonText, { color: theme.theme.text }]}
                >
                  Cancelar
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleEditBusiness}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={[styles.buttonText, { color: "#fff" }]}>
                    Guardar cambios
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
