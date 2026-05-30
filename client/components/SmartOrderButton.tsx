import React from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";

// Función local para evitar problemas de importación
const getButtonInfo = (status: string) => {
  switch (status) {
    case "pending":
      return {
        canProceed: false,
        message: "Esperando confirmación del negocio",
        nextAction: "El negocio debe aceptar el pedido",
        icon: "clock",
        color: "#6B7280",
        disabled: true,
        requiresBusinessAction: true,
      };
    case "ready":
      return {
        canProceed: true,
        message: "¡Listo para recoger!",
        nextAction: "Ve al negocio y recoge el pedido",
        icon: "package",
        color: "#3B82F6",
        disabled: false,
      };
    case "picked_up":
      return {
        canProceed: true,
        message: "Pedido recogido",
        nextAction: "Dirígete hacia el cliente",
        icon: "navigation",
        color: "#F59E0B",
        disabled: false,
      };
    case "on_the_way":
    case "in_transit":
      return {
        canProceed: true,
        message: "En camino al cliente",
        nextAction: "Entrega el pedido al cliente",
        icon: "check-circle",
        color: "#10B981",
        disabled: false,
      };
    case "delivered":
      return {
        canProceed: false,
        message: "Pedido entregado",
        nextAction: "Esperando confirmación del cliente",
        icon: "clock",
        color: "#10B981",
        disabled: true,
      };
    default:
      return {
        canProceed: false,
        message: "Esperando acción",
        nextAction: "El negocio debe procesar el pedido",
        icon: "clock",
        color: "#6B7280",
        disabled: true,
        requiresBusinessAction: true,
      };
  }
};

interface SmartOrderButtonProps {
  orderStatus: string;
  userRole?: string;
  onPress?: (canProceed: boolean, buttonInfo: any) => void;
  showStatusInfo?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

export const SmartOrderButton: React.FC<SmartOrderButtonProps> = ({
  orderStatus,
  userRole = "delivery_driver",
  onPress,
  showStatusInfo = true,
  disabled = false,
  loading = false,
}) => {
  const { theme } = useTheme();
  const buttonInfo = getButtonInfo(orderStatus);

  // Mapear colores del sistema a los colores del tema
  const getThemeColor = (color: string) => {
    switch (color) {
      case "#3B82F6":
        return ComeYaColors.primary;
      case "#F59E0B":
        return ComeYaColors.warning;
      case "#10B981":
        return ComeYaColors.success;
      case "#EF4444":
        return ComeYaColors.error;
      default:
        return theme.textSecondary;
    }
  };

  const themeColor = getThemeColor(buttonInfo.color);

  const handlePress = () => {
    if (disabled || loading) return;

    console.log(
      "SmartOrderButton pressed:",
      orderStatus,
      "canProceed:",
      buttonInfo.canProceed,
    );

    if (onPress) {
      onPress(buttonInfo.canProceed, buttonInfo);
    } else {
      // Comportamiento por defecto
      if (buttonInfo.canProceed) {
        Alert.alert(
          "Acción Disponible",
          `Puedes proceder: ${buttonInfo.nextAction}\n\nNota: Este botón no realiza acciones por ahora, solo muestra información.`,
          [{ text: "Entendido" }],
        );
      } else {
        Alert.alert(
          "Estado del Pedido",
          `${buttonInfo.message}\n\n${buttonInfo.nextAction}${buttonInfo.requiresBusinessAction ? "\n\n⚠️ Se requiere que el negocio tome acción primero." : ""}`,
          [{ text: "Entendido" }],
        );
      }
    }
  };

  const getActionButtonText = (status: string): string => {
    switch (status) {
      case "ready":
        return "Recogí el Pedido";
      case "picked_up":
        return "En Camino";
      case "on_the_way":
      case "in_transit":
        return "Marcar Entregado";
      default:
        return buttonInfo.canProceed ? "Continuar" : buttonInfo.message;
    }
  };

  return (
    <View>
      {/* Información inteligente del estado */}
      {showStatusInfo && (
        <View
          style={[
            styles.statusInfo,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <View style={styles.statusRow}>
            <Feather
              name={buttonInfo.icon as any}
              size={16}
              color={themeColor}
            />
            <ThemedText
              type="small"
              style={{
                color: themeColor,
                marginLeft: Spacing.xs,
                flex: 1,
                fontWeight: "600",
              }}
            >
              {buttonInfo.message}
            </ThemedText>
          </View>
          <ThemedText
            type="caption"
            style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
          >
            {buttonInfo.nextAction}
          </ThemedText>
          {buttonInfo.requiresBusinessAction && (
            <ThemedText
              type="caption"
              style={{
                color: ComeYaColors.warning,
                marginTop: Spacing.xs,
                fontStyle: "italic",
              }}
            >
              ⚠️ Requiere acción del negocio
            </ThemedText>
          )}
        </View>
      )}

      {/* Botón inteligente */}
      <Pressable
        onPress={handlePress}
        disabled={disabled || loading}
        style={[
          styles.actionButton,
          {
            backgroundColor:
              buttonInfo.disabled || disabled || loading
                ? theme.textSecondary
                : themeColor,
            opacity: buttonInfo.disabled || disabled || loading ? 0.6 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Feather name={buttonInfo.icon as any} size={18} color="#FFF" />
        )}
        <ThemedText
          type="body"
          style={{ color: "#FFF", marginLeft: Spacing.xs, fontWeight: "600" }}
        >
          {loading ? "Actualizando..." : getActionButtonText(orderStatus)}
        </ThemedText>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  statusInfo: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: ComeYaColors.primary,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
});
