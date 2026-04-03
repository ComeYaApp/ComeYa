import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

function resolveProfileImageUrl(profileImage: string): string {
  // Base64 — no necesita resolución
  if (profileImage.startsWith('data:image/')) return profileImage;

  const apiBase = getApiUrl().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(profileImage)) {
    try {
      const source = new URL(profileImage);
      if (source.hostname === "localhost" || source.hostname === "127.0.0.1") {
        const target = new URL(apiBase);
        source.protocol = target.protocol;
        source.host = target.host;
        return source.toString();
      }
    } catch {
      return profileImage;
    }
    return profileImage;
  }
  return `${apiBase}${profileImage.startsWith("/") ? "" : "/"}${profileImage}`;
}

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string }>({});

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "Editar perfil",
    });
  }, [navigation]);

  const validateForm = () => {
    const newErrors: { name?: string; phone?: string; email?: string } = {};

    if (!name.trim()) {
      newErrors.name = "El nombre es requerido";
    } else if (name.trim().length < 2) {
      newErrors.name = "El nombre debe tener al menos 2 caracteres";
    }

    if (!phone.trim()) {
      newErrors.phone = "El teléfono es requerido";
    } else if (phone.trim().length < 10) {
      newErrors.phone = "Ingresa un número de teléfono válido";
    }

    if (email.trim() && !email.includes("@")) {
      newErrors.email = "Ingresa un correo válido";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !user?.id) return;

    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await apiRequest("PUT", "/api/users/profile", {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
      });

      const data = await response.json();

      if (data.success) {
        await updateUser({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast("Perfil actualizado correctamente", "success");
        navigation.goBack();
      } else {
        throw new Error(data.error || "Error al actualizar perfil");
      }
    } catch (error: any) {
      console.error("Error updating profile:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(error.message || "No se pudo actualizar el perfil", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showToast('Se necesita permiso para acceder a las fotos', 'error');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error: any) {
      showToast('Error al seleccionar imagen', 'error');
    }
  };

  const uploadImage = async (uri: string) => {
    setIsUploadingImage(true);
    try {
      // React Native: convertir URI a base64 directamente
      const base64 = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(xhr.response);
        };
        xhr.onerror = reject;
        xhr.responseType = 'blob';
        xhr.open('GET', uri);
        xhr.send();
      });

      const apiResponse = await apiRequest('POST', '/api/user/profile-image', {
        image: base64,
      });

      const data = await apiResponse.json();
      if (data.success) {
        await updateUser({ profileImage: data.profileImage });
        showToast('Foto actualizada', 'success');
      } else {
        throw new Error(data.error || 'Error al subir imagen');
      }
    } catch (error: any) {
      showToast('Error al subir imagen', 'error');
    } finally {
      setIsUploadingImage(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.avatarSection,
            { backgroundColor: theme.card },
            Shadows.md,
          ]}
        >
          <Pressable onPress={handlePickImage} disabled={isUploadingImage}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: ComeYaColors.primary + "20" },
              ]}
            >
              {isUploadingImage ? (
                <ActivityIndicator size="large" color={ComeYaColors.primary} />
              ) : user?.profileImage ? (
                <Image
                  source={{ uri: resolveProfileImageUrl(user.profileImage) }}
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <Feather name="user" size={40} color={ComeYaColors.primary} />
              )}
            </View>
            <View style={[styles.cameraButton, { backgroundColor: ComeYaColors.primary }]}>
              <Feather name="camera" size={16} color="#fff" />
            </View>
          </Pressable>
          <ThemedText
            type="caption"
            style={{ color: theme.textSecondary, marginTop: Spacing.sm }}
          >
            Toca para cambiar foto
          </ThemedText>
        </View>

        <View
          style={[
            styles.formSection,
            { backgroundColor: theme.card },
            Shadows.sm,
          ]}
        >
          <Input
            label="Nombre completo"
            leftIcon="user"
            value={name}
            onChangeText={setName}
            error={errors.name}
            placeholder="Tu nombre"
            autoCapitalize="words"
            autoCorrect={false}
          />

          <Input
            label="Teléfono"
            leftIcon="phone"
            value={phone}
            onChangeText={setPhone}
            error={errors.phone}
            placeholder="+58 xxx xxx xxxx"
            keyboardType="phone-pad"
            autoCorrect={false}
          />

          <Input
            label="Correo electrónico (opcional)"
            leftIcon="mail"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            placeholder="tucorreo@ejemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View
          style={[
            styles.infoBox,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <Feather name="info" size={20} color={ComeYaColors.primary} />
          <ThemedText
            type="caption"
            style={{
              flex: 1,
              color: theme.textSecondary,
              marginLeft: Spacing.sm,
            }}
          >
            El teléfono es tu identificador principal. El correo es opcional
            para recibir recibos y notificaciones.
          </ThemedText>
        </View>
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
        <Button
          onPress={handleSave}
          disabled={isSaving}
          loading={isSaving}
          style={styles.saveButton}
        >
          Guardar cambios
        </Button>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  avatarSection: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  cameraButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  formSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  emailContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  verifiedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  saveButton: {
    width: "100%",
  },
});
