# ComeYa 1.0.16 (build 22) — notas de versión

**Versión**: 1.0.16 (misma versión, solo sube el número de compilación) · versionCode 25
**Fecha**: 5 de octubre de 2026
**Base**: corrige lo que el cliente detectó en las pruebas de delivery del 5 de octubre

---

## 1. Propina al repartidor: la decide y la paga el cliente, cuando quiere

Antes el cliente no podía dar propina después de confirmar la entrega, y al repartidor le
salía un aviso pidiéndole registrar "propina en efectivo" (justo al revés de lo acordado).

- Botón **Dar propina** en todo pedido **entregado y confirmado**: en **Mis Pedidos** y en
  el **seguimiento**, en cualquier momento y **aunque el pedido ya esté valorado**.
- Importes rápidos **1–5 €** y **otra cantidad** (importe libre).
- Dos canales:
  - **Tarjeta** (Stripe): se cobra al momento y el abono al repartidor se hace en cuanto
    Stripe confirma el pago; el repartidor recibe el aviso.
  - **Bizum/transferencia** con comprobante: Administración lo verifica en
    **Admin → Finanzas → propinas pendientes** y entonces se abona.
- El pedido queda marcado **"Propina enviada 💝"** (o "pendiente de verificación") y **no se
  puede volver a cobrar**.
- Si el pedido no tiene repartidor (recogida en el local) no se ofrece propina.
- **El efectivo queda fuera de la app**, como se acordó: si el cliente da propina en mano no
  se registra en ningún sitio. Al repartidor ya **no** le aparece "Registrar propina en
  efectivo". Las propinas en efectivo declaradas antes de esta versión que sigan pendientes
  se pueden cerrar como siempre (el repartidor responde "La recibí / No la recibí").

## 2. Registro y aprobación de repartidores (el caso de Hernán)

Causa encontrada: la pantalla "Ser Repartidor" enviaba los documentos, pero **el servidor
los descartaba** y nunca activaba el perfil de repartidor. Consecuencia: no podía activar el
reparto, no aparecía en la lista de pendientes y el admin no podía aprobar porque le faltaban
documentos **que nunca se habían guardado**.

- Ahora los documentos se suben y se guardan de verdad: **INE anverso y reverso** (el reverso
  es un campo nuevo), foto de perfil, foto del vehículo y licencia/permiso según el vehículo.
- Al enviar la solicitud, el usuario queda como **repartidor pendiente de aprobación** y el
  admin lo ve en **Verificaciones** con todos los documentos.
- El admin ve también las **solicitudes antiguas** que quedaron a medias con el flujo
  anterior; al aprobarlas se activa el perfil de repartidor.
- **Bici, ebike y patinete no necesitan matrícula ni permiso de circulación** (antes era
  imposible aprobarlas porque exigía documentos de coche).
- Un repartidor **ya aprobado** que suba o cambie un documento **sigue pudiendo trabajar**
  (antes cualquier cambio lo devolvía a "pendiente de aprobación" y se quedaba bloqueado).
- En la app del repartidor, el interruptor de "disponible" ya no aparenta estar activo si el
  perfil no está aprobado: avisa claramente de que falta la aprobación.

## 3. El tiempo de entrega ya no sube y baja

- Cada actualización del tiempo aplica **límites** (como mucho +2 min o +20 % de subida y
  −3 min o −30 % de bajada) para que el número **se deslice** en vez de dar saltos.
- Al **recoger** el pedido se permite una bajada mayor de una sola vez (−50 %), que es el
  momento lógico en que el tiempo baja; a partir de ahí ya **no rebota hacia arriba**.
- Corregido el **parpadeo del GPS** al llegar al negocio: el tramo deja de contar a 150 m y
  no vuelve a contar hasta los 350 m (antes sumaba y quitaba minutos alternativamente).
- La caché de rutas pasa de 30 a 60 s y la pantalla del cliente usa **solo** el dato
  suavizado del servidor (se eliminó el reloj que venía de otra fuente y podía contradecir
  al número de minutos).

## 4. El panel del negocio ya no aparece vacío

- Causa: al caducar el token de sesión, la app intentaba renovarlo contra una dirección que
  **no existía en el servidor** y borraba la sesión guardada; el panel quedaba "sin negocio
  registrado" hasta reinstalar o volver a iniciar sesión.
- Ahora existe la **renovación real de sesión** (refresh token con rotación) y la app **no
  borra nada** por un fallo puntual de red.
- El panel reintenta al abrir, se recarga al volver la app a primer plano y el tirón para
  refrescar también recarga los negocios. Ya **no hace falta reinstalar**.

## 5. Notas del build

- Android: APK de release generado y comprobado (los arreglos van dentro del bundle).
- iOS: compilación 1.0.16 (22) preparada. App Store Connect estaba bloqueando las subidas
  hasta que el titular de la cuenta acepte el acuerdo actualizado de Apple.
- Base de datos: migración aplicada (nueva columna `emergency_contact` en repartidores).
- Verificación: comprobación de tipos del proyecto y compilación del servidor en verde.
- Como siempre, **los cambios de servidor necesitan el despliegue** para poder probarse.
