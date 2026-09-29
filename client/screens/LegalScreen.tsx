import React from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";

type LegalScreenRouteProp = RouteProp<
  {
    Legal: { type: "terms" | "privacy" | "refund" };
  },
  "Legal"
>;

const legalContent = {
  terms: {
    title: "Términos y Condiciones",
    icon: "file-text" as const,
    sections: [
      {
        title: "1. Aceptación de Términos",
        content:
          "Al utilizar la aplicación ComeYa, aceptas estos términos y condiciones. ComeYa es un servicio de entrega de comida y productos de mercado en Soria, España.",
      },
      {
        title: "2. Uso del Servicio",
        content:
          "ComeYa proporciona una plataforma para conectar clientes con restaurantes, tiendas de alimentación y repartidores locales. Los usuarios deben tener al menos 18 años para utilizar el servicio.",
      },
      {
        title: "3. Pedidos y Pagos",
        content:
          "Los precios mostrados incluyen impuestos aplicables. Los cargos de entrega se calculan según la distancia. Aceptamos pagos con tarjeta de crédito/débito y efectivo.",
      },
      {
        title: "4. Cancelaciones",
        content:
          "Los pedidos pueden cancelarse antes de que el restaurante o mercado confirme la preparación. Una vez en preparación, no se permiten cancelaciones y no hay reembolsos.",
      },
      {
        title: "5. Responsabilidad",
        content:
          "ComeYa actúa como intermediario entre clientes y negocios. No somos responsables de la calidad de los productos o servicios proporcionados por terceros.",
      },
      {
        title: "6. Propiedad Intelectual",
        content:
          "El nombre ComeYa, logotipos y contenido de la aplicación son propiedad de ComeYa. Está prohibida su reproducción sin autorización.",
      },
    ],
  },
  privacy: {
    title: "Política de Privacidad",
    icon: "shield" as const,
    sections: [
      {
        title: "1. Información que Recopilamos",
        content:
          "Recopilamos información personal como nombre, teléfono, email, dirección de entrega y datos de pago para procesar tus pedidos.",
      },
      {
        title: "2. Uso de la Información",
        content:
          "Utilizamos tu información para procesar pedidos, enviar confirmaciones, mejorar nuestros servicios y enviarte promociones si has dado tu consentimiento.",
      },
      {
        title: "3. Ubicación",
        content:
          "Solicitamos acceso a tu ubicación para calcular rutas de entrega y mostrarte negocios cercanos. Esta información no se comparte con terceros.",
      },
      {
        title: "4. Seguridad de Datos",
        content:
          "Utilizamos encriptación SSL para proteger tus datos de pago. Tu información se almacena de forma segura y no se comparte sin tu consentimiento.",
      },
      {
        title: "5. Tus Derechos",
        content:
          "Puedes solicitar acceso, corrección o eliminación de tus datos personales contactando a soporte@comeya.es.",
      },
      {
        title: "6. Cookies y Análisis",
        content:
          "Utilizamos herramientas de análisis para mejorar la experiencia del usuario. Puedes desactivar las cookies en la configuración de tu dispositivo.",
      },
    ],
  },
  refund: {
    title: "Política de Reembolsos",
    icon: "refresh-cw" as const,
    sections: [
      {
        title: "1. Elegibilidad para Reembolso",
        content:
          "Puedes solicitar reembolso si: el pedido no llegó, llegó con artículos faltantes, los productos estaban en mal estado, o hubo un error en el cargo.",
      },
      {
        title: "2. Tiempo para Solicitar",
        content:
          "Los reembolsos deben solicitarse dentro de las 24 horas posteriores a la entrega del pedido. Después de este período, no se aceptan solicitudes.",
      },
      {
        title: "3. Proceso de Reembolso",
        content:
          "Contacta a soporte desde la app con tu número de pedido y descripción del problema. Incluye fotos si es posible. Responderemos en un plazo de 24-48 horas.",
      },
      {
        title: "4. Método de Reembolso",
        content:
          "Los reembolsos se procesan al mismo método de pago original. Para pagos con tarjeta, el reembolso puede tardar 5-10 días hábiles. Para efectivo, se ofrece crédito en la app.",
      },
      {
        title: "5. Cancelaciones",
        content:
          "Si cancelas antes de la confirmación del negocio, el reembolso es completo. Después de la confirmación, no hay reembolso ya que el negocio ha iniciado la preparación.",
      },
      {
        title: "6. Productos de Mercado",
        content:
          "Los productos pesados del mercado pueden tener variaciones de +/- 5% en peso. Esto no es motivo de reembolso. Solo aplica reembolso por productos en mal estado.",
      },
    ],
  },
};

export default function LegalScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<LegalScreenRouteProp>();
  const { theme } = useTheme();

  const { type } = route.params;
  const content = legalContent[type];

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Feather name={content.icon} size={20} color={ComeYaColors.primary} />
          <ThemedText type="h3" style={{ marginLeft: 8 }}>
            {content.title}
          </ThemedText>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
      >
        <View
          style={[
            styles.brandBadge,
            { backgroundColor: ComeYaColors.primary + "15" },
          ]}
        >
          <ThemedText
            type="body"
            style={{ color: ComeYaColors.primary, fontWeight: "600" }}
          >
            ComeYa - Soria
          </ThemedText>
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, marginTop: 4 }}
          >
            Ultima actualizacion: Enero 2026
          </ThemedText>
        </View>

        {content.sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <ThemedText
              type="h4"
              style={{ color: theme.text, marginBottom: Spacing.sm }}
            >
              {section.title}
            </ThemedText>
            <ThemedText
              type="body"
              style={{ color: theme.textSecondary, lineHeight: 22 }}
            >
              {section.content}
            </ThemedText>
          </View>
        ))}

        <View style={[styles.contactSection, { backgroundColor: theme.card }]}>
          <Feather name="mail" size={20} color={ComeYaColors.primary} />
          <View style={{ marginLeft: Spacing.md }}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              Preguntas?
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Contactanos: soporte@ComeYa.mx
            </ThemedText>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  brandBadge: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  contactSection: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
  },
});
