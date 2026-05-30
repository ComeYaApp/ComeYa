// TermsScreen.web.tsx — re-usa el componente nativo con wrapper de layout web
import React from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";
import { useResponsive } from "@/hooks/useResponsive";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";

export default function TermsScreen() {
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const { isMobile } = useResponsive();

  const sections = [
    {
      title: "1. Aceptación de los Términos",
      body: "Al descargar, instalar, registrarse o utilizar la aplicación ComeYa, usted acepta expresamente estar legalmente vinculado por estos Términos, nuestra Política de Privacidad y todas las políticas aplicables. ComeYa es una plataforma tecnológica que actúa como intermediario entre usuarios finales, establecimientos comerciales y repartidores independientes en Soria, España.",
    },
    {
      title: "2. Elegibilidad y Registro",
      body: "Para utilizar ComeYa debe tener al menos 18 años, proporcionar información veraz durante el registro, mantener la seguridad de su cuenta y notificarnos de cualquier uso no autorizado. Nos reservamos el derecho de suspender cuentas que violen estos términos.",
    },
    {
      title: "3. Descripción de Servicios",
      body: "ComeYa facilita la conexión entre clientes, establecimientos comerciales y repartidores independientes. Ofrecemos exploración de catálogos, realización de pedidos, seguimiento GPS en tiempo real, sistema de calificaciones y soporte al cliente integrado.",
    },
    {
      title: "4. Precios y Comisiones",
      body: "Todos los precios incluyen IVA. La comisión de plataforma es del 15% sobre el precio base de productos. La tarifa de entrega se calcula dinámicamente según distancia y demanda. Las propinas son 100% para el repartidor.",
    },
    {
      title: "5. Pedidos, Cancelaciones y Reembolsos",
      body: "Cancelaciones antes de aceptación: reembolso del 100%. Después de aceptación: cargo del 20%. Durante preparación: cargo del 50%. Pedido en tránsito: no reembolsable. Los reembolsos se procesan en 5-10 días hábiles.",
    },
    {
      title: "6. Propiedad Intelectual",
      body: "Todos los derechos sobre la plataforma ComeYa, incluyendo software, diseño, logotipos y tecnología, son propiedad exclusiva de ComeYa. Se otorga una licencia limitada para uso personal y no comercial.",
    },
    {
      title: "7. Actividades Prohibidas",
      body: "Queda prohibido usar la plataforma para actividades ilegales, crear múltiples cuentas, manipular calificaciones, acosar a otros usuarios, realizar pedidos sin intención de pago, o usar bots y herramientas automatizadas.",
    },
    {
      title: "8. Limitación de Responsabilidad",
      body: "ComeYa actúa únicamente como intermediario tecnológico. No somos responsables de la calidad de productos, tiempos de entrega exactos, ni acciones de negocios o repartidores. Nuestra responsabilidad máxima no excederá el monto del pedido en cuestión o €100.",
    },
    {
      title: "9. Resolución de Disputas",
      body: "Las disputas se resolverán bajo jurisdicción exclusiva de los tribunales de Soria, España, aplicando leyes españolas y europeas (GDPR, Ley de Protección de Datos).",
    },
    {
      title: "10. Contacto",
      body: "Para preguntas sobre estos Términos: legal@comeya.es · support@comeya.es · Soria, España · Lunes a Viernes, 9:00 - 18:00 CET",
    },
  ];

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <MobileSidebarWrapper
        title="Terminos"
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
          <Feather name="file-text" size={32} color={ComeYaColors.primary} />
        </View>
        <ThemedText
          type="h3"
          style={{ textAlign: "center", marginTop: Spacing.lg }}
        >
          Términos y Condiciones
        </ThemedText>
        <View
          style={[
            s.badge,
            {
              backgroundColor: ComeYaColors.primary + "15",
              marginTop: Spacing.lg,
            },
          ]}
        >
          <ThemedText
            type="small"
            style={{ color: ComeYaColors.primary, fontWeight: "600" }}
          >
            Enero 2026
          </ThemedText>
        </View>
        <View style={[s.toc, { borderColor: border }]}>
          {sections.map((s2, i) => (
            <ThemedText
              key={i}
              type="caption"
              style={{ color: theme.textSecondary, marginBottom: 6 }}
            >
              {s2.title}
            </ThemedText>
          ))}
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
        <View
          style={[s.badge2, { backgroundColor: ComeYaColors.primary + "15" }]}
        >
          <ThemedText
            type="small"
            style={{ color: ComeYaColors.primary, fontWeight: "600" }}
          >
            Última actualización: 1 de Enero de 2026
          </ThemedText>
        </View>
        {sections.map((sec, i) => (
          <View key={i} style={s.section}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>
              {sec.title}
            </ThemedText>
            <ThemedText
              type="body"
              style={{ color: theme.textSecondary, lineHeight: 26 }}
            >
              {sec.body}
            </ThemedText>
          </View>
        ))}
        <View
          style={[s.footer, { backgroundColor: card, borderColor: border }]}
        >
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, textAlign: "center" }}
          >
            Al usar ComeYa, aceptas estos Términos y nuestra Política de
            Privacidad
          </ThemedText>
          <ThemedText
            type="caption"
            style={{
              color: theme.textSecondary,
              textAlign: "center",
              marginTop: 8,
            }}
          >
            © 2026 ComeYa · Soria, España · Todos los derechos reservados
          </ThemedText>
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
    padding: 28,
    borderRightWidth: 1,
    paddingTop: 48,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "center",
  },
  toc: { marginTop: 24, borderTopWidth: 1, paddingTop: 16 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  main: { flex: 1 },
  content: { padding: 48, maxWidth: 760 },
  badge2: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 32,
  },
  section: { marginBottom: 32 },
  footer: { padding: 24, borderRadius: 16, borderWidth: 1, marginTop: 16 },
});
