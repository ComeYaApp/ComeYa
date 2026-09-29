# Informe de mejoras — ComeYa v1.0.16

## Resumen general

Esta actualización convierte los mapas y el seguimiento GPS en el centro de la experiencia, con el nivel de calidad de las grandes plataformas de reparto. Todas las pantallas con mapa de la aplicación (cliente, repartidor, negocio y administración, tanto en el móvil como en la web) utilizan ahora el mismo sistema de mapas profesionales, el movimiento de los repartidores es fluido y continuo, y se ha corregido el problema del precio que cambiaba solo en el carrito de compra.

---

## 1. Mapas profesionales en toda la aplicación

**Antes:** algunos mapas del iPhone mostraban un aspecto distinto al resto, y en varios puntos de la app había botones que abrían Google Maps fuera de la aplicación, obligando al usuario a salir y volver.

**Ahora:** todos los mapas usan el mismo sistema de mapas profesionales con calles y rutas reales, y todo ocurre dentro de la aplicación: consultar un negocio en el mapa, ver la ruta, ver los pasos para llegar o navegar hasta el local se hace sin salir de ComeYa. También la versión web muestra mapas reales en pantallas que antes no los tenían (por ejemplo, al indicar la dirección de un negocio).

## 2. Seguimiento GPS fluido, sin saltos

**Antes:** la posición del repartidor se actualizaba cada varios segundos y el punto "saltaba" de un lugar a otro; al ir a pie, en ocasiones la ubicación parecía atravesar edificios o aparecer en otra calle.

**Ahora:**
- El movimiento es continuo: la posición se refresca cada segundo y el punto se desliza suavemente por la calle.
- El mapa gira con la dirección del viaje y adopta una vista inclinada en tres dimensiones durante la navegación, como en las aplicaciones de referencia del sector.
- El icono del repartidor indica hacia dónde se dirige.
- Si la señal GPS se desvía (zonas con edificios altos, patios interiores), la posición se ajusta automáticamente a la calle real: el punto nunca "atraviesa" manzanas ni da saltos extraños.
- Todos los mapas de seguimiento incluyen un botón para centrar la vista en el repartidor cuando el usuario mueve el mapa.

## 3. Seguimiento con la pantalla bloqueada

**Antes:** si el repartidor bloqueaba el móvil o la pantalla se apagaba, la ubicación dejaba de transmitirse y el pedido parecía "perderse".

**Ahora:** el repartidor puede bloquear la pantalla con total normalidad: el sistema continúa transmitiendo su ubicación durante el reparto (en Android se muestra un aviso permanente de "Reparto en curso"). El cliente y el negocio siguen viendo el pedido avanzar en todo momento.

## 4. Recogida a pie mejorada

Para los pedidos de recogida en el local, el cliente que va a pie ve la ruta peatonal real —la más corta por calles y pasos peatonales— y, mientras camina, la aplicación le indica la distancia y los minutos que le quedan, actualizándose en vivo ("Te quedan 350 m · 5 min"). Esta función está disponible tanto en el móvil como en la web.

## 5. Precio del carrito corregido

**Antes:** al abrir el carrito o la pantalla de pago aparecía un importe que cambiaba solo al cabo de un segundo.

**Ahora:** el precio que se muestra es el definitivo desde el primer momento. Mientras se calcula, la aplicación muestra "Calculando…" y el botón de confirmación se activa únicamente cuando el importe está resuelto: nunca más un precio que cambia ante los ojos del cliente.

## 6. Mapas del negocio y de administración en vivo

- El negocio ve ahora a sus repartidores moviéndose en tiempo real (antes la posición se refrescaba cada 15 segundos).
- El panel de administración recibe ese mismo movimiento en vivo para supervisar todas las entregas.
- El enlace público de seguimiento que el cliente comparte con familiares o amigos muestra ahora la ruta real por calles y al repartidor en movimiento fluido, sin necesidad de cuenta ni de instalar la aplicación.

## 7. Seguridad y control del coste

- Cada plataforma utiliza su propia clave de acceso a los mapas (móvil Android, iPhone, web y servidor), cada una restringida para que solo pueda usarse desde la aplicación ComeYa.
- Las rutas se calculan desde el servidor con memoria de resultados y límites de consumo, manteniendo el coste del servicio de mapas bajo control.

---

## Guía de pruebas

### Como cliente
1. Realice un pedido a domicilio y abra el seguimiento: observe que el repartidor se mueve de forma continua, sin saltos, y pruebe el botón de centrado y mover el mapa.
2. Abra el carrito y la pantalla de pago: el precio debe mostrarse correcto desde el principio (breve "Calculando…" inicial) y no cambiar por sí solo.
3. Haga un pedido de recogida en local, seleccione "A pie" y compruebe que la ruta peatonal y la distancia restante se actualizan mientras camina.
4. Pulse "Compartir seguimiento" y abra el enlace en otro móvil o en el ordenador: verá el reparto en vivo con la ruta real, sin necesidad de iniciar sesión.
5. En el mapa de negocios, pulse "Cómo llegar": la ruta y los pasos se muestran dentro de la aplicación, sin abrir otras aplicaciones.

### Como repartidor
1. Acepte un pedido y entre en la navegación: observe la vista inclinada que gira con la dirección del viaje.
2. Bloquee la pantalla del móvil durante el reparto y compruebe que el cliente sigue viendo su posición (aviso "Reparto en curso").
3. Aléjese deliberadamente de la ruta y compruebe que se recalcula; camine entre edificios y observe que el punto se mantiene sobre la calle.

### Como negocio
1. Con un reparto activo, abra el mapa de repartos: los repartidores deben moverse en tiempo real, no a saltos.
2. En la web, edite la dirección de su negocio: el mapa interactivo está disponible.

### Como administrador
1. Abra el centro de operaciones durante un reparto y compruebe el movimiento en vivo de los repartidores en el mapa.

### En la web
Repita las pruebas anteriores desde el navegador (versión web): seguimiento del pedido, recogida a pie con distancia restante y mapa de negocios con "Cómo llegar" interno.

---

*Versión 1.0.16 — aplicaciones móviles (Android 21, iOS build 14) y web. Esta versión se suma a las mejoras de la versión 1.0.15 ya publicada (cancelación del repartidor con motivo, pagos manuales corregidos, retirada de transferencias SEPA, sustituciones con reembolso o pago de la diferencia y reservas de mesa).*
