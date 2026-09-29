# Mensaje de WhatsApp — versión 1.0.16 (build 20)

Mensaje listo para copiar y pegar de una sola vez. Formato de WhatsApp
(`*negrita*`, `_cursiva_`).

---

Hola 👋 Ya está lista la versión *1.0.16 (build 20)* con todo lo que pediste. Te dejo el resumen completo de los cambios y, al final, cómo probar cada cosa.

*📱 LOGO*
Cambiado tanto el icono de la app como el de la pantalla de inicio, con el logo oficial sobre el rojo de marca. Ya no aparecen las bandas naranjas al abrir la app.

*⏱️ TIEMPOS DE ENTREGA — ya no dicen "5 minutos"*
Antes el tiempo que veía el cliente solo contaba el tramo del repartidor hasta su casa: no sumaba ni el viaje del repartidor al restaurante ni lo que quedaba de cocina. Por eso un pedido recién hecho anunciaba "llega en 5 minutos".
Ahora se calcula en tres partes: repartidor → restaurante, lo que queda de preparación y restaurante → cliente. Mientras el pedido no esté recogido se muestra la suma completa.
Y el aviso de "tu pedido llega en 5 minutos" ahora solo se envía cuando el repartidor *ya lleva el pedido*, que es cuando el dato es cierto. La ficha del pedido explica el número: "Incluye el reparto y X min de cocina".

*🛵 GPS EN TIEMPO REAL*
• El repartidor envía su posición cada 1,5 segundos cuando está en marcha (antes cada 2 fijos), y el servidor la reenvía cada segundo (antes cada 2).
• El mapa del cliente se refresca cada 15 segundos en lugar de cada 30.
• Si se cae el websocket, el respaldo pasa de 5 a 3 segundos.
• Nuevo indicador de frescura: "Ubicación en tiempo real", y si el dato tiene más de 45 segundos cambia a "Ubicación actualizada hace X s" en ámbar. Así nunca se muestra una posición vieja como si fuera la actual.

*🗺️ MAPAS — eran dos problemas y los dos están resueltos*
• El mapa de iOS salía en blanco (solo el fondo y el logo de Google): la clave de Google Maps que había guardada tenía *una sola letra en mayúscula cambiada* y Google la rechazaba como inválida. Corregida y verificada. Y si algún día faltara, la app usa Apple Maps en vez de quedarse en blanco.
• Los nombres de los negocios se amontonaban porque todos tenían coordenadas de relleno dentro de un radio de 500 metros. Ahora solo el negocio que tocas despliega su nombre; el resto son puntos de color. He dejado preparado también el proceso para rellenar las coordenadas reales desde la dirección de cada negocio.

*📅 RESERVAS — ahora las confirmas tú*
Este era el punto clave: los negocios tenían la auto-confirmación activada por defecto, así que la reserva nacía confirmada con código sin que el restaurante la hubiera visto. El cliente daba la mesa por segura y tú te enterabas tarde.
• Toda reserva nace *pendiente y sin código*. La confirmas tú y solo entonces el cliente recibe su código de mesa.
• Quitada la opción de confirmación automática y desactivada en los negocios que la tenían puesta.
• El cliente recibe un aviso al reservar y otro al confirmar, y su lista se actualiza sola en cuanto la aceptas.
• Arreglado el código de confirmación que salía cortado: era un fallo de estilo (texto de 34 px con altura de línea de 24, iOS lo recortaba).
• *Eliminado el pedido anticipado*, como pediste.

Apartado *RESERVAS* del negocio:
• Botón central de Reservas fijo en la barra de abajo, siempre a un toque.
• Agenda *agrupada por hora*: "18:00 · 4 comensales · 4,45 €", y en cada reserva el desglose completo: 4 × 0,99 € + 0,49 € de servicio = 4,45 €.
• Filtros *Por confirmar / Confirmadas / Todas* con contador, y resumen del día: comensales totales, cuántas sin confirmar y coste total ComeYa de la jornada.
• Las reservas que nadie confirma caducan solas y dejan de aparecer como activas; las confirmadas a las que no se presenta nadie pasan a "No vino", sin coste.

*💶 COSTE DE SERVICIO (0,49 €)*
Ya se cobraba, pero no se veía en ninguna parte. Ahora aparece desglosado en:
• La ficha de cada pedido (Subtotal / Envío / Coste de servicio / Total), *también en los pedidos de recogida en local*, donde no hay envío pero sí servicio.
• La factura PDF descargable, con las líneas cuadrando exactamente con el total.
• Las finanzas del negocio, que además ya no suman los subtotales con el markup incluido (eso inflaba las ganancias).
• El panel de administración: los ingresos de plataforma ya incluyen el coste de servicio (antes solo contaban el markup, así que la contabilidad salía a la baja). El detalle del pedido y el CSV llevan base del producto, markup, coste de servicio, envío y total.
• La agenda de reservas y los ajustes muestran las dos tarifas (0,99 € por comensal + 0,49 € por reserva) con un ejemplo calculado.

*🔧 RESTO DE CORRECCIONES QUE PEDISTE*
• Explorar Negocios: el título y la flecha ya no se van al borde superior, la flecha funciona y las pestañas ya no se cortan.
• Hazte VIP: la flecha de volver ya funciona (era el mismo problema del borde).
• Mis Pedidos: los pedidos que no llegan a concretarse desaparecen a las 24 horas.
• Mis Reservas: las reservas que no se concretaron desaparecen.
• Acciones rápidas: las palabras ya no salen entrecortadas.
• Descripción de "Sistema de Pagos": cambiada por la que me diste.
• Orden de las categorías: España, Oriental, Mexicana, Pollo, Hamburguesas, Pizza.
• Descripción de Alimentación: cambiada por la que me diste.
• GPS del negocio y del cliente: revisado, era el mismo problema de la clave del mapa.

*✅ CÓMO PROBARLO*

_Como cliente:_
1. Haz un pedido de reparto. El tiempo debe salir sobre 25-35 minutos, no 5, con la explicación debajo ("Incluye el reparto y X min de cocina"), y debe ir bajando solo.
2. Con el pedido en camino, abre el mapa: el pin del repartidor se mueve seguido y debajo pone "Ubicación en tiempo real".
3. Reserva una mesa: debe quedar *Pendiente de confirmar* y SIN código, avisando de que el restaurante la confirmará.
4. Abre un pedido entregado: Subtotal + Envío + Coste de servicio = Total. Descarga la factura y comprueba que cuadra igual.
5. Prueba también un pedido de recogida en local: no hay envío, pero sí aparece el coste de servicio.
6. En "Mis reservas", el código debe verse completo en una reserva ya confirmada.

_Como negocio:_
1. Mira la barra de abajo: hay un botón redondo de *Reservas* en el centro.
2. Con una reserva pendiente, pulsa *Confirmar*: pasa a confirmada y al cliente le llega el aviso con su código (comprueba que ya no se confirma sola).
3. En la agenda, cada hora aparece con sus comensales y su coste, y cada reserva con el desglose 4 × 0,99 € + 0,49 €.
4. Abre los ajustes de reservas: ya no está la confirmación automática, y la tarifa muestra las dos partes con un ejemplo.
5. En "Mi Negocio", revisa que "Acciones rápidas" y "Sistema de Pagos" se lean completos.
6. Entra en Finanzas: las ganancias ya no incluyen el markup y se indica cuánto markup y cuánto coste de servicio se han descontado.

_Como repartidor:_
1. Acepta un pedido: el cliente ya no recibe "llega en 5 minutos" al instante, sino cuando de verdad faltan 5 minutos con el pedido ya recogido.
2. En ruta, tu posición se actualiza cada 1,5 segundos: el pin del cliente debe deslizarse, no saltar.
3. Sigue estando disponible cancelar con motivo (avería, tráfico, problema personal u otro).

_Como administrador:_
1. Los ingresos de plataforma ya incluyen el coste de servicio de cada pedido.
2. El detalle del pedido muestra la línea de coste de servicio.
3. Exporta el CSV: lleva base productos, markup, coste de servicio, envío y total cobrado, pedido a pedido. Es lo que necesitas para cuadrar la contabilidad trimestral.

*🔵 LO QUE DEPENDE DE TI*
• *Nombre del desarrollador en la App Store*: sigue apareciendo "RAUL ALEXANDER VARGAS PUJOTA" porque la cuenta de Apple es de persona física. Para que salga un nombre de empresa hay que convertirla en cuenta de *organización*, y eso necesita CIF y número D-U-N-S. Es un trámite que solo puedes hacer tú con Apple: no se puede cambiar desde el código de la app.
• *Capturas de la App Store*: me dijiste que me pasarías los datos aparte. El icono nuevo ya está listo para la ficha.
• *Facturas para la contabilidad trimestral*: ya tienes el desglose completo de cada pedido en la ficha, en el PDF y en un CSV del administrador. Para la factura fiscal propiamente dicha (con IVA desglosado, numeración por serie y resumen trimestral) necesito: razón social y NIF de ComeYa, dirección fiscal, y si la factura al cliente la emite ComeYa por el importe total o si el restaurante factura a ComeYa su parte.

📄 De tu documento hay 5 puntos que llegaron sin texto (solo el número y una captura). Dos están entre capturas del mapa, así que los di por cubiertos con la corrección de mapas; los otros tres van marcados en el informe que te paso. Si alguno era un cambio concreto, dime cuál y lo añado.
