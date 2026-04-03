import React from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, ComeYaColors } from '@/constants/theme';

export default function TermsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <ThemedText type="h4" style={styles.sectionTitle}>{title}</ThemedText>
      {children}
    </View>
  );

  const Paragraph = ({ children }: { children: React.ReactNode }) => (
    <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
      {children}
    </ThemedText>
  );

  const BulletPoint = ({ children }: { children: string }) => (
    <View style={styles.bulletContainer}>
      <View style={[styles.bullet, { backgroundColor: ComeYaColors.primary }]} />
      <ThemedText type="body" style={[styles.bulletText, { color: theme.textSecondary }]}>
        {children}
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">Términos y Condiciones</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={[styles.badge, { backgroundColor: ComeYaColors.primary + '20' }]}>
          <ThemedText type="small" style={{ color: ComeYaColors.primary, fontWeight: '600' }}>
            Última actualización: Febrero 2025
          </ThemedText>
        </View>

        <Section title="1. Aceptación de los Términos">
          <Paragraph>
            Al acceder y utilizar ComeYa, usted acepta estar legalmente vinculado por estos Términos y Condiciones. 
            ComeYa es una plataforma tecnológica que conecta usuarios, negocios locales y repartidores en San Cristóbal, Táchira, Venezuela.
          </Paragraph>
        </Section>

        <Section title="2. Servicios de la Plataforma">
          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Para Usuarios/Clientes:
          </ThemedText>
          <BulletPoint>Explorar negocios y productos locales</BulletPoint>
          <BulletPoint>Realizar pedidos con entrega a domicilio</BulletPoint>
          <BulletPoint>Seguimiento en tiempo real</BulletPoint>
          <BulletPoint>Sistema de calificaciones y reseñas</BulletPoint>

          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Para Negocios:
          </ThemedText>
          <BulletPoint>Panel de gestión de productos</BulletPoint>
          <BulletPoint>Control de inventario</BulletPoint>
          <BulletPoint>Estadísticas de ventas</BulletPoint>
          <BulletPoint>Comisión: markup 15% solo sobre productos (el negocio recibe 100% del precio base)</BulletPoint>

          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Para Repartidores:
          </ThemedText>
          <BulletPoint>Aceptar/rechazar pedidos libremente</BulletPoint>
          <BulletPoint>Navegación GPS integrada</BulletPoint>
          <BulletPoint>Ganancias: 100% de la tarifa de entrega</BulletPoint>
          <BulletPoint>Retiros via Stripe Connect</BulletPoint>
        </Section>

        <Section title="3. Sistema de Pagos y Comisiones">
          <Paragraph>
            Por cada pedido, la distribución es:
          </Paragraph>
          <BulletPoint>Negocio: 100% del precio base de productos</BulletPoint>
          <BulletPoint>Repartidor: 100% de la tarifa de entrega</BulletPoint>
          <BulletPoint>ComeYa: 15% de markup sobre productos</BulletPoint>
          <Paragraph>
            Los pagos se procesan de forma segura mediante Stripe. Fondos disponibles después de entrega confirmada.
          </Paragraph>
        </Section>

        <Section title="4. Cancelaciones y Reembolsos">
          <BulletPoint>Antes de aceptación: Reembolso 100%</BulletPoint>
          <BulletPoint>Después de aceptación: Cargo del 20%</BulletPoint>
          <BulletPoint>Durante preparación: Cargo del 50%</BulletPoint>
          <BulletPoint>Pedido listo/recogido: Sin reembolso</BulletPoint>
        </Section>

        <Section title="5. Calificaciones y Reseñas">
          <Paragraph>
            Sistema de 1 a 5 estrellas. No se permiten reseñas con contenido ofensivo, discriminatorio, 
            falso o que contenga información personal. ComeYa se reserva el derecho de eliminar reseñas inapropiadas.
          </Paragraph>
        </Section>

        <Section title="6. Privacidad y Datos">
          <Paragraph>
            Recopilamos información necesaria para operar el servicio: nombre, teléfono, ubicación (durante uso), 
            historial de pedidos. Ver Política de Privacidad completa para más detalles.
          </Paragraph>
        </Section>

        <Section title="7. Limitación de Responsabilidad">
          <Paragraph>
            ComeYa es una plataforma tecnológica intermediaria. No somos responsables de la calidad de productos 
            o acciones de negocios y repartidores. El servicio se proporciona "tal cual" sin garantías de 
            disponibilidad ininterrumpida.
          </Paragraph>
        </Section>

        <Section title="8. Conducta Prohibida">
          <Paragraph>
            Está prohibido: usar la plataforma para actividades ilegales, manipular calificaciones, 
            realizar pedidos fraudulentos, acosar a otros usuarios. Consecuencia: suspensión permanente.
          </Paragraph>
        </Section>

        <Section title="9. Modificaciones">
          <Paragraph>
            ComeYa puede modificar estos términos en cualquier momento. Los cambios serán notificados 
            mediante la app y email. El uso continuado constituye aceptación.
          </Paragraph>
        </Section>

        <Section title="10. Contacto">
          <Paragraph>
            Email: support@ComeYa.app{'\n'}
            Ubicación: San Cristóbal, Táchira, Venezuela, Venezuela{'\n'}
            Soporte disponible en la app
          </Paragraph>
        </Section>

        <View style={[styles.footer, { backgroundColor: theme.card }]}>
          <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: 'center' }}>
            Del náhuatl "vivir" - Conectando negocios locales con la comunidad
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.xs }}>
            © 2025 ComeYa. Todos los derechos reservados.
          </ThemedText>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    padding: Spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    fontWeight: '700',
  },
  subsectionTitle: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  paragraph: {
    lineHeight: 24,
    marginBottom: Spacing.md,
  },
  bulletContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
    paddingLeft: Spacing.md,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    marginRight: Spacing.sm,
  },
  bulletText: {
    flex: 1,
    lineHeight: 22,
  },
  footer: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
});
