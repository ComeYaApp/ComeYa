CÓMO PROBAR ESTA VERSIÓN (1.0.16 build 22)

Nota: para pegar en App Store Connect (TestFlight > Qué se debe probar) usa la versión
limpia de docs/TESTFLIGHT-QUE-PROBAR-1.0.16-BUILD-22-APPSTORE.txt: ese campo rechaza
emojis, flechas y checkmarks, y admite un máximo de 4.000 caracteres.

Antes de empezar:
- Comprueba en Ajustes que la versión instalada es la 1.0.16 (22).
- Los cambios de propinas, repartidor, tiempos y sesión necesitan el SERVIDOR ACTUALIZADO. Si algo no funciona como se describe aquí, avisa antes de darlo por malo: puede ser que falte desplegar.
- Importante con las propinas de tarjeta: Stripe está en producción, así que la tarjeta COBRA DE VERDAD. Para probar usa 1 € (y devuélvelo desde Stripe si quieres) o usa el canal Bizum/transferencia, que no cobra al momento.
- Si algo falla, avisa indicando la sección, el rol con el que probabas, el número de pedido y una captura.

1. PROPINA (rol cliente) — pedido ya entregado y confirmado
a) Entra en Mis Pedidos: el pedido entregado y confirmado debe mostrar el botón "Dar propina".
b) Tócalo, elige 3 €, paga con Tarjeta → debe cerrarse con "Propina enviada 💝" y el botón del pedido queda en "Propina enviada".
c) Vuelve a entrar al mismo pedido y dale otra vez: NO debe dejar pagar de nuevo (queda "Propina enviada 💝").
d) En otro pedido, usa "Otra cantidad" (por ejemplo 7,50 €), elige Bizum/Transf., adjunta el comprobante y envía → debe quedar "pendiente de verificación".
e) Comprueba que un pedido SIN confirmar la entrega todavía no ofrece propina (no aparece el botón).
f) Entra al seguimiento de un pedido entregado: junto a "Entrega confirmada ✔" debe estar también el botón "Dar propina".
g) Comprueba que en un pedido de recogida en el local no aparece (no hay repartidor).

2. PROPINA (rol repartidor)
a) Con la propina de tarjeta pagada, al repartidor debe llegarle el aviso "💝 ¡Recibiste una propina!" y verla en Ganancias.
b) En sus entregas ya NO debe aparecer "Registrar propina en efectivo".

3. PROPINA (rol administración)
a) Con la propina de Bizum/transferencia: Admin → Finanzas → "propinas pendientes de verificación" debe mostrar el comprobante y permitir verificar o rechazar.
b) Al verificar, el repartidor recibe el aviso y la propina aparece en sus ganancias.

4. REPARTIDOR — registro completo con documentos
a) Con una cuenta de prueba: Perfil → Ser Repartidor → rellena todo: foto de perfil, INE anverso, INE reverso, foto del vehículo, licencia (si aplica), CLABE, contacto de emergencia → Enviar → debe decir "Solicitud enviada. Espera aprobación del admin".
b) Como admin: Verificaciones → la solicitud debe aparecer con los documentos visibles y el aviso "Documentos completos — puede aprobarse" → Aprobar.
c) Como repartidor: cierra sesión y vuelve a entrar → el interruptor de disponible ya debe funcionar; actívalo y comprueba que puede recibir y aceptar pedidos.

5. REPARTIDOR — bicicleta sin papeleo de coche
a) Envía una solicitud con tipo "Bicicleta", sin matrícula y sin permiso de circulación → el admin debe poder aprobarla (antes era imposible: exigía documentos de coche).

6. REPARTIDOR — Hernán / documentos que se reenvían
a) Hernán entra en Ser Repartidor y reenvía sus documentos (sobre todo el INE anverso y el reverso).
b) Admin → Verificaciones: debe poder verlos y aprobarlo.
c) Prueba importante: que reenvíe un documento estando YA aprobado → debe seguir pudiendo activar el reparto (antes se quedaba en "pendiente de aprobación" y bloqueado).

7. TIEMPOS DE ENTREGA (rol cliente)
a) Haz un pedido y mira el tiempo durante la preparación: debe mantenerse estable, con ajustes pequeños; no debe subir y bajar cada pocos segundos.
b) Cuando el repartidor llegue al negocio, el número no debe alternar (sumar y quitar minutos).
c) Al recoger el pedido: el tiempo baja una vez de forma razonable y a partir de ahí va bajando, sin rebotar hacia arriba.
d) La hora de llegada que se muestra debe ser coherente con los minutos restantes y con la posición del repartidor en el mapa.

8. PANEL DEL NEGOCIO (rol negocio)
a) Abre la app con la cuenta del negocio: deben verse el negocio y sus productos.
b) Pasa la app a segundo plano y vuelve: debe seguir todo bien.
c) Tira para refrescar: debe recargar los datos y los negocios.
d) Si alguna vez aparece "Sin negocio registrado": cierra y abre la app, o tira para refrescar; debe recuperarse solo (ya no hace falta reinstalar ni volver a iniciar sesión).
