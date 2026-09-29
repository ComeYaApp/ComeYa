# Informe de mejoras y correcciones — ComeYa

**Versión de prueba 1.0.15 · Agosto de 2026**

## 1. Resumen general

Durante la última fase de pruebas en entorno real se identificaron incidencias y oportunidades de mejora en los tres perfiles de la plataforma (cliente, negocio y repartidor). Todas ellas han sido resueltas e incorporadas a la nueva versión, junto con una nueva funcionalidad de reservas de mesa.

Resultados principales:

- El repartidor puede liberar o cancelar un pedido indicando un motivo, que queda visible para el cliente y el negocio.
- El flujo de pagos manuales (Bizum y PayPal) funciona de principio a fin: creación del pedido, envío del comprobante y verificación por parte del administrador.
- La transferencia SEPA se ha retirado como método de pago del cliente, por indicación recibida.
- Las sustituciones de productos gestionan la diferencia de precio: reembolso automático si el sustituto es más barato, y cobro previo y consentido si es más caro.
- Nueva funcionalidad de reservas de mesa para negocios, incluidos los que no ofrecen reparto a domicilio.
- Correcciones visuales en las pantallas de pago, donde algunos importes aparecían cortados.

## 2. Detalle de las mejoras

### 2.1 Repartidores: cancelación de pedidos con motivo

- El repartidor dispone de un botón «Cancelar pedido» en cada entrega activa, tanto en la aplicación móvil como en la versión web.
- Al cancelar debe indicar el motivo: avería del vehículo, mucho tráfico, problema personal u otro, con posibilidad de añadir una nota aclaratoria.
- Si la cancelación se produce antes de recoger el pedido, este no se pierde: vuelve a estar disponible de inmediato para que cualquier otro repartidor pueda aceptarlo.
- Si se produce después de la recogida, el pedido se cierra y se reembolsa el 100 % del importe al cliente.
- En ambos casos, el cliente y el negocio reciben una notificación con el motivo de la cancelación, y este queda registrado en el sistema para la supervisión del administrador.

### 2.2 Pagos: corrección del flujo manual y simplificación de métodos

- Se ha corregido el error que impedía enviar los comprobantes de pago manual, que mostraba el mensaje «pedido no encontrado». El circuito completo queda operativo: selección del método de pago, creación del pedido, envío del comprobante, verificación por parte del administrador y aceptación por parte del negocio.
- Los métodos de pago disponibles para el cliente son: tarjeta (a través de Stripe), Bizum y PayPal.
- La transferencia SEPA se ha retirado del sistema como método de pago del cliente. Los pagos anteriores realizados por esta vía conservan su información correctamente.
- Se ha corregido la visualización de los importes en las ventanas de selección de método de pago y de envío de comprobante, que en determinados dispositivos aparecían cortados.

### 2.3 Sustituciones de productos: gestión de la diferencia de precio

- Si el negocio sustituye un producto por otro más barato, la diferencia se reembolsa automáticamente al cliente.
- Si el sustituto es más caro, el cliente recibe una notificación con el importe exacto de la diferencia y decide si la acepta:
  - Si acepta, paga la diferencia y el negocio puede preparar el pedido.
  - Si rechaza, el negocio no puede preparar el pedido hasta resolver la situación (proponer otro producto o cancelar el pedido con reembolso).
- Cuando hay varios productos sustituidos, la diferencia se agrupa en un único pago por el importe total.
- El aviso de sustitución y la gestión de la diferencia están disponibles tanto en móvil como en web.

### 2.4 Nueva funcionalidad: reservas de mesa

- Los negocios pueden ofrecer reservas de mesa aunque no realicen reparto a domicilio, manteniendo su carta y sus productos visibles en la plataforma.
- El cliente reserva directamente desde la ficha del negocio: fecha (hasta 14 días de antelación), hora, número de comensales y notas opcionales.
- El negocio confirma o rechaza cada reserva desde su panel de gestión, con notificaciones al cliente en ambos casos.
- El cliente puede consultar el estado de sus reservas y cancelarlas desde su perfil.
- El sistema valida que la reserva se encuentre dentro del horario de apertura del negocio y evita reservas duplicadas para un mismo día.

## 3. Verificación y estado

- Todas las mejoras han sido implementadas y verificadas técnicamente antes de su entrega.
- La nueva versión está disponible en la aplicación de prueba para Android y en la versión web.
- Próximo paso previsto: prueba integral en calle con los tres perfiles (cliente, negocio y repartidor) funcionando de forma simultánea.
