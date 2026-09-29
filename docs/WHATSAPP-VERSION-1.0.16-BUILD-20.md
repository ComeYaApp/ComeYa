# Mensaje de WhatsApp — versión 1.0.16 (build 20)

Mensaje listo para copiar y pegar en WhatsApp. Usa el formato propio de
WhatsApp: `*negrita*`, `_cursiva_`.

Si te resulta demasiado largo de una vez, se puede partir en tres mensajes en
los cortes marcados con `─── CORTE ───`.

---

Hola 👋 Ya está lista la versión con todas las modificaciones que pediste. Te
resumo lo hecho y cómo probarlo.

📱 *LOGO*
Icono y pantalla de inicio nuevos, con el logo oficial sobre el rojo de marca.
Ya no salen las bandas naranjas al abrir la app.

⏱️ *TIEMPOS DE ENTREGA — ya no dicen "5 minutos"*
El tiempo ahora suma las tres partes: lo que tarda el repartidor en llegar al
restaurante + lo que queda de cocina + el reparto hasta tu casa. Antes solo
contaba el reparto, y por eso un pedido recién hecho decía "llega en 5 min".
El aviso de "tu pedido llega en 5 minutos" ahora solo llega cuando el
repartidor *ya lleva el pedido encima*. Es decir: el aviso es real.

🛵 *GPS EN TIEMPO REAL*
El repartidor se mueve en el mapa de forma continua, no a saltos. Ahora envía
su posición cada 1,5 segundos cuando está en marcha (antes cada 2 fijos) y el
mapa del cliente se refresca cada segundo. Y si el dato se queda viejo, el
cliente ve "actualizada hace X s" en ámbar en lugar de una posición falsa.

🗺️ *MAPAS — encontrado el fallo de iOS*
El mapa salía en blanco (sin calles ni negocios) porque la clave de Google
Maps que había guardada tenía *una sola letra en mayúscula cambiada* y Google
la rechazaba como inválida. Ya está corregida y verificada contra la API.
Además, los nombres de los negocios ya no se amontonan unos sobre otros: solo
se despliega el nombre del que tocas, el resto son puntos. Y en Android el
mapa también carga calles.

📅 *RESERVAS — ahora las confirmas tú*
Antes se confirmaban solas (la auto-confirmación venía activada por defecto),
así que el cliente daba la mesa por segura sin que tú la hubieras visto. Ahora:
• Toda reserva nace *pendiente y sin código*: la confirmas tú y solo entonces
el cliente recibe su código de mesa.
• Tienes un *botón central de Reservas* fijo abajo, siempre a un toque.
• La agenda va *agrupada por hora*: "18:00 · 4 comensales · 4,45 €", y en cada
reserva el cálculo completo: 4 × 0,99 € + 0,49 € de servicio = 4,45 €.
• Filtros Por confirmar / Confirmadas / Todas, y resumen del día (comensales,
cuántas sin confirmar y coste total).
• El cliente recibe aviso al reservar y otro al confirmar, y su lista se
actualiza sola.
• Las reservas que no se concretan desaparecen solas.
• Arreglado el código de confirmación que salía cortado.
• *Quitado el pedido anticipado*, como pediste.

💶 *COSTE DE SERVICIO (0,49 €)*
Ya se cobraba, pero no se veía en ningún sitio. Ahora aparece desglosado en:
• La ficha de cada pedido, *también en los de recogida en local* (donde no hay
envío, pero sí servicio)
• La factura PDF descargable, con las líneas cuadrando con el total
• Las finanzas del negocio (que además ya no inflaban las ganancias)
• El panel de administración: los ingresos ya incluyen el coste de servicio
• La agenda de reservas, con las dos tarifas (0,99 €/comensal + 0,49 €)

🔧 *OTROS ARREGLOS*
• Explorar Negocios: el título y la flecha ya no se van al borde de la pantalla
y la flecha funciona
• Hazte VIP: la flecha de volver ya funciona
• Mis Pedidos: los pedidos sin concretar desaparecen a las 24 h
• Mis Reservas: las reservas no concretadas desaparecen
• Acciones rápidas: las palabras ya no salen entrecortadas
• Descripción de "Sistema de Pagos" cambiada por la que pediste
• Orden de categorías: España, Oriental, Mexicana, Pollo, Hamburguesas, Pizza
• Descripción de Alimentación cambiada por la que pediste

─── CORTE ───

✅ *CÓMO PROBARLO*
1️⃣ Haz un pedido de reparto: el tiempo debe salir sobre 25-35 min (no 5) y
bajar de verdad. El pin del repartidor se mueve seguido en el mapa.
2️⃣ Reserva una mesa: debe quedar *Pendiente* y SIN código. Confírmala desde el
apartado Reservas del negocio y verás que al cliente le llega el aviso con su
código.
3️⃣ Abre un pedido entregado: Subtotal + Envío + Coste de servicio = Total.
Descarga la factura y comprueba que cuadra igual.
4️⃣ Abre el mapa en el iPhone: deben verse calles y los negocios como puntos.
5️⃣ En tu panel, mira "Acciones rápidas" y "Sistema de Pagos".

⚠️ *IMPORTANTE antes de probar*
Los tiempos, las reservas y los costes se calculan en el *servidor*, no en la
app. Necesito confirmar que el servidor está actualizado (se despliega solo
cuando subo los cambios a Git). Si pruebas con la app nueva pero el servidor
viejo, las reservas seguirán confirmándose solas y los tiempos seguirán mal
—y parecería que no se ha hecho nada—. Avísame cuando vayas a probar y lo
compruebo antes.

─── CORTE ───

🔵 *LO QUE DEPENDE DE TI*

• *Nombre del desarrollador en la App Store*: sigue apareciendo "RAUL
ALEXANDER VARGAS PUJOTA" porque la cuenta de Apple es de persona física. Para
que salga un nombre de empresa hay que convertirla en cuenta de *organización*
(hace falta CIF y número D-U-N-S). Es un trámite que solo puedes hacer tú con
Apple: no se puede cambiar desde el código de la app.

• *Capturas de la App Store*: me dijiste que me pasarías los datos aparte. El
icono nuevo ya está listo para la ficha.

• *Facturas para la contabilidad trimestral*: ya tienes el desglose completo de
cada pedido en la ficha, en el PDF y en un CSV que exporta el administrador,
así puedes cuadrar pedido a pedido. Para la factura fiscal propiamente dicha
(con IVA desglosado, numeración por serie y resumen trimestral) necesito:
  1. Razón social y NIF de ComeYa
  2. Dirección fiscal
  3. Si la factura al cliente la emite ComeYa por el importe total, o si el
  restaurante factura a ComeYa su parte
En cuanto me lo pases, lo completo.

📄 Hay 5 puntos del documento que me enviaste que salían sin texto (solo el
número y una captura). Dos son del mapa y ya están cubiertos; los otros tres
aparecen marcados en el informe. Si alguno era un cambio concreto, dime cuál y
lo añado.

Te dejo el detalle completo, con todas las pruebas paso a paso, en el informe
de la versión 1.0.16 (build 20). 🙌
