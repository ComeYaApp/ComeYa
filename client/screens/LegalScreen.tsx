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
    title: "Terminos y Condiciones",
    icon: "file-text" as const,
    sections: [
      {
        title: "1. Aceptacion de Terminos",
        content:
          "Al utilizar la aplicacion ComeYa, aceptas estos terminos y condiciones. ComeYa es un servicio de entrega de comida y productos de mercado en Autlan de Navarro, Venezuela, Venezuela.",
      },
      {
        title: "2. Uso del Servicio",
        content:
          "ComeYa proporciona una plataforma para conectar clientes con restaurantes, mercados y repartidores locales. Los usuarios deben tener al menos 18 anos para utilizar el servicio.",
      },
      {
        title: "3. Pedidos y Pagos",
        content:
          "Los precios mostrados incluyen impuestos aplicables. Los cargos de entrega se calculan segun la distancia. Aceptamos pagos con tarjeta de credito/debito y efectivo.",
      },
      {
        title: "4. Cancelaciones",
        content:
          "Los pedidos pueden cancelarse antes de que el restaurante o mercado confirme la preparacion. Una vez en preparacion, no se permiten cancelaciones y no hay reembolsos.",
      },
      {
        title: "5. Responsabilidad",
        content:
          "ComeYa actua como intermediario entre clientes y negocios. No somos responsables de la calidad de los productos o servicios proporcionados por terceros.",
      },
      {
        title: "6. Propiedad Intelectual",
        content:
          "El nombre ComeYa, logotipos y contenido de la aplicacion son propiedad de ComeYa. Esta prohibida su reproduccion sin autorizacion.",
      },
    ],
  },
  privacy: {
    title: "Politica de Privacidad",
    icon: "shield" as const,
    sections: [
      {
        title: "1. Informacion que Recopilamos",
        content:
          "Recopilamos informacion personal como nombre, telefono, email, direccion de entrega y datos de pago para procesar tus pedidos.",
      },
      {
        title: "2. Uso de la Informacion",
        content:
          "Utilizamos tu informacion para procesar pedidos, enviar confirmaciones, mejorar nuestros servicios y enviarte promociones si has dado tu consentimiento.",
      },
      {
        title: "3. Ubicacion",
        content:
          "Solicitamos acceso a tu ubicacion para calcular rutas de entrega y mostrarte negocios cercanos. Esta informacion no se comparte con terceros.",
      },
      {
        title: "4. Seguridad de Datos",
        content:
          "Utilizamos encriptacion SSL para proteger tus datos de pago. Tu informacion se almacena de forma segura y no se comparte sin tu consentimiento.",
      },
      {
        title: "5. Tus Derechos",
        content:
          "Puedes solicitar acceso, correccion o eliminacion de tus datos personales contactando a soporte@ComeYa.mx.",
      },
      {
        title: "6. Cookies y Analisis",
        content:
          "Utilizamos herramientas de analisis para mejorar la experiencia del usuario. Puedes desactivar las cookies en la configuracion de tu dispositivo.",
      },
    ],
  },
  refund: {
    title: "Politica de Reembolsos",
    icon: "refresh-cw" as const,
    sections: [
      {
        title: "1. Elegibilidad para Reembolso",
        content:
          "Puedes solicitar reembolso si: el pedido no llego, llego con articulos faltantes, los productos estaban en mal estado, o hubo un error en el cargo.",
      },
      {
        title: "2. Tiempo para Solicitar",
        content:
          "Los reembolsos deben solicitarse dentro de las 24 horas posteriores a la entrega del pedido. Despues de este periodo, no se aceptan solicitudes.",
      },
      {
        title: "3. Proceso de Reembolso",
        content:
          "Contacta a soporte desde la app con tu numero de pedido y descripcion del problema. Incluye fotos si es posible. Responderemos en un plazo de 24-48 horas.",
      },
      {
        title: "4. Metodo de Reembolso",
        content:
          "Los reembolsos se procesan al mismo metodo de pago original. Para pagos con tarjeta, el reembolso puede tardar 5-10 dias habiles. Para efectivo, se ofrece credito en la app.",
      },
      {
        title: "5. Cancelaciones",
        content:
          "Si cancelas antes de la confirmacion del negocio, el reembolso es completo. Despues de la confirmacion, no hay reembolso ya que el negocio ha iniciado la preparacion.",
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
            ComeYa - Autlan de Navarro
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
