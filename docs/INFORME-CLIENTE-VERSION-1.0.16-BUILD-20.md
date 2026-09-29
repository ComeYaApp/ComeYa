# ComeYa 1.0.16 (build 20) — Informe de cambios

Resumen de todo lo corregido a partir del documento
«Comeya - últimas modificaciones y mejoras» y de las notas de voz.

> Se mantiene la versión **1.0.16** porque todavía no está publicada en la
> App Store: este envío es el **build 20** de esa misma versión (los builds
> 15-19 ya estaban subidos a TestFlight). En Android es el **versionCode 24**.

---

## 1. Tiempo de entrega: ya no dice "llega en 5 minutos" cuando no es verdad

**Qué pasaba.** El tiempo que veía el cliente solo contaba el trayecto del
repartidor desde donde estuviera hasta su casa. No sumaba ni el viaje del
repartidor al restaurante ni lo que le quedaba de cocina. Además el aviso de
«¡Tu pedido llega en 5 minutos!» se enviaba en cualquier estado, incluso con
el pedido recién hecho y todavía sin repartidor asignado — exactamente lo que
se ve en la captura del pedido #CY000415.

**Qué se ha hecho.**

- El tiempo ahora se calcula en **tres tramos**: repartidor → restaurante,
  lo que queda de preparación y restaurante → cliente. Mientras el pedido no
  esté recogido se muestra la suma completa.
- Una vez el repartidor tiene el pedido, el tiempo es solo el de reparto real
  por calles (Google Directions).
- El aviso de 5 y 2 minutos **solo se envía cuando el repartidor ya lleva el
  pedido encima**, que es cuando el dato es cierto.
- Se han eliminado varios suelos artificiales que forzaban mínimos de 5 min.
- La ficha del pedido explica el número: «Incluye el reparto y 15 min de
  cocina» o «Tiempo real del repartidor hasta tu dirección».

## 2. GPS y seguimiento en tiempo real

**Qué pasaba.** El repartidor solo enviaba su posición cada 2 s, el servidor
la reenviaba cada 2 s más, y si el websocket no conectaba el mapa se
actualizaba cada 5 s. El resultado: el pin se movía a saltos y parecía
congelado.

**Qué se ha hecho.**

- El repartidor envía su posición cada **1,5 s en movimiento** (antes 2 s
  fijos) y cada 15 s parado, para no gastar batería sin motivo.
- El servidor reenvía cada **1 segundo** mientras se mueve (antes 2 s).
- Si el websocket falla, el respaldo por peticiones baja de 5 s a **3 s**.
- La pantalla de seguimiento refresca el estado del pedido y el tiempo cada
  **15 s** (antes 30 s).
- Se ha añadido un indicador de frescura: «Ubicación en tiempo real» o
  «Ubicación actualizada hace X s», en ámbar cuando el dato tiene más de 45 s.
  Así nunca se muestra una posición vieja como si fuera la actual.

## 3. Mapas que no cargaban calles ni negocios

Eran **dos problemas distintos**:

**a) El mapa de iOS salía en blanco (solo el fondo y el logo de Google).** La
causa era la clave de Google Maps para iOS. Se ha verificado la clave nueva y
se ha encontrado un error importante: la que había guardada tenía **una letra
en mayúscula cambiada** y Google la rechazaba como inválida. Ya está corregida
y declarada también en la configuración de compilación (EAS), que es donde
faltaba para que llegara a la app publicada.

Además, si algún día faltara la clave, el mapa de iOS usará Apple Maps
automáticamente en vez de quedarse en blanco.

**b) Todas las etiquetas de negocios salían amontonadas.** Todos los negocios
tenían coordenadas de relleno dentro de un radio de ~500 m del centro, así que
sus nombres se pisaban unos a otros. Ahora solo el negocio seleccionado
muestra su tarjeta con el nombre; el resto son puntos de color, y al tocar uno
se centra el mapa y se despliega su nombre.

Se ha añadido además un script (`scripts/geocode-businesses.ts`) para
rellenar las coordenadas reales de cada negocio a partir de la dirección que
ya tienen registrada, en cuanto se ejecute en el servidor.

## 4. Reservas: ahora las confirma el restaurante

**Qué pasaba.** Los negocios tenían activada la «confirmación automática», así
que la reserva nacía confirmada con código sin que el restaurante la hubiera
visto. El cliente daba la mesa por segura y el restaurante se enteraba tarde.

**Qué se ha hecho.**

- **Todas las reservas nacen pendientes y sin código.** El restaurante las
  confirma una a una; solo entonces el cliente recibe el código de mesa.
- Se ha quitado la opción de confirmación automática de los ajustes y se ha
  desactivado en los negocios que la tenían puesta.
- El cliente recibe un aviso de «Reserva solicitada» al reservar y otro de
  «Reserva confirmada» con el código cuando el restaurante la acepta. La lista
  de «Mis reservas» se actualiza sola en cuanto se confirma, sin necesidad de
  reabrir la pantalla.
- **Código entrecortado:** era un fallo de estilo (el texto tenía 34 px pero
  heredaba una altura de línea de 24 px, así que iOS lo recortaba). Arreglado.

**Apartado RESERVAS del negocio.**

- Botón central de **Reservas** fijo en la barra inferior, siempre a un toque.
- La agenda agrupa por franja horaria con el total de comensales y el coste:
  `18:00 · 4 comensales · 4,45 €`, `20:00 · 2 comensales · 2,47 €`.
- Cada reserva muestra su coste desglosado: `4 × 0,99 € + 0,49 € servicio =
  4,45 €`.
- Filtros «Por confirmar / Confirmadas / Todas» con contador, y resumen del
  día: comensales totales, cuántas sin confirmar y coste total de ComeYa.

**Reservas que no se concretan.** Una reserva que nadie confirma a tiempo
caduca y desaparece de la lista de activas; una confirmada a la que no se
presenta nadie pasa a «No vino» (sin coste para el negocio). Se cierran solas
cada 15 minutos, así que las listas ya no se llenan de reservas viejas.

## 5. Pedido anticipado eliminado

Se ha quitado por completo la opción de pedir platos por adelantado junto con
la reserva, tal y como se pidió, para evitar conflictos por productos no
disponibles o por comensales que finalmente no aparecen. Ahora la reserva es
solo de mesa y los platos se piden al llegar.

## 6. Coste de servicio: reflejado en cada pago

El coste de 0,49 € ya se cobraba, pero **no se veía en ninguna parte**. Ahora:

- **Ficha del pedido del cliente:** línea «Coste de servicio» separada del
  envío, también en los pedidos de recogida en local (no hay reparto, pero sí
  servicio).
- **Factura en PDF:** incluye «Subtotal productos», «Envío», «Coste de
  servicio ComeYa», «Propina» y «Descuentos», de forma que las líneas suman
  exactamente el total. Los pedidos de recogida ya no aparecen con envío.
- **Finanzas del negocio:** ya no se suman los subtotales con el markup
  incluido (eso inflaba las «ganancias»). Ahora se muestra lo que el negocio
  ingresa de verdad y el desglose de lo que paga el cliente.
- **Panel de administración:** los ingresos de la plataforma ya incluyen el
  coste de servicio (antes solo contaban el markup, así que la contabilidad de
  ComeYa salía a la baja). El detalle del pedido y el CSV de exportación
  incluyen el desglose completo: base del producto, markup, coste de servicio,
  envío y total.
- **Reservas:** el negocio ve las dos tarifas (0,99 €/comensal + 0,49 € por
  reserva) con un ejemplo calculado.

## 7. Logo e identidad

- **Icono de la app** regenerado desde el logo oficial: el círculo con el
  anillo blanco sobre el rojo de marca, con margen suficiente para que iOS no
  lo recorte. Antes apuntaba a una imagen con bandas.
- **Pantalla de carga:** era la imagen con las bandas naranjas arriba y abajo
  que se ve en la captura. Ahora es el logo centrado sobre rojo liso.
- Generados también el icono adaptativo de Android y el favicon de la web.
- Versión subida a **1.0.17** (build 20 en iOS, versionCode 24 en Android).
- Script `scripts/generate-brand-assets.js` para poder regenerarlos si el logo
  cambia.

**Pendiente por parte del cliente (no es código):**

- **Nombre del desarrollador en la App Store.** Aparece «RAUL ALEXANDER
  VARGAS PUJOTA» porque la cuenta de Apple es de persona física. Para que
  aparezca un nombre de empresa hay que convertir la cuenta de Apple Developer
  en cuenta de organización (requiere NIF/CIF de empresa). No se puede cambiar
  desde el código.
- **Capturas y previsualización de la App Store** (indicaste que enviarías los
  datos aparte) y las notas de la versión.

## 8. Correcciones de interfaz del documento

| Punto | Estado |
|---|---|
| Explorar Negocios: título y flecha pegados al borde, flecha que no funcionaba | Corregido (faltaba el margen del notch) |
| Pestaña «Restaurantes» cortada/pisada | Corregido: texto en una línea que se ajusta solo |
| Alimentación: nueva descripción en verde | Texto cambiado al solicitado |
| Orden de las categorías de comida | España, Oriental, Mexicana, Pollo, Hamburguesas, Pizza |
| Mis Pedidos: pedidos sin concretar desaparecen a las 24 h | Corregido |
| Mis Reservas: reservas no concretadas desaparecen | Corregido |
| Hazte VIP: la flecha de volver no funcionaba | Corregido (mismo problema del notch) |
| Acciones Rápidas: palabras entrecortadas | Corregido |
| Descripción de «Sistema de Pagos» | Texto cambiado al solicitado |
| Mapa del negocio y del cliente que no cargaba calles | Corregido (ver punto 3) |
| Aviso de 5 minutos al cliente | Corregido (ver punto 1) |
| GPS del repartidor «básico» | Mejorado (ver punto 2) |

---

## Cómo probarlo

1. **Tiempo realista:** haz un pedido de reparto y comprueba que el tiempo
   inicial ronda los 25-35 min y que baja conforme avanza, sin saltar a
   «5 minutos» antes de que el repartidor recoja.
2. **Reserva:** reserva mesa desde la app. Debe quedar «Pendiente de
   confirmar» y sin código. Confírmala desde el negocio (botón central
   Reservas) y verifica que al cliente le llega el aviso con el código.
3. **Coste de servicio:** abre un pedido entregado y descarga la factura; las
   líneas deben sumar exactamente el total.
4. **Mapa:** abre el mapa en iOS. Deben verse calles, nombres y los puntos de
   los negocios sin amontonarse.
