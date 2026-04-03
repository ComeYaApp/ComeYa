import React from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, ComeYaColors } from '@/constants/theme';

export default function PrivacyScreen() {
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

  const InfoBox = ({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) => (
    <View style={[styles.infoBox, { backgroundColor: ComeYaColors.primary + '10' }]}>
      <View style={styles.infoHeader}>
        <Feather name={icon as any} size={20} color={ComeYaColors.primary} />
        <ThemedText type="body" style={[styles.infoTitle, { color: ComeYaColors.primary }]}>
          {title}
        </ThemedText>
      </View>
      {children}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">Política de Privacidad</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={[styles.badge, { backgroundColor: ComeYaColors.success + '20' }]}>
          <Feather name="shield" size={16} color={ComeYaColors.success} />
          <ThemedText type="small" style={{ color: ComeYaColors.success, fontWeight: '600', marginLeft: Spacing.xs }}>
            Última actualización: Febrero 2025
          </ThemedText>
        </View>

        <Section title="Nuestro Compromiso">
          <Paragraph>
            En ComeYa nos comprometemos a proteger su privacidad y datos personales. Esta política explica 
            cómo recopilamos, usamos y protegemos su información.
          </Paragraph>
        </Section>

        <Section title="Información que Recopilamos">
          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Al Registrarse:
          </ThemedText>
          <BulletPoint>Nombre completo</BulletPoint>
          <BulletPoint>Número de teléfono (verificado por SMS)</BulletPoint>
          <BulletPoint>Correo electrónico</BulletPoint>
          <BulletPoint>Contraseña (encriptada)</BulletPoint>

          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Durante el Uso:
          </ThemedText>
          <BulletPoint>Direcciones de entrega</BulletPoint>
          <BulletPoint>Información de pago (procesada por Stripe)</BulletPoint>
          <BulletPoint>Historial de pedidos</BulletPoint>
          <BulletPoint>Ubicación GPS (solo repartidores durante entregas)</BulletPoint>
        </Section>

        <Section title="Cómo Usamos su Información">
          <BulletPoint>Procesar y entregar pedidos</BulletPoint>
          <BulletPoint>Conectar usuarios, negocios y repartidores</BulletPoint>
          <BulletPoint>Calcular tarifas de entrega</BulletPoint>
          <BulletPoint>Procesar pagos y comisiones</BulletPoint>
          <BulletPoint>Proporcionar seguimiento en tiempo real</BulletPoint>
          <BulletPoint>Mejorar nuestros servicios</BulletPoint>
          <BulletPoint>Prevenir fraudes</BulletPoint>
        </Section>

        <Section title="Compartir Información">
          <InfoBox icon="users" title="Con Otros Usuarios">
            <Paragraph>
              Solo compartimos información necesaria para completar pedidos: nombre, dirección de entrega 
              y teléfono con negocio y repartidor asignado.
            </Paragraph>
          </InfoBox>

          <InfoBox icon="server" title="Con Proveedores">
            <Paragraph>
              Stripe (pagos), Twilio (SMS), servicios de hosting. Todos cumplen con estándares de seguridad.
            </Paragraph>
          </InfoBox>
        </Section>

        <Section title="Seguridad de Datos">
          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Medidas Técnicas:
          </ThemedText>
          <BulletPoint>Encriptación HTTPS/TLS</BulletPoint>
          <BulletPoint>Contraseñas hasheadas con bcrypt</BulletPoint>
          <BulletPoint>PCI-DSS compliance (Stripe)</BulletPoint>
          <BulletPoint>Backups automáticos diarios</BulletPoint>

          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Su Responsabilidad:
          </ThemedText>
          <BulletPoint>Use contraseña fuerte y única</BulletPoint>
          <BulletPoint>No comparta sus credenciales</BulletPoint>
          <BulletPoint>Reporte actividad sospechosa</BulletPoint>
        </Section>

        <Section title="Sus Derechos (ARCO)">
          <Paragraph>
            Conforme a la ley mexicana, usted tiene derecho a:
          </Paragraph>
          <BulletPoint>Acceso: Conocer qué datos tenemos</BulletPoint>
          <BulletPoint>Rectificación: Corregir datos inexactos</BulletPoint>
          <BulletPoint>Cancelación: Solicitar eliminación</BulletPoint>
          <BulletPoint>Oposición: Oponerse a ciertos usos</BulletPoint>

          <View style={[styles.contactBox, { backgroundColor: theme.card }]}>
            <Feather name="mail" size={20} color={ComeYaColors.primary} />
            <View style={{ marginLeft: Spacing.md, flex: 1 }}>
              <ThemedText type="body" style={{ fontWeight: '600' }}>
                Ejercer sus derechos:
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                privacy@ComeYa.app
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                Respuesta en 20 días hábiles
              </ThemedText>
            </View>
          </View>
        </Section>

        <Section title="Retención de Datos">
          <BulletPoint>Cuenta activa: Mientras esté activa</BulletPoint>
          <BulletPoint>Historial de pedidos: 7 años (requisito fiscal)</BulletPoint>
          <BulletPoint>Ubicación GPS: 30 días después de entrega</BulletPoint>
          <BulletPoint>Comunicaciones: 2 años</BulletPoint>
        </Section>

        <Section title="Privacidad por Rol">
          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Usuarios/Clientes:
          </ThemedText>
          <Paragraph>
            Protegemos información de pago, direcciones e historial. Solo compartimos nombre y dirección 
            durante pedido activo.
          </Paragraph>

          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Repartidores:
          </ThemedText>
          <Paragraph>
            Ubicación GPS solo visible durante entregas activas. Información de vehículo y ganancias privadas.
          </Paragraph>

          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Negocios:
          </ThemedText>
          <Paragraph>
            Información bancaria encriptada. Métricas de ventas privadas.
          </Paragraph>
        </Section>

        <Section title="Contacto">
          <View style={[styles.contactGrid, { backgroundColor: theme.card }]}>
            <View style={styles.contactItem}>
              <Feather name="shield" size={24} color={ComeYaColors.primary} />
              <ThemedText type="small" style={{ marginTop: Spacing.xs, fontWeight: '600' }}>
                Privacidad
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                privacy@ComeYa.app
              </ThemedText>
            </View>
            <View style={styles.contactItem}>
              <Feather name="lock" size={24} color={ComeYaColors.primary} />
              <ThemedText type="small" style={{ marginTop: Spacing.xs, fontWeight: '600' }}>
                Seguridad
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                security@ComeYa.app
              </ThemedText>
            </View>
            <View style={styles.contactItem}>
              <Feather name="help-circle" size={24} color={ComeYaColors.primary} />
              <ThemedText type="small" style={{ marginTop: Spacing.xs, fontWeight: '600' }}>
                Soporte
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                support@ComeYa.app
              </ThemedText>
            </View>
          </View>
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
    flexDirection: 'row',
    alignItems: 'center',
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
  infoBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  infoTitle: {
    marginLeft: Spacing.sm,
    fontWeight: '600',
  },
  contactBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  contactGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  contactItem: {
    alignItems: 'center',
    flex: 1,
  },
  footer: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
});
