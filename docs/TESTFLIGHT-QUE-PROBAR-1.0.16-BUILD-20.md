# Texto para TestFlight → «Qué se debe probar»

Texto plano (sin emojis, sin formato) para pegar en App Store Connect →
TestFlight → Detalles sobre las pruebas → **Qué se debe probar**
(versión en español, campo de 4.000 caracteres).

---

GUÍA DE PRUEBA - ComeYa 1.0.16 (build 20)

Corrige los puntos reportados en la revisión anterior. Al reportar un fallo,
indica el apartado, el rol, el número de pedido o de reserva y una captura.

1. TIEMPOS DE ENTREGA (rol cliente)
- Haz un pedido de reparto: el tiempo debe salir entre 25 y 35 minutos, no en
  5 como antes.
- Bajo el tiempo debe leerse "Incluye el reparto y X min de cocina" o "Incluye
  que el repartidor recoja tu pedido".
- Debe ir bajando poco a poco, sin saltos bruscos.
- El aviso "Tu pedido llega en 5 minutos" solo debe llegar cuando el repartidor
  ya ha recogido el pedido, nunca antes.

2. SEGUIMIENTO DEL REPARTIDOR EN EL MAPA (rol cliente)
- Con el pedido en camino, el icono del repartidor debe deslizarse de forma
  continua, no a saltos.
- Bajo el tiempo aparece "Ubicación en tiempo real". Si el repartidor pierde
  cobertura cambia a "Ubicación actualizada hace X s" en ámbar: eso es
  correcto, no es un fallo.

3. MAPA (roles cliente y negocio)
- En iPhone debe mostrar calles, nombres y comercios (antes se veía en blanco).
- Los negocios aparecen como puntos de color. Al tocar uno se despliega su
  nombre y el mapa se centra. Los nombres no deben amontonarse.

4. RESERVA DE MESA (rol cliente)
- Reserva una mesa: al terminar NO debe aparecer ningún código, sino el aviso
  de que el restaurante la confirmará.
- En "Mis reservas" debe quedar "Pendiente de confirmar" y sin código.
- Solo cuando el restaurante la confirme aparece el código CY-XXXX, y debe
  verse completo, sin recortar.
- Ya no debe existir la opción de pedir platos por adelantado.

5. RESERVAS (rol negocio)
- En la barra inferior hay un botón redondo de "Reservas" en el centro.
- Con una reserva pendiente, pulsa Confirmar: debe pasar a confirmada y el
  cliente debe recibir el aviso con su código.
- La agenda agrupa por hora: cada franja muestra sus comensales y su coste, y
  cada reserva su desglose (4 x 0,99 EUR + 0,49 EUR de servicio = 4,45 EUR).
- Los filtros "Por confirmar / Confirmadas / Todas" con su contador, y el
  resumen del día arriba.
- En los ajustes ya no debe existir la confirmación automática.

6. COSTE DE SERVICIO (rol cliente)
- En un pedido entregado, el desglose debe ser Subtotal, Envío, Coste de
  servicio y Total, y las líneas deben sumar exactamente el total.
- En un pedido de recogida en local no hay envío, pero sí debe aparecer el
  coste de servicio.
- La factura en PDF debe llevar el mismo desglose y cuadrar igual.

7. OTRAS CORRECCIONES
- "Explorar Negocios": título y flecha de volver sin quedar pegados al borde
  superior, la flecha debe funcionar y las pestañas leerse completas.
- "Hazte VIP": la flecha de volver debe funcionar.
- "Mis Pedidos": lo que no llega a concretarse desaparece pasadas 24 horas.
- "Mis Reservas": una reserva cuya hora ya pasó no debe seguir en Activas.
- "Mi Negocio" (rol negocio): "Acciones rápidas" sin palabras entrecortadas y
  la descripción de "Sistema de Pagos" completa.
- Categorías en la pantalla de inicio, en este orden: España, Oriental,
  Mexicana, Pollo, Hamburguesas, Pizzas.
- "Alimentación": la descripción en verde debe verse completa.
- Logo: icono y pantalla de inicio con el logo nuevo, sin bandas naranjas.

8. REPARTIDOR (rol repartidor)
- Al aceptar un pedido, el cliente no debe recibir el aviso de 5 minutos de
  inmediato.
- En ruta la posición se envía cada 1,5 segundos: el seguimiento debe moverse
  de forma fluida.
- Debe seguir disponible cancelar con motivo (avería, tráfico, personal u otro).

IMPORTANTE: comprueba que la compilación instalada es la 1.0.16 (20). Con una
anterior verás el comportamiento viejo.
