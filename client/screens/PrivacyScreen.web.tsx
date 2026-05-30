import React from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, ComeYaColors } from "@/constants/theme";
import { useResponsive } from "@/hooks/useResponsive";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";

export default function PrivacyScreen() {
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const { isMobile } = useResponsive();

  const sections = [
    {
      title: "1. Responsable del Tratamiento",
      body: "ComeYa es el responsable del tratamiento de sus datos personales. Email: privacy@comeya.es · DPO: dpo@comeya.es · Dirección: Soria, España.",
    },
    {
      title: "2. Información que Recopilamos",
      body: "Datos de registro: nombre, teléfono (verificado por OTP), email y contraseña (hash bcrypt). Datos de uso: historial de pedidos, favoritos, reseñas. Datos de ubicación (solo repartidores durante entregas activas). Datos de pago procesados por Stripe (PCI-DSS Level 1).",
    },
    {
      title: "3. Base Legal y Finalidad",
      body: "Procesamos sus datos para: ejecución del contrato (procesar pedidos), obligación legal (cumplimiento fiscal), consentimiento (marketing) e interés legítimo (prevención de fraude y mejora del servicio).",
    },
    {
      title: "4. Cómo Usamos su Información",
      body: "Procesamos pedidos, coordinamos entregas, gestionamos pagos, proporcionamos seguimiento GPS, enviamos notificaciones, verificamos identidad, prevenimos fraude y mejoramos nuestros servicios.",
    },
    {
      title: "5. Compartir con Terceros",
      body: "Durante un pedido activo compartimos información limitada entre cliente, negocio y repartidor. Proveedores: Stripe (pagos), Twilio (SMS), Google Maps (geolocalización). Nunca vendemos sus datos.",
    },
    {
      title: "6. Seguridad de Datos",
      body: "Implementamos TLS/SSL para comunicaciones, AES-256 para datos en reposo, bcrypt para contraseñas, 2FA vía SMS, firewalls, backups diarios encriptados y monitoreo 24/7.",
    },
    {
      title: "7. Sus Derechos (GDPR)",
      body: "Tiene derecho de acceso, rectificación, supresión, limitación, portabilidad, oposición y retirada de consentimiento. Para ejercerlos: privacy@comeya.es. Respuesta garantizada en 30 días.",
    },
    {
      title: "8. Retención de Datos",
      body: "Cuenta activa: mientras esté activa. Historial de pedidos: 7 años (requisito fiscal). Ubicación GPS: 30 días. Comunicaciones de soporte: 2 años. Logs de seguridad: 12 meses.",
    },
    {
      title: "9. Privacidad de Menores",
      body: "ComeYa no está dirigido a menores de 18 años. Si descubrimos datos de menores, los eliminaremos inmediatamente. Contacto: privacy@comeya.es.",
    },
    {
      title: "10. Autoridad de Supervisión",
      body: "Puede presentar reclamaciones ante la Agencia Española de Protección de Datos (AEPD): C/ Jorge Juan, 6, 28001 Madrid · www.aepd.es.",
    },
  ];

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <MobileSidebarWrapper
        title="Privacidad"
        sidebarStyle={[
          s.sidebar,
          { backgroundColor: card, borderRightColor: border },
        ]}
      >
        <View
          style={[
            s.iconCircle,
            { backgroundColor: ComeYaColors.success + "15" },
          ]}
        >
          <Feather name="shield" size={32} color={ComeYaColors.success} />
        </View>
        <ThemedText
          type="h3"
          style={{ textAlign: "center", marginTop: Spacing.lg }}
        >
          Política de Privacidad
        </ThemedText>
        <View
          style={[
            s.badge,
            {
              backgroundColor: ComeYaColors.success + "15",
              marginTop: Spacing.lg,
            },
          ]}
        >
          <Feather name="check-circle" size={14} color={ComeYaColors.success} />
          <ThemedText
            type="small"
            style={{
              color: ComeYaColors.success,
              fontWeight: "600",
              marginLeft: 6,
            }}
          >
            Cumple GDPR
          </ThemedText>
        </View>
        <View
          style={[
            s.contactCard,
            {
              backgroundColor: theme.backgroundSecondary,
              marginTop: Spacing.xl,
            },
          ]}
        >
          <ThemedText
            type="caption"
            style={{
              color: theme.textSecondary,
              fontWeight: "600",
              marginBottom: 8,
            }}
          >
            Contacto Privacidad
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            privacy@comeya.es
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            dpo@comeya.es
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
        <View
          style={[
            s.heroBadge,
            { backgroundColor: ComeYaColors.success + "15" },
          ]}
        >
          <Feather name="shield" size={16} color={ComeYaColors.success} />
          <ThemedText
            type="small"
            style={{
              color: ComeYaColors.success,
              fontWeight: "600",
              marginLeft: 8,
            }}
          >
            Última actualización: 1 de Enero de 2026
          </ThemedText>
        </View>
        <ThemedText
          type="body"
          style={{
            color: theme.textSecondary,
            lineHeight: 26,
            marginBottom: 32,
          }}
        >
          En ComeYa, la protección de su privacidad es nuestra máxima prioridad.
          Esta política describe cómo recopilamos, usamos y protegemos su
          información de conformidad con el GDPR y las leyes españolas
          aplicables.
        </ThemedText>
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
            Su privacidad es nuestra prioridad · Cumplimos con GDPR y leyes
            españolas de protección de datos
          </ThemedText>
          <ThemedText
            type="caption"
            style={{
              color: theme.textSecondary,
              textAlign: "center",
              marginTop: 8,
            }}
          >
            © 2026 ComeYa · Soria, España
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "center",
  },
  contactCard: { padding: 16, borderRadius: 12, width: "100%" },
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
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 24,
  },
  section: { marginBottom: 32 },
  footer: { padding: 24, borderRadius: 16, borderWidth: 1, marginTop: 16 },
});
