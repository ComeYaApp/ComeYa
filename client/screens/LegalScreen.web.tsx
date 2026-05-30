import React from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";
import { useResponsive } from "@/hooks/useResponsive";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";

const legalContent = {
  terms: {
    title: "Términos y Condiciones",
    icon: "file-text" as const,
    sections: [
      {
        title: "1. Aceptación de Términos",
        content:
          "Al utilizar la aplicación ComeYa, aceptas estos términos y condiciones. ComeYa es un servicio de delivery en Soria, España.",
      },
      {
        title: "2. Uso del Servicio",
        content:
          "ComeYa conecta clientes con restaurantes, mercados y repartidores locales. Los usuarios deben tener al menos 18 años.",
      },
      {
        title: "3. Pedidos y Pagos",
        content:
          "Los precios incluyen impuestos aplicables. Aceptamos Bizum, transferencia bancaria, tarjeta y efectivo.",
      },
      {
        title: "4. Cancelaciones",
        content:
          "Los pedidos pueden cancelarse antes de que el negocio confirme la preparación. Una vez en preparación, no se permiten cancelaciones.",
      },
      {
        title: "5. Responsabilidad",
        content:
          "ComeYa actúa como intermediario. No somos responsables de la calidad de productos o servicios de terceros.",
      },
      {
        title: "6. Propiedad Intelectual",
        content:
          "El nombre ComeYa, logotipos y contenido son propiedad de ComeYa. Prohibida su reproducción sin autorización.",
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
          "Recopilamos nombre, teléfono, email, dirección de entrega y datos de pago para procesar tus pedidos.",
      },
      {
        title: "2. Uso de la Información",
        content:
          "Utilizamos tu información para procesar pedidos, enviar confirmaciones, mejorar servicios y enviarte promociones con tu consentimiento.",
      },
      {
        title: "3. Ubicación",
        content:
          "Solicitamos acceso a tu ubicación para calcular rutas de entrega. Esta información no se comparte con terceros.",
      },
      {
        title: "4. Seguridad de Datos",
        content:
          "Utilizamos encriptación SSL para proteger tus datos. Tu información se almacena de forma segura.",
      },
      {
        title: "5. Tus Derechos (GDPR)",
        content:
          "Puedes solicitar acceso, corrección o eliminación de tus datos contactando a privacy@comeya.es.",
      },
      {
        title: "6. Cookies",
        content:
          "Utilizamos herramientas de análisis para mejorar la experiencia. Puedes gestionar cookies en la configuración.",
      },
    ],
  },
  refund: {
    title: "Política de Reembolsos",
    icon: "refresh-cw" as const,
    sections: [
      {
        title: "1. Elegibilidad",
        content:
          "Puedes solicitar reembolso si el pedido no llegó, llegó con artículos faltantes, productos en mal estado, o hubo error en el cargo.",
      },
      {
        title: "2. Tiempo para Solicitar",
        content:
          "Los reembolsos deben solicitarse dentro de las 24 horas posteriores a la entrega.",
      },
      {
        title: "3. Proceso",
        content:
          "Contacta a soporte desde la app con tu número de pedido. Responderemos en 24-48 horas.",
      },
      {
        title: "4. Método de Reembolso",
        content:
          "Los reembolsos se procesan al mismo método de pago original en 5-10 días hábiles.",
      },
      {
        title: "5. Cancelaciones",
        content:
          "Si cancelas antes de la confirmación del negocio, el reembolso es completo. Después, no hay reembolso.",
      },
      {
        title: "6. Productos de Mercado",
        content:
          "Los productos pesados pueden tener variaciones de ±5% en peso. Solo aplica reembolso por productos en mal estado.",
      },
    ],
  },
};

export default function LegalScreen() {
  const navigation = useNavigation();
  const route = useRoute() as any;
  const { theme, isDark } = useTheme();
  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";

  const { type } = route.params;
  const content = legalContent[type as keyof typeof legalContent];
  const { isMobile } = useResponsive();

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <MobileSidebarWrapper
        title="Legal"
        sidebarStyle={[
          s.sidebar,
          { backgroundColor: card, borderRightColor: border },
        ]}
      >
        <View
          style={[
            s.iconCircle,
            { backgroundColor: ComeYaColors.primary + "15" },
          ]}
        >
          <Feather name={content.icon} size={32} color={ComeYaColors.primary} />
        </View>
        <ThemedText
          type="h3"
          style={{ textAlign: "center", marginTop: Spacing.lg }}
        >
          {content.title}
        </ThemedText>
        <ThemedText
          type="caption"
          style={{
            color: theme.textSecondary,
            textAlign: "center",
            marginTop: Spacing.sm,
          }}
        >
          Última actualización: Enero 2026
        </ThemedText>
        <View
          style={[
            s.badge,
            {
              backgroundColor: ComeYaColors.primary + "15",
              marginTop: Spacing.xl,
            },
          ]}
        >
          <ThemedText
            type="small"
            style={{ color: ComeYaColors.primary, fontWeight: "600" }}
          >
            ComeYa · Soria, España
          </ThemedText>
        </View>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[s.backBtn, { backgroundColor: theme.backgroundSecondary }]}
        >
          <Feather name="arrow-left" size={18} color={theme.text} />
          <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
            Volver
          </ThemedText>
        </Pressable>
      </MobileSidebarWrapper>

      <ScrollView
        style={s.main}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {content.sections.map((section, i) => (
          <View
            key={i}
            style={[s.section, { backgroundColor: card, borderColor: border }]}
          >
            <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>
              {section.title}
            </ThemedText>
            <ThemedText
              type="body"
              style={{ color: theme.textSecondary, lineHeight: 24 }}
            >
              {section.content}
            </ThemedText>
          </View>
        ))}
        <View
          style={[s.footer, { backgroundColor: card, borderColor: border }]}
        >
          <Feather name="mail" size={20} color={ComeYaColors.primary} />
          <View style={{ marginLeft: Spacing.md }}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              ¿Preguntas?
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              soporte@comeya.es
            </ThemedText>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  sidebar: {
    width: 280,
    minWidth: 280,
    maxWidth: 280,
    padding: 32,
    borderRightWidth: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 48,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 32,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  main: { flex: 1 },
  content: { padding: 40, maxWidth: 800 },
  section: { padding: 24, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
  },
});
