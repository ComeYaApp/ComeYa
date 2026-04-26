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
            Última actualización: 1 de Enero de 2025
          </ThemedText>
        </View>

        <Paragraph>
          En ComeYa, la protección de su privacidad y datos personales es nuestra máxima prioridad. Esta Política 
          de Privacidad describe cómo recopilamos, usamos, almacenamos, compartimos y protegemos su información 
          personal de conformidad con el Reglamento General de Protección de Datos (GDPR) y las leyes españolas 
          aplicables.
        </Paragraph>

        <Section title="1. Responsable del Tratamiento">
          <Paragraph>
            ComeYa es el responsable del tratamiento de sus datos personales:
          </Paragraph>
          <BulletPoint>Nombre: ComeYa</BulletPoint>
          <BulletPoint>Dirección: Soria, España</BulletPoint>
          <BulletPoint>Email: privacy@comeya.app</BulletPoint>
          <BulletPoint>Delegado de Protección de Datos: dpo@comeya.app</BulletPoint>
        </Section>

        <Section title="2. Información que Recopilamos">
          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Datos de Registro (obligatorios):
          </ThemedText>
          <BulletPoint>Nombre completo</BulletPoint>
          <BulletPoint>Número de teléfono móvil (verificado por SMS/OTP)</BulletPoint>
          <BulletPoint>Dirección de correo electrónico</BulletPoint>
          <BulletPoint>Contraseña (almacenada con hash bcrypt)</BulletPoint>

          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Datos de Uso:
          </ThemedText>
          <BulletPoint>Direcciones de entrega guardadas</BulletPoint>
          <BulletPoint>Historial de pedidos y transacciones</BulletPoint>
          <BulletPoint>Preferencias de productos y negocios favoritos</BulletPoint>
          <BulletPoint>Calificaciones y reseñas publicadas</BulletPoint>
          <BulletPoint>Comunicaciones con soporte</BulletPoint>

          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Datos de Ubicación (solo repartidores):
          </ThemedText>
          <BulletPoint>Ubicación GPS en tiempo real durante entregas activas</BulletPoint>
          <BulletPoint>Historial de rutas de entrega (30 días)</BulletPoint>

          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Datos de Pago:
          </ThemedText>
          <BulletPoint>Información de tarjetas (procesada y almacenada por Stripe, no por ComeYa)</BulletPoint>
          <BulletPoint>Historial de transacciones</BulletPoint>
          <BulletPoint>Datos bancarios para retiros (negocios y repartidores)</BulletPoint>

          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Datos Técnicos:
          </ThemedText>
          <BulletPoint>Dirección IP</BulletPoint>
          <BulletPoint>Tipo de dispositivo y sistema operativo</BulletPoint>
          <BulletPoint>Identificador único de dispositivo</BulletPoint>
          <BulletPoint>Datos de uso de la aplicación (analytics)</BulletPoint>
        </Section>

        <Section title="3. Base Legal y Finalidad del Tratamiento">
          <InfoBox icon="file-text" title="Ejecución de Contrato">
            <Paragraph>
              Procesamos sus datos para proporcionar nuestros servicios: procesar pedidos, coordinar entregas, 
              gestionar pagos y proporcionar soporte al cliente.
            </Paragraph>
          </InfoBox>

          <InfoBox icon="shield" title="Obligación Legal">
            <Paragraph>
              Cumplimiento de obligaciones fiscales, contables y de prevención de fraude según la legislación española.
            </Paragraph>
          </InfoBox>

          <InfoBox icon="check-circle" title="Consentimiento">
            <Paragraph>
              Marketing, notificaciones promocionales y análisis de comportamiento (puede retirar su consentimiento 
              en cualquier momento).
            </Paragraph>
          </InfoBox>

          <InfoBox icon="alert-circle" title="Interés Legítimo">
            <Paragraph>
              Mejora de servicios, prevención de fraude, seguridad de la plataforma y análisis estadísticos.
            </Paragraph>
          </InfoBox>
        </Section>

        <Section title="4. Cómo Usamos su Información">
          <BulletPoint>Procesar y gestionar pedidos de principio a fin</BulletPoint>
          <BulletPoint>Conectar usuarios con negocios y repartidores apropiados</BulletPoint>
          <BulletPoint>Calcular tarifas de entrega basadas en distancia</BulletPoint>
          <BulletPoint>Procesar pagos y distribuir comisiones</BulletPoint>
          <BulletPoint>Proporcionar seguimiento GPS en tiempo real</BulletPoint>
          <BulletPoint>Enviar notificaciones sobre estado de pedidos</BulletPoint>
          <BulletPoint>Verificar identidad y prevenir fraude</BulletPoint>
          <BulletPoint>Proporcionar soporte al cliente</BulletPoint>
          <BulletPoint>Mejorar y personalizar nuestros servicios</BulletPoint>
          <BulletPoint>Cumplir con obligaciones legales y fiscales</BulletPoint>
          <BulletPoint>Enviar comunicaciones de marketing (con su consentimiento)</BulletPoint>
        </Section>

        <Section title="5. Compartir Información con Terceros">
          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Con Otros Usuarios de la Plataforma:
          </ThemedText>
          <Paragraph>
            Durante un pedido activo, compartimos información limitada:
          </Paragraph>
          <BulletPoint>Negocio: Nombre del cliente, dirección de entrega, teléfono, detalles del pedido</BulletPoint>
          <BulletPoint>Repartidor: Nombre del cliente, dirección de entrega, teléfono, instrucciones</BulletPoint>
          <BulletPoint>Cliente: Nombre del repartidor, foto, ubicación GPS en tiempo real, teléfono</BulletPoint>

          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Con Proveedores de Servicios:
          </ThemedText>
          <BulletPoint>Stripe: Procesamiento de pagos (PCI-DSS Level 1 certificado)</BulletPoint>
          <BulletPoint>Twilio: Verificación SMS y comunicaciones</BulletPoint>
          <BulletPoint>Google Maps: Servicios de geolocalización y navegación</BulletPoint>
          <BulletPoint>Servicios de hosting: Almacenamiento seguro de datos (servidores en UE)</BulletPoint>
          <BulletPoint>Servicios de analytics: Análisis de uso (datos anonimizados)</BulletPoint>

          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Con Autoridades:
          </ThemedText>
          <Paragraph>
            Cuando sea requerido por ley, orden judicial o para proteger nuestros derechos legales.
          </Paragraph>
        </Section>

        <Section title="6. Seguridad de Datos">
          <Paragraph>
            Implementamos medidas técnicas y organizativas de seguridad de nivel industrial:
          </Paragraph>
          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Medidas Técnicas:
          </ThemedText>
          <BulletPoint>Encriptación TLS/SSL para todas las comunicaciones</BulletPoint>
          <BulletPoint>Encriptación AES-256 para datos en reposo</BulletPoint>
          <BulletPoint>Contraseñas hasheadas con bcrypt (factor 12)</BulletPoint>
          <BulletPoint>Autenticación de dos factores (2FA) vía SMS</BulletPoint>
          <BulletPoint>Firewalls y sistemas de detección de intrusiones</BulletPoint>
          <BulletPoint>Backups automáticos diarios encriptados</BulletPoint>
          <BulletPoint>Monitoreo 24/7 de seguridad</BulletPoint>

          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Medidas Organizativas:
          </ThemedText>
          <BulletPoint>Acceso a datos limitado por rol y necesidad</BulletPoint>
          <BulletPoint>Auditorías de seguridad regulares</BulletPoint>
          <BulletPoint>Capacitación continua del personal en protección de datos</BulletPoint>
          <BulletPoint>Acuerdos de confidencialidad con todos los empleados</BulletPoint>
          <BulletPoint>Plan de respuesta a incidentes de seguridad</BulletPoint>
        </Section>

        <Section title="7. Sus Derechos (GDPR)">
          <Paragraph>
            Bajo el GDPR y la legislación española, usted tiene los siguientes derechos:
          </Paragraph>
          <BulletPoint>Derecho de Acceso: Obtener copia de sus datos personales</BulletPoint>
          <BulletPoint>Derecho de Rectificación: Corregir datos inexactos o incompletos</BulletPoint>
          <BulletPoint>Derecho de Supresión: Solicitar eliminación de sus datos ("derecho al olvido")</BulletPoint>
          <BulletPoint>Derecho de Limitación: Restringir el procesamiento de sus datos</BulletPoint>
          <BulletPoint>Derecho de Portabilidad: Recibir sus datos en formato estructurado y legible</BulletPoint>
          <BulletPoint>Derecho de Oposición: Oponerse al procesamiento de sus datos</BulletPoint>
          <BulletPoint>Derecho a Retirar Consentimiento: En cualquier momento, sin afectar la legalidad del procesamiento previo</BulletPoint>
          <BulletPoint>Derecho a Presentar Reclamación: Ante la Agencia Española de Protección de Datos (AEPD)</BulletPoint>

          <View style={[styles.contactBox, { backgroundColor: theme.card }]}>
            <Feather name="mail" size={20} color={ComeYaColors.primary} />
            <View style={{ marginLeft: Spacing.md, flex: 1 }}>
              <ThemedText type="body" style={{ fontWeight: '600' }}>
                Para ejercer sus derechos:
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                privacy@comeya.app
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                Respuesta garantizada en 30 días (GDPR)
              </ThemedText>
            </View>
          </View>
        </Section>

        <Section title="8. Retención de Datos">
          <Paragraph>
            Conservamos sus datos personales solo durante el tiempo necesario:
          </Paragraph>
          <BulletPoint>Cuenta activa: Mientras su cuenta esté activa y funcional</BulletPoint>
          <BulletPoint>Historial de pedidos: 7 años (requisito fiscal español)</BulletPoint>
          <BulletPoint>Datos de pago: Según requisitos de Stripe y regulaciones PCI-DSS</BulletPoint>
          <BulletPoint>Ubicación GPS: 30 días después de completar entrega</BulletPoint>
          <BulletPoint>Comunicaciones de soporte: 2 años</BulletPoint>
          <BulletPoint>Datos de marketing: Hasta que retire su consentimiento</BulletPoint>
          <BulletPoint>Logs de seguridad: 12 meses</BulletPoint>
          <Paragraph>
            Después de estos períodos, los datos son eliminados de forma segura o anonimizados para análisis estadísticos.
          </Paragraph>
        </Section>

        <Section title="9. Transferencias Internacionales">
          <Paragraph>
            Sus datos se almacenan principalmente en servidores ubicados en la Unión Europea. Algunos proveedores 
            de servicios pueden procesar datos fuera de la UE:
          </Paragraph>
          <BulletPoint>Stripe: USA (certificado Privacy Shield y cláusulas contractuales estándar)</BulletPoint>
          <BulletPoint>Google Cloud: Servidores en UE con garantías de protección adecuadas</BulletPoint>
          <Paragraph>
            Todas las transferencias internacionales cumplen con el Artículo 46 del GDPR mediante cláusulas 
            contractuales estándar aprobadas por la Comisión Europea.
          </Paragraph>
        </Section>

        <Section title="10. Cookies y Tecnologías de Seguimiento">
          <Paragraph>
            Utilizamos cookies y tecnologías similares para:
          </Paragraph>
          <BulletPoint>Cookies esenciales: Necesarias para el funcionamiento de la plataforma</BulletPoint>
          <BulletPoint>Cookies de rendimiento: Análisis de uso y mejora de servicios</BulletPoint>
          <BulletPoint>Cookies de funcionalidad: Recordar preferencias y configuraciones</BulletPoint>
          <BulletPoint>Identificadores de dispositivo: Para seguridad y prevención de fraude</BulletPoint>
          <Paragraph>
            Puede gestionar sus preferencias de cookies en la configuración de la aplicación. Las cookies esenciales 
            no pueden desactivarse sin afectar la funcionalidad.
          </Paragraph>
        </Section>

        <Section title="11. Privacidad de Menores">
          <Paragraph>
            ComeYa no está dirigido a menores de 18 años. No recopilamos intencionalmente información de menores. 
            Si descubrimos que hemos recopilado datos de un menor sin consentimiento parental verificable, 
            eliminaremos esa información inmediatamente.
          </Paragraph>
          <Paragraph>
            Si es padre o tutor y cree que su hijo nos ha proporcionado información personal, contáctenos en 
            privacy@comeya.app.
          </Paragraph>
        </Section>

        <Section title="12. Privacidad por Rol">
          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Clientes:
          </ThemedText>
          <Paragraph>
            Protegemos su información de pago, direcciones e historial de pedidos. Solo compartimos nombre y 
            dirección de entrega con negocio y repartidor durante pedidos activos.
          </Paragraph>

          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Repartidores:
          </ThemedText>
          <Paragraph>
            Su ubicación GPS solo es visible para clientes durante entregas activas. Información de vehículo, 
            documentos de identidad y ganancias son estrictamente confidenciales.
          </Paragraph>

          <ThemedText type="body" style={[styles.subsectionTitle, { color: theme.text }]}>
            Negocios:
          </ThemedText>
          <Paragraph>
            Información bancaria encriptada. Métricas de ventas, productos y estrategias comerciales son privadas 
            y no se comparten con competidores.
          </Paragraph>
        </Section>

        <Section title="13. Notificación de Brechas de Seguridad">
          <Paragraph>
            En caso de una brecha de seguridad que afecte sus datos personales, le notificaremos dentro de las 
            72 horas según lo requerido por el GDPR. La notificación incluirá:
          </Paragraph>
          <BulletPoint>Naturaleza de la brecha</BulletPoint>
          <BulletPoint>Datos potencialmente afectados</BulletPoint>
          <BulletPoint>Medidas tomadas para mitigar el impacto</BulletPoint>
          <BulletPoint>Recomendaciones para proteger su información</BulletPoint>
          <BulletPoint>Punto de contacto para más información</BulletPoint>
        </Section>

        <Section title="14. Cambios a esta Política">
          <Paragraph>
            Podemos actualizar esta Política de Privacidad periódicamente para reflejar cambios en nuestras 
            prácticas o por razones legales. Los cambios materiales serán notificados con al menos 30 días de 
            anticipación mediante:
          </Paragraph>
          <BulletPoint>Notificación destacada en la aplicación</BulletPoint>
          <BulletPoint>Correo electrónico a su dirección registrada</BulletPoint>
          <BulletPoint>Aviso en nuestro sitio web</BulletPoint>
          <Paragraph>
            Le recomendamos revisar esta política periódicamente. La fecha de "Última actualización" al inicio 
            indica cuándo se realizó la última modificación.
          </Paragraph>
        </Section>

        <Section title="15. Contacto y Autoridad de Supervisión">
          <View style={[styles.contactGrid, { backgroundColor: theme.card }]}>
            <View style={styles.contactItem}>
              <Feather name="shield" size={24} color={ComeYaColors.primary} />
              <ThemedText type="small" style={{ marginTop: Spacing.xs, fontWeight: '600' }}>
                Privacidad
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                privacy@comeya.app
              </ThemedText>
            </View>
            <View style={styles.contactItem}>
              <Feather name="user-check" size={24} color={ComeYaColors.primary} />
              <ThemedText type="small" style={{ marginTop: Spacing.xs, fontWeight: '600' }}>
                DPO
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                dpo@comeya.app
              </ThemedText>
            </View>
            <View style={styles.contactItem}>
              <Feather name="help-circle" size={24} color={ComeYaColors.primary} />
              <ThemedText type="small" style={{ marginTop: Spacing.xs, fontWeight: '600' }}>
                Soporte
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                support@comeya.app
              </ThemedText>
            </View>
          </View>

          <Paragraph>
            Si no está satisfecho con nuestra respuesta, tiene derecho a presentar una reclamación ante:
          </Paragraph>
          <View style={[styles.contactBox, { backgroundColor: theme.card }]}>
            <Feather name="alert-circle" size={20} color={ComeYaColors.primary} />
            <View style={{ marginLeft: Spacing.md, flex: 1 }}>
              <ThemedText type="body" style={{ fontWeight: '600' }}>
                Agencia Española de Protección de Datos (AEPD)
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                C/ Jorge Juan, 6, 28001 Madrid
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                www.aepd.es
              </ThemedText>
            </View>
          </View>
        </Section>

        <View style={[styles.footer, { backgroundColor: theme.card }]}>
          <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: 'center', fontWeight: '600' }}>
            Su privacidad es nuestra prioridad. Cumplimos con GDPR y todas las leyes españolas de protección de datos.
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.md }}>
            Conectando negocios locales con la comunidad de Soria
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
    marginBottom: Spacing.md,
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
