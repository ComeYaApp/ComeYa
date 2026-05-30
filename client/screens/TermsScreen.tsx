import React from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";

export default function TermsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();

  const Section = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <View style={styles.section}>
      <ThemedText type="h4" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      {children}
    </View>
  );

  const Paragraph = ({ children }: { children: React.ReactNode }) => (
    <ThemedText
      type="body"
      style={[styles.paragraph, { color: theme.textSecondary }]}
    >
      {children}
    </ThemedText>
  );

  const BulletPoint = ({ children }: { children: string }) => (
    <View style={styles.bulletContainer}>
      <View
        style={[styles.bullet, { backgroundColor: ComeYaColors.primary }]}
      />
      <ThemedText
        type="body"
        style={[styles.bulletText, { color: theme.textSecondary }]}
      >
        {children}
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">Términos y Condiciones</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <View
          style={[
            styles.badge,
            { backgroundColor: ComeYaColors.primary + "20" },
          ]}
        >
          <ThemedText
            type="small"
            style={{ color: ComeYaColors.primary, fontWeight: "600" }}
          >
            Última actualización: 1 de Enero de 2025
          </ThemedText>
        </View>

        <Paragraph>
          Bienvenido a ComeYa. Estos Términos y Condiciones ("Términos")
          constituyen un acuerdo legal vinculante entre usted y ComeYa
          ("nosotros", "nuestro") que rige su acceso y uso de nuestra plataforma
          de delivery.
        </Paragraph>

        <Section title="1. Aceptación de los Términos">
          <Paragraph>
            Al descargar, instalar, registrarse o utilizar la aplicación ComeYa,
            usted acepta expresamente estar legalmente vinculado por estos
            Términos, nuestra Política de Privacidad y todas las políticas
            aplicables. Si no está de acuerdo con alguna parte de estos
            términos, no debe utilizar nuestros servicios.
          </Paragraph>
          <Paragraph>
            ComeYa es una plataforma tecnológica que actúa como intermediario
            entre usuarios finales, establecimientos comerciales y repartidores
            independientes en Soria, España. No somos propietarios, operadores
            ni empleadores de los negocios o repartidores que utilizan nuestra
            plataforma.
          </Paragraph>
        </Section>

        <Section title="2. Elegibilidad y Registro">
          <Paragraph>Para utilizar ComeYa debe:</Paragraph>
          <BulletPoint>
            Tener al menos 18 años de edad o la mayoría de edad legal en su
            jurisdicción
          </BulletPoint>
          <BulletPoint>
            Proporcionar información veraz, precisa y completa durante el
            registro
          </BulletPoint>
          <BulletPoint>
            Mantener la seguridad de su cuenta y contraseña
          </BulletPoint>
          <BulletPoint>
            Notificarnos inmediatamente de cualquier uso no autorizado de su
            cuenta
          </BulletPoint>
          <BulletPoint>
            Tener capacidad legal para celebrar contratos vinculantes
          </BulletPoint>
          <Paragraph>
            Nos reservamos el derecho de suspender o cancelar cuentas que violen
            estos términos o proporcionen información falsa.
          </Paragraph>
        </Section>

        <Section title="3. Descripción de Servicios">
          <Paragraph>
            ComeYa proporciona una plataforma tecnológica que facilita la
            conexión entre:
          </Paragraph>
          <ThemedText
            type="body"
            style={[styles.subsectionTitle, { color: theme.text }]}
          >
            Usuarios/Clientes:
          </ThemedText>
          <BulletPoint>
            Exploración de catálogos de negocios locales verificados
          </BulletPoint>
          <BulletPoint>
            Realización de pedidos con múltiples métodos de pago seguros
          </BulletPoint>
          <BulletPoint>Seguimiento GPS en tiempo real de entregas</BulletPoint>
          <BulletPoint>
            Sistema de calificaciones y reseñas verificadas
          </BulletPoint>
          <BulletPoint>Soporte al cliente integrado</BulletPoint>

          <ThemedText
            type="body"
            style={[styles.subsectionTitle, { color: theme.text }]}
          >
            Establecimientos Comerciales:
          </ThemedText>
          <BulletPoint>
            Panel de administración de productos y pedidos
          </BulletPoint>
          <BulletPoint>Gestión de inventario en tiempo real</BulletPoint>
          <BulletPoint>Analíticas y estadísticas de ventas</BulletPoint>
          <BulletPoint>Herramientas de marketing y promociones</BulletPoint>
          <BulletPoint>Sistema de pagos automatizado</BulletPoint>

          <ThemedText
            type="body"
            style={[styles.subsectionTitle, { color: theme.text }]}
          >
            Repartidores Independientes:
          </ThemedText>
          <BulletPoint>
            Sistema de asignación inteligente de pedidos
          </BulletPoint>
          <BulletPoint>Navegación GPS optimizada</BulletPoint>
          <BulletPoint>Gestión de ganancias y retiros</BulletPoint>
          <BulletPoint>Verificación de identidad y antecedentes</BulletPoint>
          <BulletPoint>
            Seguro de responsabilidad civil durante entregas activas
          </BulletPoint>
        </Section>

        <Section title="4. Estructura de Precios y Comisiones">
          <Paragraph>
            Todos los precios mostrados en la plataforma incluyen IVA cuando sea
            aplicable. La estructura de comisiones es transparente:
          </Paragraph>
          <BulletPoint>
            Precio de productos: Establecido por cada negocio + 15% de comisión
            de plataforma
          </BulletPoint>
          <BulletPoint>
            Tarifa de entrega: Calculada dinámicamente según distancia, demanda
            y disponibilidad
          </BulletPoint>
          <BulletPoint>
            Propinas: 100% para el repartidor (opcional)
          </BulletPoint>
          <Paragraph>
            Los pagos se procesan de forma segura a través de procesadores
            certificados PCI-DSS. Los fondos se liberan a negocios y
            repartidores después de la confirmación exitosa de entrega, sujeto a
            nuestro período de retención de 24-48 horas para prevención de
            fraude.
          </Paragraph>
        </Section>

        <Section title="5. Pedidos, Cancelaciones y Reembolsos">
          <Paragraph>
            Al realizar un pedido, usted acepta pagar el monto total mostrado,
            incluyendo productos, tarifa de entrega, impuestos y propinas. Las
            cancelaciones están sujetas a las siguientes políticas:
          </Paragraph>
          <BulletPoint>
            Antes de aceptación por el negocio: Reembolso del 100%
          </BulletPoint>
          <BulletPoint>
            Después de aceptación, antes de preparación: Cargo de cancelación
            del 20%
          </BulletPoint>
          <BulletPoint>
            Durante preparación: Cargo de cancelación del 50%
          </BulletPoint>
          <BulletPoint>
            Pedido listo para recoger o en tránsito: No reembolsable
          </BulletPoint>
          <Paragraph>
            Los reembolsos se procesan al método de pago original en 5-10 días
            hábiles. En caso de productos defectuosos, faltantes o incorrectos,
            contacte a soporte dentro de las 24 horas posteriores a la entrega
            para resolución.
          </Paragraph>
        </Section>

        <Section title="6. Propiedad Intelectual">
          <Paragraph>
            Todos los derechos de propiedad intelectual sobre la plataforma
            ComeYa, incluyendo pero no limitado a software, diseño, logotipos,
            marcas comerciales, contenido y tecnología, son propiedad exclusiva
            de ComeYa o sus licenciantes.
          </Paragraph>
          <Paragraph>
            Se le otorga una licencia limitada, no exclusiva, no transferible y
            revocable para usar la aplicación únicamente para fines personales y
            no comerciales. Queda prohibido:
          </Paragraph>
          <BulletPoint>Copiar, modificar o distribuir el software</BulletPoint>
          <BulletPoint>
            Realizar ingeniería inversa o descompilar la aplicación
          </BulletPoint>
          <BulletPoint>
            Usar la plataforma para crear productos o servicios competidores
          </BulletPoint>
          <BulletPoint>
            Extraer datos mediante scraping o métodos automatizados
          </BulletPoint>
        </Section>

        <Section title="7. Conducta del Usuario y Contenido">
          <Paragraph>
            Usted es responsable de todo el contenido que publique en la
            plataforma, incluyendo reseñas, calificaciones y comunicaciones. Al
            publicar contenido, usted garantiza que:
          </Paragraph>
          <BulletPoint>
            Es el propietario o tiene derechos sobre el contenido
          </BulletPoint>
          <BulletPoint>
            El contenido no infringe derechos de terceros
          </BulletPoint>
          <BulletPoint>
            El contenido no es ilegal, ofensivo, difamatorio o fraudulento
          </BulletPoint>
          <BulletPoint>
            No contiene información personal de terceros sin consentimiento
          </BulletPoint>
          <Paragraph>
            Nos reservamos el derecho de eliminar cualquier contenido que viole
            estos términos sin previo aviso. Las reseñas deben ser honestas,
            basadas en experiencias reales y no incentivadas.
          </Paragraph>
        </Section>

        <Section title="8. Limitación de Responsabilidad y Exención de Garantías">
          <Paragraph>EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY:</Paragraph>
          <BulletPoint>
            ComeYa actúa únicamente como intermediario tecnológico entre
            usuarios, negocios y repartidores
          </BulletPoint>
          <BulletPoint>
            No somos responsables de la calidad, seguridad, legalidad o
            disponibilidad de productos
          </BulletPoint>
          <BulletPoint>
            No garantizamos tiempos de entrega específicos, aunque
            proporcionamos estimaciones
          </BulletPoint>
          <BulletPoint>
            No somos responsables por alergias, intoxicaciones o problemas de
            salud derivados de productos
          </BulletPoint>
          <BulletPoint>
            No somos responsables por acciones, omisiones o negligencia de
            negocios o repartidores
          </BulletPoint>
          <BulletPoint>
            El servicio se proporciona "TAL CUAL" y "SEGÚN DISPONIBILIDAD" sin
            garantías de ningún tipo
          </BulletPoint>
          <Paragraph>
            Nuestra responsabilidad total hacia usted por cualquier reclamo no
            excederá el monto pagado por el pedido específico en cuestión o
            €100, lo que sea menor. No seremos responsables por daños
            indirectos, incidentales, especiales, consecuentes o punitivos.
          </Paragraph>
        </Section>

        <Section title="9. Actividades Prohibidas">
          <Paragraph>Queda estrictamente prohibido:</Paragraph>
          <BulletPoint>
            Usar la plataforma para actividades ilegales o fraudulentas
          </BulletPoint>
          <BulletPoint>
            Crear múltiples cuentas o usar cuentas falsas
          </BulletPoint>
          <BulletPoint>
            Manipular calificaciones, reseñas o el sistema de recompensas
          </BulletPoint>
          <BulletPoint>
            Acosar, amenazar o discriminar a otros usuarios, negocios o
            repartidores
          </BulletPoint>
          <BulletPoint>
            Realizar pedidos sin intención de pago o recepción
          </BulletPoint>
          <BulletPoint>
            Compartir credenciales de cuenta con terceros
          </BulletPoint>
          <BulletPoint>
            Usar bots, scripts o herramientas automatizadas
          </BulletPoint>
          <BulletPoint>
            Intentar acceder a sistemas o datos no autorizados
          </BulletPoint>
          <Paragraph>
            La violación de estas prohibiciones resultará en suspensión
            inmediata de la cuenta, posible acción legal y reporte a autoridades
            competentes cuando sea aplicable.
          </Paragraph>
        </Section>

        <Section title="10. Indemnización">
          <Paragraph>
            Usted acepta indemnizar, defender y eximir de responsabilidad a
            ComeYa, sus directores, empleados, agentes y afiliados de cualquier
            reclamo, demanda, pérdida, responsabilidad, daño, costo o gasto
            (incluyendo honorarios legales razonables) que surjan de:
          </Paragraph>
          <BulletPoint>Su uso o mal uso de la plataforma</BulletPoint>
          <BulletPoint>Violación de estos Términos</BulletPoint>
          <BulletPoint>Violación de derechos de terceros</BulletPoint>
          <BulletPoint>
            Contenido que usted publique en la plataforma
          </BulletPoint>
          <BulletPoint>Cualquier actividad fraudulenta o ilegal</BulletPoint>
        </Section>

        <Section title="11. Resolución de Disputas">
          <Paragraph>
            En caso de disputa, primero intente resolverla contactando a nuestro
            equipo de soporte. Si no se alcanza una resolución satisfactoria,
            las partes acuerdan:
          </Paragraph>
          <BulletPoint>
            Intentar mediación de buena fe antes de litigio
          </BulletPoint>
          <BulletPoint>
            Jurisdicción exclusiva de los tribunales de Soria, España
          </BulletPoint>
          <BulletPoint>
            Aplicación de las leyes españolas y europeas (GDPR, Ley de
            Protección de Datos)
          </BulletPoint>
          <BulletPoint>Renuncia a acciones colectivas o de clase</BulletPoint>
        </Section>

        <Section title="12. Modificaciones de los Términos">
          <Paragraph>
            Nos reservamos el derecho de modificar estos Términos en cualquier
            momento. Los cambios materiales serán notificados con al menos 30
            días de anticipación mediante:
          </Paragraph>
          <BulletPoint>Notificación en la aplicación</BulletPoint>
          <BulletPoint>
            Correo electrónico a su dirección registrada
          </BulletPoint>
          <BulletPoint>Aviso en nuestro sitio web</BulletPoint>
          <Paragraph>
            El uso continuado de la plataforma después de la fecha de vigencia
            de los cambios constituye su aceptación de los nuevos términos. Si
            no está de acuerdo, debe dejar de usar el servicio.
          </Paragraph>
        </Section>

        <Section title="13. Terminación">
          <Paragraph>
            Cualquiera de las partes puede terminar este acuerdo en cualquier
            momento:
          </Paragraph>
          <BulletPoint>
            Usted: Eliminando su cuenta desde la configuración de la app
          </BulletPoint>
          <BulletPoint>
            Nosotros: Por violación de términos, actividad fraudulenta o a
            nuestra discreción
          </BulletPoint>
          <Paragraph>
            Tras la terminación, su derecho a usar la plataforma cesa
            inmediatamente. Las disposiciones que por su naturaleza deben
            sobrevivir (indemnización, limitación de responsabilidad, propiedad
            intelectual) permanecerán vigentes.
          </Paragraph>
        </Section>

        <Section title="14. Disposiciones Generales">
          <BulletPoint>
            Acuerdo Completo: Estos términos constituyen el acuerdo completo
            entre las partes
          </BulletPoint>
          <BulletPoint>
            Divisibilidad: Si alguna disposición es inválida, las demás
            permanecen vigentes
          </BulletPoint>
          <BulletPoint>
            No Renuncia: La falta de ejercicio de un derecho no constituye
            renuncia al mismo
          </BulletPoint>
          <BulletPoint>
            Cesión: No puede transferir sus derechos sin nuestro consentimiento
            previo por escrito
          </BulletPoint>
          <BulletPoint>
            Fuerza Mayor: No somos responsables por incumplimientos debido a
            causas fuera de nuestro control
          </BulletPoint>
        </Section>

        <Section title="15. Información de Contacto">
          <Paragraph>Para preguntas sobre estos Términos:</Paragraph>
          <BulletPoint>Email: legal@comeya.app</BulletPoint>
          <BulletPoint>Soporte: support@comeya.app</BulletPoint>
          <BulletPoint>Dirección: Soria, España</BulletPoint>
          <BulletPoint>
            Horario de atención: Lunes a Viernes, 9:00 - 18:00 CET
          </BulletPoint>
        </Section>

        <View style={[styles.footer, { backgroundColor: theme.card }]}>
          <ThemedText
            type="small"
            style={{
              color: theme.textSecondary,
              textAlign: "center",
              fontWeight: "600",
            }}
          >
            Al usar ComeYa, usted acepta estos Términos y nuestra Política de
            Privacidad
          </ThemedText>
          <ThemedText
            type="caption"
            style={{
              color: theme.textSecondary,
              textAlign: "center",
              marginTop: Spacing.md,
            }}
          >
            Conectando negocios locales con la comunidad de Soria
          </ThemedText>
          <ThemedText
            type="caption"
            style={{
              color: theme.textSecondary,
              textAlign: "center",
              marginTop: Spacing.xs,
            }}
          >
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    paddingBottom: Spacing["4xl"],
  },
  badge: {
    alignSelf: "flex-start",
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
    fontWeight: "700",
  },
  subsectionTitle: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    fontWeight: "600",
  },
  paragraph: {
    lineHeight: 24,
    marginBottom: Spacing.md,
  },
  bulletContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
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
