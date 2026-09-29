# Informe de mejoras — ComeYa, versión 1.0.15 (12)

**Fecha:** 31 de agosto de 2026
**Ámbito:** correcciones solicitadas tras la prueba integral de la aplicación (cliente, negocio y repartidor)

## Resumen ejecutivo

Se implementaron las mejoras solicitadas en la prueba de calle: el pedido vuelve a pasar por la aceptación del negocio con su plazo de 10 minutos; las notificaciones push de los tres perfiles volvieron a funcionar tras la migración a la nueva cuenta de Expo; el flujo del repartidor incorpora controles de geolocalización y avisos de seguridad; la propina se ofrece únicamente después de confirmar la entrega, se cobra de forma real y se suma a las ganancias del repartidor; y los pedidos no tramitados se limpian automáticamente. Todo está disponible en la compilación 1.0.15 (12) para iOS y en el APK de Android.

## 1. Aceptación del pedido por el negocio

**Solicitado:** el pedido aparecía como "Aceptado" inmediatamente después del pago, sin intervención del negocio, y no se mostraba el aviso de los 10 minutos.

**Implementado:** al confirmarse el pago, el pedido queda en "Pago recibido — esperando aceptación" con una cuenta atrás de 10 minutos. El negocio ve el botón Aceptar y decide; si rechaza, el importe se reembolsa íntegramente al cliente. Si nadie responde en ese plazo, el pedido se cancela automáticamente con reembolso del 100 %.

**Cómo probarlo:** realizar un pedido con tarjeta y comprobar que aparece el recuadro de espera con la cuenta atrás; aceptar desde la cuenta del negocio y verificar que pasa a preparación; hacer un segundo pedido y rechazarlo para verificar el reembolso.

## 2. Notificaciones push

**Solicitado:** no llegaba ninguna notificación a cliente, negocio ni repartidor.

**Implementado:** se corrigió la configuración de notificaciones del proyecto en Expo (vinculación de las claves de Apple y de Google al proyecto) y el servidor utiliza la API de envío actualizada. Verificado con una entrega de prueba real aceptada por el servicio de notificaciones de Expo.

**Cómo probarlo:** hacer un pedido y comprobar que los tres perfiles reciben aviso en cada cambio de estado (pago recibido, aceptado, en preparación, listo, recogido, en camino, entregado y confirmado).

## 3. Flujo del repartidor

**Solicitado:** se podían cambiar estados sin estar en el sitio; se percibían saltos de pantalla; y el estado "esperando confirmación del cliente" no terminaba nunca aunque el cliente ya hubiera confirmado.

**Implementado:** la recogida solo puede confirmarse estando a menos de 250 metros del local y la entrega cerca del cliente, con foto obligatoria y avisos de seguridad en cada paso ("asegúrate de estar en el local y tener el pedido en tus manos"). Al confirmar el cliente, el pedido pasa a "Cliente confirmó — pago liberado" y se traslada a la sección de completadas. Después de cada cambio de estado la aplicación permanece en la misma pantalla, con la opción de abrir la ruta cuando el repartidor lo desee.

**Cómo probarlo:** aceptar un pedido como repartidor, intentar confirmar la recogida lejos del local (debe rechazarse), acercarse y confirmarla; entregar cerca del cliente con foto; verificar que tras la confirmación del cliente el pedido desaparece de "activos" y se muestra en "completadas".

## 4. Propinas

**Solicitado:** la propina no llegaba al repartidor y debía ofrecerse únicamente después de confirmar la entrega, nunca en el pago del pedido.

**Implementado:** la propina (1, 2, 3, 4 o 5 €) se ofrece solo tras la confirmación de la entrega, va íntegra al repartidor y se cobra de forma real al cliente por tres vías: tarjeta (cobro inmediato), Bizum o transferencia con comprobante (verificado por administración) o efectivo con confirmación de ambas partes. Queda reflejada en las ganancias del repartidor y en los informes mensuales.

**Cómo probarlo:** confirmar la entrega como cliente, valorar el pedido y elegir propina con cada una de las tres vías; comprobar que el repartidor la ve sumada en sus ganancias y que la propina por Bizum aparece en el panel del administrador para su verificación.

## 5. Inicio de sesión por SMS

**Solicitado:** no se podía copiar y pegar el código recibido por SMS.

**Implementado:** el código se escribe en un único campo que permite copiar y pegar de forma nativa en iOS y Android, además del autollenado automático cuando el sistema lo sugiere.

**Cómo probarlo:** iniciar sesión con un número registrado, copiar el código del SMS y pegarlo directamente en el campo.

## 6. Limpieza automática de pedidos

**Solicitado:** pedidos antiguos o no tramitados seguían apareciendo en los mapas.

**Implementado:** los pedidos sin aceptar se anulan a los 10 minutos; los aceptados sin repartidor, a las 2 horas; las recogidas en local abandonadas se cierran solas; y los pedidos de más de 24 horas dejan de mostrarse en los mapas de cliente, negocio, repartidor y administración.

**Cómo probarlo:** dejar un pedido sin aceptar y verificar que se cancela y reembolsa a los 10 minutos; comprobar que los mapas ya no muestran pedidos de días anteriores.

## 7. Panel de administración

**Solicitado:** disponer de la documentación de ganancias de cada repartidor para su facturación como autónomos.

**Implementado:** en Finanzas → "Repartidores", el resumen de ganancias mensuales por repartidor (entregas, propinas por la plataforma y propinas en efectivo); en Finanzas → "Propinas", la verificación de propinas enviadas por Bizum o transferencia.

**Cómo probarlo:** entrar con la cuenta de administrador, seleccionar el mes y comprobar que cada repartidor muestra sus entregas, ganancias y propinas; verificar o rechazar una propina pendiente.

## 8. Sustituciones de productos (verificado en esta prueba)

Confirmado el funcionamiento: cada sustitución muestra la foto del producto en los estados del pedido; si el sustituto es más barato, la diferencia se reembolsa automáticamente; si es más caro, el cliente la aprueba y paga la diferencia con tarjeta.

## Notas adicionales de la prueba

- La numeración pública de pedidos (#CY…) es correcta y consecutiva.
- El seguimiento GPS funciona en los tres perfiles; el mapa del repartidor indica el destino según la fase (negocio al recoger, cliente al entregar).

## Cuentas de prueba

| Perfil | Correo | Contraseña |
|---|---|---|
| Cliente | customer@comeya.es | password |
| Negocio | business@comeya.es | password |
| Repartidor | delivery@comeya.es | password |
| Administrador | admin@comeya.es | password |

Tarjeta de pago de prueba: 4242 4242 4242 4242 (cualquier fecha futura y CVC).
