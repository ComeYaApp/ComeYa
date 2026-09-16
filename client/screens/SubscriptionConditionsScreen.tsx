// Condiciones de las suscripciones de ComeYa (versión 2026).
// Documento profesional por plan: qué incluye, precio y facturación,
// renovación, permanencia, cancelación y condiciones generales.
// El administrador puede pedir ajustar los textos: están centralizados aquí.
import React, { useState } from "react";
import { ScrollView, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { ComeYaColors, Spacing, BorderRadius, Shadows } from "@/constants/theme";

type PlanKey = "soria_local" | "impulso_local" | "top_soria" | "premium_soria";

interface Section {
  title: string;
  items: string[];
}

const PLANS: Record<
  PlanKey,
  { name: string; emoji: string; price: string; cycle: string; audience: string; sections: Section[] }
> = {
  soria_local: {
    name: "Plan Soria Local (clientes)",
    emoji: "⭐",
    price: "4,99 €",
    cycle: "al mes",
    audience: "Para clientes de ComeYa",
    sections: [
      {
        title: "1. Qué incluye tu suscripción",
        items: [
          "4 envíos gratis al mes en pedidos de más de 15 €.",
          "50 % de descuento en el envío a partir del 5.º pedido del mes.",
          "Acceso anticipado a ofertas y promociones exclusivas.",
          "Soporte prioritario en el chat de la aplicación.",
        ],
      },
      {
        title: "2. Precio y facturación",
        items: [
          "El precio es de 4,99 € al mes, IVA incluido.",
          "El pago se realiza exclusivamente con tarjeta a través de Stripe (no se aceptan transferencias).",
          "La suscripción se renueva automáticamente cada mes hasta que la canceles.",
          "Los beneficios se aplican de forma automática en el momento de pagar el pedido.",
        ],
      },
      {
        title: "3. Permanencia y cancelación",
        items: [
          "Sin permanencia: puedes cancelar cuando quieras desde tu perfil.",
          "Si cancelas, conservas los beneficios hasta el final del período ya pagado.",
          "El importe del mes en curso no se reembolsa una vez aplicados beneficios.",
        ],
      },
    ],
  },
  impulso_local: {
    name: "Impulso Local Soria",
    emoji: "🚀",
    price: "29 €",
    cycle: "al mes",
    audience: "Para restaurantes y comercios de alimentación",
    sections: [
      {
        title: "1. Qué incluye tu suscripción",
        items: [
          "Comisión reducida del 10 % por pedido (frente al 15 % general).",
          "Ficha de negocio optimizada con datos, horarios y carta.",
          "Estadísticas básicas de ventas y pedidos.",
          "Soporte preferente por chat y teléfono.",
        ],
      },
      {
        title: "2. Precio y facturación",
        items: [
          "El precio es de 29 € al mes, IVA incluido.",
          "El pago se realiza exclusivamente con tarjeta a través de Stripe (no se aceptan transferencias ni comprobantes manuales).",
          "La suscripción se renueva automáticamente cada mes hasta que la canceles.",
          "La comisión reducida se aplica automáticamente desde el momento de la activación del pago.",
        ],
      },
      {
        title: "3. Permanencia y cancelación",
        items: [
          "Sin permanencia: puedes cancelar cuando quieras desde tu panel.",
          "Si cancelas, mantienes la comisión reducida hasta el final del período pagado.",
          "El administrador recibe un aviso de cada alta y cada baja.",
        ],
      },
    ],
  },
  top_soria: {
    name: "Top Soria",
    emoji: "🏆",
    price: "79 €",
    cycle: "al mes",
    audience: "Para negocios que quieren destacar",
    sections: [
      {
        title: "1. Qué incluye tu suscripción",
        items: [
          "Todo lo incluido en Impulso Local Soria (comisión del 10 %).",
          "Negocio destacado en el carrusel «Los Recomendados de Soria».",
          "Prioridad de asignación de repartidores en horas punta.",
          "Publicación de ofertas exclusivas para clientes.",
        ],
      },
      {
        title: "2. Precio y facturación",
        items: [
          "El precio es de 79 € al mes, IVA incluido.",
          "El pago se realiza exclusivamente con tarjeta a través de Stripe (no se aceptan transferencias).",
          "Renovación automática mensual hasta la cancelación.",
          "La condición de «destacado» se activa automáticamente al confirmarse el pago y se retira al expirar el plan.",
        ],
      },
      {
        title: "3. Permanencia y cancelación",
        items: [
          "Sin permanencia, con efectos hasta el final del período pagado.",
          "La destacación en el carrusel se retira automáticamente al expirar o cancelar el plan.",
        ],
      },
    ],
  },
  premium_soria: {
    name: "Premium Soria",
    emoji: "👑",
    price: "99 €",
    cycle: "al mes",
    audience: "El plan completo para negocios",
    sections: [
      {
        title: "1. Qué incluye tu suscripción",
        items: [
          "Todo lo incluido en Top Soria (destacado, prioridad y comisión del 10 %).",
          "Diseño y mejora de imágenes de hasta 5 platos al mes por nuestro equipo.",
          "Prioridad en eventos y campañas especiales de ComeYa en Soria.",
          "Soporte VIP con gestor personal asignado.",
        ],
      },
      {
        title: "2. Precio y facturación",
        items: [
          "El precio es de 99 € al mes, IVA incluido.",
          "El pago se realiza exclusivamente con tarjeta a través de Stripe (no se aceptan transferencias).",
          "Renovación automática mensual hasta la cancelación.",
          "Los servicios de diseño se acumulan mes a mes hasta un máximo de 5 imágenes; no son canjeables por dinero.",
        ],
      },
      {
        title: "3. Permanencia y cancelación",
        items: [
          "Sin permanencia, con efectos hasta el final del período pagado.",
          "La destacación y el gestor personal se retiran al expirar o cancelar el plan.",
        ],
      },
    ],
  },
};

const GENERAL_TERMS = [
  "ComeYa es una plataforma que conecta clientes con restaurantes, tiendas de alimentación y repartidores de Soria. Las suscripciones se prestan a través de la aplicación y la web de ComeYa.",
  "El pago de todas las suscripciones se realiza exclusivamente con tarjeta mediante Stripe. ComeYa no acepta transferencias ni comprobantes manuales para suscripciones.",
  "Al confirmarse el pago, las ventajas del plan se aplican automáticamente a tu cuenta y el administrador de la plataforma recibe un aviso del alta.",
  "ComeYa podrá modificar precios o beneficios comunicándolo con 30 días de antelación dentro de la aplicación. Si no aceptas los cambios, puedes cancelar antes de que entren en vigor.",
  "Las suscripciones son personales y no transmisibles. El uso abusivo de los beneficios (por ejemplo, pedidos ficticios para agotar envíos gratuitos) puede suponer la cancelación de la suscripción sin reembolso.",
  "Puedes ejercer tus derechos de acceso, rectificación y supresión escribiendo a privacidad@comeya.es (RGPD).",
  "Para cualquier duda sobre tu suscripción: soporte@comeya.es o el chat de ayuda de la aplicación.",
];

export default function SubscriptionConditionsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [plan, setPlan] = useState<PlanKey>("impulso_local");
  const current = PLANS[plan];

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">Condiciones 2026</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
      >
        {/* Selector de plan */}
        <View style={styles.planRow}>
          {(Object.keys(PLANS) as PlanKey[]).map((key) => (
            <Pressable
              key={key}
              onPress={() => setPlan(key)}
              style={[
                styles.planChip,
                {
                  backgroundColor:
                    plan === key ? ComeYaColors.primary : theme.backgroundSecondary,
                },
              ]}
            >
              <ThemedText
                type="caption"
                style={{
                  color: plan === key ? "#FFF" : theme.text,
                  fontWeight: "700",
                }}
              >
                {PLANS[key].emoji} {PLANS[key].name.split(" (")[0].replace("Plan ", "")}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {/* Cabecera del plan */}
        <View style={[styles.planCard, { backgroundColor: theme.card }, Shadows.sm]}>
          <ThemedText type="h3">
            {current.emoji} {current.name}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>
            {current.audience}
          </ThemedText>
          <View style={styles.priceRow}>
            <ThemedText type="h2" style={{ color: ComeYaColors.primary }}>
              {current.price}
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              {" "}
              {current.cycle}
            </ThemedText>
          </View>
        </View>

        {/* Secciones del plan */}
        {current.sections.map((section) => (
          <View key={section.title} style={[styles.section, { backgroundColor: theme.card }]}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>
              {section.title}
            </ThemedText>
            {section.items.map((item, i) => (
              <View key={i} style={styles.itemRow}>
                <Feather
                  name="check-circle"
                  size={14}
                  color={ComeYaColors.success}
                  style={{ marginTop: 3 }}
                />
                <ThemedText
                  type="small"
                  style={{ color: theme.text, flex: 1, marginLeft: Spacing.sm, lineHeight: 20 }}
                >
                  {item}
                </ThemedText>
              </View>
            ))}
          </View>
        ))}

        {/* Condiciones generales */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>
            Condiciones generales
          </ThemedText>
          {GENERAL_TERMS.map((item, i) => (
            <ThemedText
              key={i}
              type="small"
              style={{ color: theme.textSecondary, lineHeight: 20, marginBottom: Spacing.sm }}
            >
              {item}
            </ThemedText>
          ))}
        </View>

        <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "center" }}>
          Última actualización: 1 de enero de 2026 · © 2026 ComeYa
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: { padding: Spacing.xs },
  content: { padding: Spacing.lg },
  planRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.lg },
  planChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  planCard: { borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
  priceRow: { flexDirection: "row", alignItems: "baseline", marginTop: Spacing.sm },
  section: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  itemRow: { flexDirection: "row", marginBottom: Spacing.sm },
});
