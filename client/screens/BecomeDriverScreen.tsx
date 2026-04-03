import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { Spacing, BorderRadius, ComeYaColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type BecomeDriverNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const vehicleTypes = [
  { id: "bike", name: "Bicicleta", icon: "activity" },
  { id: "motorcycle", name: "Motocicleta", icon: "zap" },
  { id: "car", name: "Automóvil", icon: "truck" },
];

export default function BecomeDriverScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<BecomeDriverNavigationProp>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [vehicleType, setVehicleType] = useState<string>("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [inePhoto, setInePhoto] = useState<string | null>(null);
  const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(null);
  const [licensePhoto, setLicensePhoto] = useState<string | null>(null);
  const [bankClabe, setBankClabe] = useState("");
  const [bankName, setBankName] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickImage = async (type: 'profile' | 'ine' | 'vehicle' | 'license') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'profile' ? [1, 1] : [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      switch (type) {
        case 'profile': setProfilePhoto(uri); break;
        case 'ine': setInePhoto(uri); break;
        case 'vehicle': setVehiclePhoto(uri); break;
        case 'license': setLicensePhoto(uri); break;
      }
    }
  };

  const handleSubmit = async () => {
    if (!vehicleType) {
      showToast("Selecciona un tipo de vehículo", "error");
      return;
    }

    if (!vehiclePlate.trim()) {
      showToast("Ingresa las placas de tu vehículo", "error");
      return;
    }

    if (!profilePhoto) {
      showToast("Agrega tu foto de perfil", "error");
      return;
    }

    if (!inePhoto) {
      showToast("Agrega foto de tu INE", "error");
      return;
    }

    if (!vehiclePhoto) {
      showToast("Agrega foto de tu vehículo", "error");
      return;
    }

    if (!bankClabe.trim() || bankClabe.length !== 18) {
      showToast("Ingresa una CLABE válida (18 dígitos)", "error");
      return;
    }

    if (!emergencyContact.trim()) {
      showToast("Ingresa un contacto de emergencia", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/delivery/register", {
        userId: user?.id,
        vehicleType,
        vehiclePlate: vehiclePlate.toUpperCase(),
        profilePhoto,
        inePhoto,
        vehiclePhoto,
        licensePhoto,
        bankClabe,
        bankName,
        emergencyContact,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Solicitud enviada. Espera aprobación del admin", "success");
      navigation.goBack();
    } catch (error) {
      showToast("Error al enviar solicitud", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LinearGradient
      colors={[theme.gradientStart || '#FFFFFF', theme.gradientEnd || '#F5F5F5']}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Ser Repartidor</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <View
          style={[
            styles.infoCard,
            { backgroundColor: ComeYaColors.primary + "15" },
          ]}
        >
          <Feather name="truck" size={32} color={ComeYaColors.primary} />
          <ThemedText
            type="h3"
            style={{ marginTop: Spacing.md, color: ComeYaColors.primary }}
          >
            Gana dinero entregando
          </ThemedText>
          <ThemedText
            type="body"
            style={{ marginTop: Spacing.sm, textAlign: "center" }}
          >
            Trabaja cuando quieras y gana hasta $300 MXN al día
          </ThemedText>
        </View>

        <View
          style={[
            styles.benefitsCard,
            { backgroundColor: theme.card },
            Shadows.md,
          ]}
        >
          <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
            Beneficios
          </ThemedText>
          {[
            { icon: "dollar-sign", text: "15% de comisión por pedido" },
            { icon: "clock", text: "Horarios flexibles" },
            { icon: "trending-up", text: "Retiros inmediatos" },
            { icon: "shield", text: "Seguro incluido" },
          ].map((benefit, index) => (
            <View key={index} style={styles.benefitRow}>
              <View
                style={[
                  styles.benefitIcon,
                  { backgroundColor: ComeYaColors.primaryLight },
                ]}
              >
                <Feather
                  name={benefit.icon as any}
                  size={16}
                  color={ComeYaColors.primary}
                />
              </View>
              <ThemedText type="body">{benefit.text}</ThemedText>
            </View>
          ))}
        </View>

        <View
          style={[styles.formCard, { backgroundColor: theme.card }, Shadows.md]}
        >
          <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
            Información del vehículo
          </ThemedText>

          <ThemedText type="body" style={{ marginBottom: Spacing.sm }}>
            Tipo de vehículo
          </ThemedText>
          <View style={styles.vehicleTypes}>
            {vehicleTypes.map((type) => (
              <Pressable
                key={type.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setVehicleType(type.id);
                }}
                style={[
                  styles.vehicleType,
                  {
                    backgroundColor:
                      vehicleType === type.id
                        ? ComeYaColors.primary
                        : theme.backgroundSecondary,
                    borderColor:
                      vehicleType === type.id
                        ? ComeYaColors.primary
                        : theme.border,
                  },
                ]}
              >
                <Feather
                  name={type.icon as any}
                  size={24}
                  color={vehicleType === type.id ? "#FFFFFF" : theme.text}
                />
                <ThemedText
                  type="small"
                  style={{
                    color: vehicleType === type.id ? "#FFFFFF" : theme.text,
                    marginTop: Spacing.xs,
                  }}
                >
                  {type.name}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <ThemedText
            type="body"
            style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm }}
          >
            Placas del vehículo
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundSecondary,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="ABC-123"
            placeholderTextColor={theme.textSecondary}
            value={vehiclePlate}
            onChangeText={setVehiclePlate}
            autoCapitalize="characters"
            maxLength={10}
          />

          {/* Foto de Perfil */}
          <ThemedText type="body" style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
            Foto de perfil *
          </ThemedText>
          <Pressable
            onPress={() => pickImage('profile')}
            style={[styles.photoButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
          >
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={styles.photoPreview} />
            ) : (
              <>
                <Feather name="camera" size={24} color={theme.textSecondary} />
                <ThemedText type="small" style={{ marginTop: Spacing.xs, color: theme.textSecondary }}>
                  Toca para subir foto
                </ThemedText>
              </>
            )}
          </Pressable>

          {/* Foto INE */}
          <ThemedText type="body" style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
            Foto de INE (frontal) *
          </ThemedText>
          <Pressable
            onPress={() => pickImage('ine')}
            style={[styles.photoButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
          >
            {inePhoto ? (
              <Image source={{ uri: inePhoto }} style={styles.photoPreview} />
            ) : (
              <>
                <Feather name="credit-card" size={24} color={theme.textSecondary} />
                <ThemedText type="small" style={{ marginTop: Spacing.xs, color: theme.textSecondary }}>
                  Toca para subir INE
                </ThemedText>
              </>
            )}
          </Pressable>

          {/* Foto Vehículo */}
          <ThemedText type="body" style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
            Foto del vehículo (lateral) *
          </ThemedText>
          <Pressable
            onPress={() => pickImage('vehicle')}
            style={[styles.photoButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
          >
            {vehiclePhoto ? (
              <Image source={{ uri: vehiclePhoto }} style={styles.photoPreview} />
            ) : (
              <>
                <Feather name="truck" size={24} color={theme.textSecondary} />
                <ThemedText type="small" style={{ marginTop: Spacing.xs, color: theme.textSecondary }}>
                  Toca para subir foto
                </ThemedText>
              </>
            )}
          </Pressable>

          {/* Foto Licencia */}
          {vehicleType !== 'bike' && (
            <>
              <ThemedText type="body" style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
                Licencia de conducir
              </ThemedText>
              <Pressable
                onPress={() => pickImage('license')}
                style={[styles.photoButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
              >
                {licensePhoto ? (
                  <Image source={{ uri: licensePhoto }} style={styles.photoPreview} />
                ) : (
                  <>
                    <Feather name="file-text" size={24} color={theme.textSecondary} />
                    <ThemedText type="small" style={{ marginTop: Spacing.xs, color: theme.textSecondary }}>
                      Toca para subir licencia
                    </ThemedText>
                  </>
                )}
              </Pressable>
            </>
          )}

          {/* CLABE Bancaria */}
          <ThemedText type="body" style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
            CLABE interbancaria (18 dígitos) *
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundSecondary,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="012345678901234567"
            placeholderTextColor={theme.textSecondary}
            value={bankClabe}
            onChangeText={setBankClabe}
            keyboardType="numeric"
            maxLength={18}
          />

          {/* Banco */}
          <ThemedText type="body" style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
            Nombre del banco
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundSecondary,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="BBVA, Santander, etc."
            placeholderTextColor={theme.textSecondary}
            value={bankName}
            onChangeText={setBankName}
          />

          {/* Contacto de Emergencia */}
          <ThemedText type="body" style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
            Contacto de emergencia *
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundSecondary,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="Nombre y teléfono"
            placeholderTextColor={theme.textSecondary}
            value={emergencyContact}
            onChangeText={setEmergencyContact}
          />

          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={[
              styles.submitButton,
              {
                backgroundColor: ComeYaColors.primary,
                opacity: isSubmitting ? 0.6 : 1,
              },
            ]}
          >
            <ThemedText
              type="body"
              style={{ color: "#FFFFFF", fontWeight: "600" }}
            >
              {isSubmitting ? "Enviando..." : "Enviar solicitud"}
            </ThemedText>
          </Pressable>
        </View>

        <View
          style={[
            styles.requirementsCard,
            { backgroundColor: theme.card },
            Shadows.sm,
          ]}
        >
          <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
            Requisitos
          </ThemedText>
          {[
            "Mayor de 18 años",
            "Licencia de conducir vigente",
            "Vehículo en buen estado",
            "Smartphone con GPS",
          ].map((req, index) => (
            <View key={index} style={styles.requirementRow}>
              <Feather name="check-circle" size={16} color="#4CAF50" />
              <ThemedText type="small" style={{ marginLeft: Spacing.sm }}>
                {req}
              </ThemedText>
            </View>
          ))}
        </View>
      </ScrollView>
    </LinearGradient>
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
    paddingBottom: Spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  infoCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  benefitsCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  benefitIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  formCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  vehicleTypes: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  vehicleType: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    alignItems: "center",
  },
  input: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 16,
  },
  photoButton: {
    height: 120,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.md,
  },
  submitButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    marginTop: Spacing.xl,
  },
  requirementsCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
});
