# ComeYa 1.0.16 (build 21) — notas de versión

**Versión**: 1.0.16 (misma versión, build 21) · versionCode 25
**Fecha**: 29 de septiembre de 2026
**Base**: corrige lo que el cliente detectó en su prueba rápida del build 20

---

## 1. El logo ya es el oficial

El cliente envió el logo por correo (el mismo correo donde envió los de Beefinder). En la
app se estaba usando por error **un círculo antiguo** que no era su logo.

- Fuente única: `assets/images/comeya-logo-nuevo.svg` (cuadrado rojo `#EB0000` con el
  emblema circular: anillo blanco, **COMEYA**, el repartidor con el paquete y
  **EL DELIVERY DE SORIA**).
- Se usa **tal cual**, sin recortarlo ni reinterpretarlo:
  - **Icono de la app** (iOS y Android): a sangre, como el archivo original.
  - **Pantalla de carga**: el rojo del cuadrado coincide con el fondo (`#EB0000`), así que
    el borde del cuadrado es invisible y solo se ve el emblema.
  - **Dentro de la app**: inicio, acceso, soporte, perfil de invitado, tarjetas regalo,
    barra lateral del negocio y cabecera de la web.
  - **Web**: logo de la página de carga, privacidad, borrar cuenta y la web pública.
- Android: la capa frontal del icono adaptativo se coloca al 78% para que el emblema entre
  completo dentro del círculo que recorta el lanzador (nada de anillos cortados).
- El rojo de las superficies que tocan el logo pasa a `#EB0000` (el del propio logo). El
  rojo de los botones e interfaz sigue siendo el de siempre.

## 2. Categorías del inicio: las seis correctas

Antes se repetían y aparecían categorías sueltas que no tocaban. Ahora son **exactamente
seis, en este orden**, y ya no se generan a partir de la base de datos (por eso salían
duplicados: "Mexicana" dos veces por `tacos` y `mexicana`):

| # | Categoría | Icono |
|---|---|---|
| 1 | Española | paella |
| 2 | Oriental | sushi |
| 3 | Mexicana | taco |
| 4 | Pollo | pollo |
| 5 | Hamburguesas | hamburguesa |
| 6 | Pizza | pizza |

- Desaparecen los chips que sobraban: **Carnicería, Mariscos, Pizzas, Mercado, Ramen,
  Asiática**.
- Al tocar una tarjeta entra también lo que se llama distinto pero es lo mismo: "Mexicana"
  incluye los negocios con categoría `tacos`, y "Pollo" incluye la carnicería.
- La lista vive en un único archivo (`client/constants/cuisineCategories.ts`) que usan la
  app y la web, así que no pueden volver a divergir.

## 3. Se podía entrar al mapa

- **Causa**: el botón "Ver mapa" del inicio no hacía absolutamente nada para quien no tenía
  la sesión iniciada, porque la pantalla del mapa solo estaba registrada para usuarios con
  sesión. Al pulsar, la navegación se descartaba en silencio.
- Ahora el mapa de negocios es público (como la lista de negocios y la ficha del negocio, que
  ya lo eran).
- Si el mapa no cargara por lo que sea, aparece un aviso claro con **Reintentar**, en vez de
  quedarse para siempre en "Cargando mapa...".
- La flecha de volver solo se muestra cuando de verdad se puede volver (abierto como pestaña
  "Mapa" era un botón muerto).
- Red de seguridad: si algún botón navega a una pantalla que no existe, queda registrado en
  el log en vez de fallar sin dejar rastro.

## 4. Tildes

- Home: **Rápido**, **Económico** ("Rapido"/"Economico" antes) y "Intenta con otra búsqueda
  o categoría".
- Avisos: "Error al reenviar código", "¿No recibiste el código?", "Cuéntanos más sobre tu
  experiencia", "Este evento ya está muy cerca o ya pasó", "Error de conexión".
- Pantalla legal: texto completo con tildes corregido. Además tenía dos errores de contenido:
  "Soria, España, España" (repetido), "18 anos" (años) y el correo de soporte apuntaba a
  `ComeYa.mx` en vez de `comeya.es`.
- Admin: "Número de teléfono", "Configuración", "Términos".

## 5. La web funciona igual que la app

- **Inicio de la web**: ya tiene los botones **Explorar negocios** y **Ver mapa** (no
  existían) y las cuatro promos del inicio de la app (Hazte VIP, Tarjeta Regalo, Tus Puntos,
  Invita y Gana).
- **Enlaces muertos corregidos**: "Favoritos" del menú lateral y "Historial de pagos" del
  perfil navegaban a pantallas que solo existían en el móvil, así que no hacían nada.
- **Reservas y finanzas con versión web**: *Mis reservas*, *Reservas del negocio* e
  *Historial de pagos* comparten **el mismo componente** que la app (no son dos copias, así
  que el flujo no puede separarse) y en escritorio se muestran con la barra superior y el
  menú lateral.
- **Menú lateral** con acceso directo a Reservas (cliente y negocio) e Historial de pagos.
- **Mapa de la web**: comprobado en producción con los 11 negocios.
- Informe completo de paridad web ↔ app: `docs/INFORME-PARIDAD-WEB.md`.

## 6. Lo que ya venía del build 20 y sigue pendiente de que el cliente lo pruebe

Estos cambios ya estaban incluidos y **necesitan que el servidor esté desplegado**:

- Tiempos de entrega reales: antes el "llegan 5 minutos" solo contaba el tramo del repartidor
  al cliente. Ahora suma repartidor → negocio, el tiempo de cocina que queda y negocio →
  cliente. El aviso de "5 minutos" solo se envía cuando el pedido va de camino, no mientras
  se cocina.
- GPS del repartidor más fresco: envío cada 1 segundo en movimiento (antes 2) y la app del
  cliente refresca cada 15 segundos, con "Ubicación actualizada hace X s" para que nunca
  parezca que el pin está al día si no lo está.
- Reservas: todas nacen **pendientes** y las confirma el negocio (ya no se confirman solas).
  El código de confirmación se genera al confirmar y se muestra completo (antes salía
  recortado). El negocio tiene la agenda por franja horaria con comensales y coste, y el
  coste queda claro: 0,99 € por comensal + 0,49 € de servicio.
- Las reservas que no se concretan caducan solas y dejan de aparecer.
- El coste de servicio (0,49 €) se ve en la ficha del pedido, en la factura, en las finanzas
  del negocio y en el panel de administración.
- Se quitó el "pedido anticipado" de las reservas.

## 7. Notas técnicas del build

- `scripts/generate-brand-assets.js` ahora rasteriza el SVG oficial (antes componía el
  círculo antiguo) y escribe también los recursos nativos de Android, porque un build local
  con Gradle **no** ejecuta `expo prebuild`.
- Colores nativos de Android (`values/colors.xml` y `values-night/colors.xml`) al rojo del
  logo `#EB0000` para que el splash sea continuo.
- `scripts/audit-web-parity.js` genera el informe de paridad web ↔ app (se puede volver a
  ejecutar cuando se quiera).
- Verificación de esta tanda: build de web correcto, prueba en navegador real (los botones
  del inicio y el mapa), y comprobación de que las 6 categorías aparecen en orden.
