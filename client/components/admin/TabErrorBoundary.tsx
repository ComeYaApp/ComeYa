// ErrorBoundary para las pestañas del panel admin: si un tab falla al
// renderizar (un dato inesperado, una fecha inválida…), se muestra el error
// en pantalla con botón de reintentar EN LUGAR DE CERRAR LA APP ENTERA.
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ComeYaColors, Spacing } from "../../constants/theme";

interface Props {
  tabName: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class TabErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: any): State {
    return {
      hasError: true,
      message: error?.message || String(error ?? "Error desconocido"),
    };
  }

  componentDidCatch(error: any) {
    console.error(`[Admin] Error renderizando el tab "${this.props.tabName}":`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={s.container}>
          <Feather name="alert-triangle" size={44} color={ComeYaColors.warning} />
          <Text style={s.title}>Esta sección no se pudo mostrar</Text>
          <Text style={s.message} numberOfLines={6}>
            {this.state.message}
          </Text>
          <TouchableOpacity
            style={s.retryBtn}
            onPress={() => this.setState({ hasError: false, message: "" })}
          >
            <Feather name="refresh-cw" size={16} color="#FFF" />
            <Text style={s.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  title: { fontSize: 16, fontWeight: "700", color: "#E60000", textAlign: "center" },
  message: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    maxWidth: 320,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: ComeYaColors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
  },
  retryText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});

export default TabErrorBoundary;
