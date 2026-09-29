# ComeYa 1.0.16 (build 20) — Notas de versión y guía de pruebas

Documento para el cliente: incluye el texto listo para publicar en la App
Store, la verificación punto por punto de todo lo pedido y una guía para
probar cada cambio y confirmarlo.

---

## 1. Texto listo para App Store Connect → «Novedades»

> Copiar y pegar en el campo **Novedades de esta versión**.

```
Esta actualización incluye mejoras importantes en los tiempos de entrega, el
seguimiento del repartidor y la gestión de reservas.

TIEMPOS DE ENTREGA REALES
El tiempo que ves al hacer un pedido ahora tiene en cuenta todo el proceso:
lo que tarda el repartidor en llegar al restaurante, lo que queda de cocina y
el reparto hasta tu dirección. Antes solo contaba el reparto, por lo que un
pedido recién hecho podía anunciar «5 minutos». Además, los avisos de «tu
pedido llega en 5 minutos» solo se envían cuando el repartidor ya lleva tu
pedido, así que el aviso es real.

SEGUIMIENTO EN TIEMPO REAL
La posición del repartidor en el mapa se actualiza mucho más rápido: se mueve
de forma continua en lugar de a saltos, y verás si el dato es en tiempo real o
de hace unos segundos.

RESERVAS CONFIRMADAS POR EL RESTAURANTE
Ahora todas las reservas las confirma el restaurante. Cuando reserves,
recibirás un aviso de que la solicitud ha llegado y otro con tu código de mesa
en cuanto el restaurante la acepte. Así la mesa está garantizada por ambas
partes. Las reservas que no se lleguen a confirmar desaparecen solas.

NUEVO APARTADO DE RESERVAS PARA EL NEGOCIO
Los restaurantes tienen ahora un botón de Reservas siempre a mano, con la
agenda del día agrupada por hora, el número de comensales de cada franja y el
coste de cada mesa.

COSTE DE SERVICIO DETALLADO
El coste de servicio (0,49 €) aparece desglosado en todos los pedidos, también
en los de recogida en local, y en la factura descargable. Las líneas suman
exactamente el total.

CORRECCIONES
- El código de confirmación de la reserva ya se ve completo (antes salía cortado).
- Se ha eliminado el pedido anticipado al reservar, para evitar problemas si
  falta algún producto o si finalmente no acuden todos los comensales.
- En «Explorar negocios» el título y la flecha de volver ya no quedan pegados
  al borde de la pantalla.
- La flecha de volver en la pantalla de suscripciones ya funciona.
- Los pedidos que no llegan a concretarse desaparecen de «Mis pedidos» a las
  24 horas.
- Los textos de «Acciones rápidas» y las descripciones de alimentación se ven
  completos.
- Nuevo logo de la app y pantalla de inicio.
- Mapas más fiables y sin nombres de negocios amontonados.
```

---

## 2. Antes de probar: hace falta desplegar

Los cambios están **a la vez en la app y en el servidor**. Para que la prueba
sea válida tienen que estar los dos actualizados:

| Parte | Estado | Cómo se actualiza |
|---|---|---|
| **Servidor** (cálculo de tiempos, confirmación de reservas, costes en los paneles) | Subido a `main` | Render despliega solo al detectar el push en `main`. Comprueba en el panel de Render que el último deploy es posterior a este cambio y ha terminado en verde. |
| **App iOS** | Compilando en EAS | Instala el build **1.0.16 (20)** desde TestFlight. |
| **App Android** | APK lista | `android/app/build/outputs/apk/release/app-release.apk` |

Si pruebas con el build antiguo o el servidor viejo, verás el
comportamiento anterior: por ejemplo, las reservas seguirán
confirmándose solas, porque esa regla vive en el servidor.

---

## 3. Guía de pruebas

### 3.1 Como cliente

**a) El tiempo de entrega ya no miente**

1. Haz un pedido de reparto normal.
2. Mira el tiempo que aparece (tarjeta «Seguimiento» y cabecera).
3. **Debe** rondar los 25-35 minutos, no 5.
4. Debajo del número verás la explicación: «Incluye el reparto y X min de
   cocina» o «Incluye que el repartidor recoja tu pedido».
5. Espera a que el repartidor recoja el pedido. **Entonces** sí puede bajar a
   un valor pequeño (es el reparto puro) y solo entonces puede llegarte el
   aviso de «tu pedido llega en 5 minutos».

**b) El repartidor se mueve en tiempo real**

1. Con el pedido en camino, abre el mapa del seguimiento.
2. El pin debe moverse de forma **continua**, no a saltos.
3. Debajo del tiempo aparece «Ubicación en tiempo real». Si el dato se queda
   atrás, cambia a «Ubicación actualizada hace X s» y se pone en ámbar: eso
   indica que el repartidor ha perdido cobertura, no que el dato sea actual.

**c) Reserva: la confirma el restaurante**

1. Reserva mesa en un restaurante.
2. Al terminar, **no** debe aparecer un código. Verás «El restaurante tiene que
   confirmarla».
3. En «Mis reservas» debe quedar como **Pendiente de confirmar** y sin código.
4. En cuanto el restaurante la confirme, te llega una notificación con el
   código y la reserva pasa a **Confirmada** (la pantalla se actualiza sola).
5. Solo entonces aparece «Muestra este código al llegar».

**d) El código se ve completo** — en la reserva confirmada, el código `CY-XXXX`
debe verse entero, sin cortarse por arriba ni por abajo.

**e) Pedido anticipado eliminado** — al reservar ya no hay ninguna opción de
elegir platos por adelantado, ni aparece «Pedido anticipado hecho» en las
reservas.

**f) Mis pedidos limpia** — un pedido que se quedó sin confirmar no debe seguir
en «Pendientes» pasadas 24 horas.

**g) Mis reservas limpia** — una reserva cuya hora ya pasó no debe seguir en
«Activas»; debe pasar al historial (como caducada o no presentada).

**h) Coste de servicio visible**

1. Abre un pedido entregado.
2. En el desglose debe aparecer **Subtotal · Envío · Coste de servicio · Total**,
   y las líneas deben sumar exactamente el total.
3. Comprueba también en un pedido de **recogida en local**: no hay envío, pero
   **sí** aparece el coste de servicio.
4. Pulsa «Descargar factura (PDF)»: el documento lleva el mismo desglose.

**i) Explorar negocios** — abre «Explorar Negocios»: el título y la flecha no
quedan pegados al borde superior, la flecha funciona y las pestañas
(Todos / Restaurantes / Alimentación) se leen enteras.

**j) Mapa** — en iOS, el mapa debe mostrar **calles, nombres y comercios**. Los
negocios aparecen como puntos; al tocar uno se despliega su nombre y el mapa se
centra. (Antes se veía el fondo vacío y todos los nombres amontonados.)

**k) Hazte VIP** — entra en «Hazte VIP» y pulsa la flecha de volver: funciona.

**l) Alimentación** — abre el apartado Alimentación: la descripción verde debe
decir «En Alimentación puedes especificar en tus pedidos exactamente como
quieres tus productos. Por ejemplo: "filetes de ternera finos", "plátanos
maduros", "pescado limpio y abierto"».

**m) Orden de las categorías** — en la Home, el orden debe ser: **España,
Oriental, Mexicana, Pollo, Hamburguesas, Pizzas** (y después el resto).

### 3.2 Como negocio

**a) Apartado de Reservas**

1. En la barra de abajo, en el centro, hay un botón redondo de **Reservas**.
2. Dentro, arriba, hay tres filtros: **Por confirmar / Confirmadas / Todas**
   con el número en cada uno.
3. Debajo, el resumen del día: comensales totales, cuántas sin confirmar y el
   coste total de ComeYa de esa jornada.

**b) Confirmar una reserva**

1. Con una reserva pendiente, pulsa **Confirmar**.
2. La reserva pasa a confirmada y **el cliente recibe el aviso con su código**.
3. Si la rechazas, el cliente recibe el rechazo.

**c) Agenda por franjas con coste** — cada hora aparece como cabecera:
`18:00 · 4 comensales · 4,45 €`, y debajo las reservas de esa franja. En cada
reserva se ve el cálculo completo:
`4 × 0,99 € + 0,49 € servicio = 4,45 €`.

**d) Ajustes de reservas** — la opción de «Confirmación automática» ya no
existe. En su lugar se explica que todas las reservas las confirmas tú. Más
abajo, la tarifa muestra las **dos** partes (0,99 € por comensal **+** 0,49 €
por reserva) con un ejemplo calculado para 4 comensales.

**e) Acciones rápidas** — en «Mi Negocio», los textos Pedidos, Productos,
Horarios, Reservas, Escanear QR y Ajustes se leen completos, sin cortarse.

**f) Sistema de Pagos** — la tarjeta debe decir exactamente:
- Recibes el 100% del precio base de tus productos
- ComeYa agrega un porcentaje de markup sobre los precios base de los productos
- ComeYa cobra un porcentaje de comisión a cada restaurante en función del
  volumen de pedidos
- Los pagos a los negocios se harán a través de: Bizum, Transferencia y tarjeta
- Las ganancias son transferidas entre 0 a 48 horas

**g) Finanzas** — en «Finanzas» las ganancias ya no incluyen el markup (que lo
paga el cliente). Debajo se indica cuánto markup y cuánto coste de servicio se
han descontado en los pedidos entregados.

**h) GPS del negocio** — el mapa debe cargar calles y direcciones y dejar de
fallar «pese a tener buena señal».

**i) Deuda de reservas** — en «Tarifas de reservas» se explica la tarifa
completa: 0,99 € por comensal que asiste + 0,49 € de servicio por reserva.

### 3.3 Como repartidor

**a) Notificaciones con tiempo real** — al aceptar un pedido, el cliente ya no
recibe «llega en 5 minutos» de inmediato. Ese aviso llega cuando realmente
faltan 5 minutos con el pedido ya recogido.

**b) GPS del repartidor** — la posición se envía cada 1,5 segundos en
movimiento (antes cada 2 s fijos) y la pantalla de seguimiento del cliente se
refresca cada segundo mientras te mueves. Al pararte, el envío se espacia para
no gastar batería. El ícono del repartidor en el mapa debe deslizarse, no
saltar.

**c) Cancelar con motivo** — sigue disponible al cancelar un pedido aceptado:
avería del vehículo, mucho tráfico, problema personal u otro motivo.

### 3.4 Como administrador

1. **Ingresos de plataforma:** ahora incluyen el markup **y** el coste de
   servicio de cada pedido (antes solo el markup, así que la contabilidad
   salía a la baja).
2. **Detalle de pedido:** muestra la línea «Coste de servicio».
3. **Exportar CSV:** el fichero incluye Base productos, Markup ComeYa, Coste
   servicio, Envío y Total cobrado, pedido a pedido. Es lo que te permite
   cuadrar la contabilidad trimestral.

---

## 4. Verificación de todos los puntos del documento

Leyenda: ✅ hecho · 🟡 hecho parcialmente · 🔵 depende de ti · ⚠️ no legible en
el PDF

### Cabecera del documento

| Punto | Estado |
|---|---|
| Cambiar el logo del icono de la app y al entrar | ✅ Icono, splash, icono adaptativo y favicon regenerados desde el logo oficial |
| Cambiar el nombre del desarrollador en la App Store | 🔵 Depende de tu cuenta de Apple (ver apartado 5) |
| Actualizar la previsualización de la App Store | 🔵 Dijiste que enviarías los datos aparte |

### Punto de vista del CLIENTE

| Punto | Estado |
|---|---|
| 1. El código de confirmación sale entrecortado | ✅ |
| 2. Eliminar el pedido anticipado | ✅ |
| 3. Explorar negocios: descripciones, «Restaurantes», título y flecha muy arriba, flecha que no funciona | ✅ |
| 4. *(sin texto en el PDF)* | ⚠️ Por el contexto, captura del problema del mapa → cubierto |
| 5. Ver mapa: no salen calles ni ubicaciones exactas | ✅ |
| 6. *(sin texto en el PDF)* | ⚠️ Idem, captura del mapa → cubierto |
| 7. Alimentación: cambiar la descripción verde | ✅ |
| 1. Hazte VIP: la flecha de volver no funciona | ✅ |
| 2. *(sin texto, captura de ComeYa Pass)* | ⚠️ No legible |
| 3. Orden de los iconos de las comidas | ✅ (España, Oriental, Mexicana, Pollo, Hamburguesas, Pizzas) |
| 1. Mis Pedidos: los no confirmados desaparecen a las 24 h | ✅ |
| 2. *(sin texto)* | ⚠️ No legible |
| 3. El mapa en iOS sale desactualizado | ✅ |
| 4. *(sin texto)* | ⚠️ No legible |
| 5. Mis Reservas: las que no se concretaron desaparecen | ✅ |
| 6. Las reservas deben ser confirmadas por el restaurante | ✅ |

### Punto de vista del NEGOCIO

| Punto | Estado |
|---|---|
| 1. Apartado RESERVAS para confirmar + botón central abajo | ✅ |
| 2. *(sin texto, captura de Acciones Rápidas)* | ⚠️ No legible |
| 3. Acciones rápidas: palabras entrecortadas | ✅ |
| 4-5. Descripción de «Sistema de Pagos» | ✅ (en Dashboard y en Finanzas) |
| 6. *(sin texto, captura de Pedidos Recientes)* | ⚠️ No legible |
| 7. Revisar el GPS del negocio y del cliente | ✅ |

### Punto de vista del REPARTIDOR

| Punto | Estado |
|---|---|
| 1. La confirmación llega con margen de 5 min, debería ser en tiempo real | ✅ |
| 2. *(sin texto)* | ⚠️ No legible |
| 3. El GPS del repartidor es básico, mejorarlo | ✅ |

### Notas de voz

| Punto | Estado |
|---|---|
| «Falla el GPS, no funcionaría» | ✅ |
| «Solo el de repartidor funciona, pero no en tiempo real, tarda mucho en actualizar» | ✅ |
| «A los clientes les sale que en cinco minutos va a estar y no es real» | ✅ |
| «El repartidor tiene que calcular el tiempo de ir a recoger al negocio y luego del negocio a la casa» | ✅ Es exactamente el nuevo cálculo |
| «El negocio debe tener un apartado específico para reservas para confirmar» | ✅ |
| «Que al cliente le llegue notificación de que el negocio aceptó la reserva» | ✅ |
| «El negocio tiene que confirmar aunque haya puesto disponibilidad, para no perder otra clientela» | ✅ |
| «Ambas partes se quedan aseguradas de que la reserva se concretó» | ✅ |
| «Mis reservas aparte, bien especificado: van a ir cuatro comensales a las seis, a las ocho van otros dos» | ✅ Agenda agrupada por franja con comensales |
| «El coste: 0,99 por cuatro comensales, más los 0,49 céntimos» | ✅ Se muestra el cálculo completo por reserva |
| «El coste del servicio de 0,49 € reflejado en cada pago del cliente» | ✅ |
| «El restaurante también paga por conseguir comensales» | ✅ (ya se cobraba; ahora se ve en la agenda y en Ajustes) |
| «Cuando el cliente pide a recoger, aunque no se cobre el reparto, sí se cobre el servicio» | ✅ (ya se cobraba; ahora se ve en el desglose) |
| «Que podamos sacar facturas de todo, de cada pedido, de cada importe, para la contabilidad trimestral» | 🟡 Ver apartado 5 |

---

## 5. Lo que queda de tu parte

**1. Nombre del desarrollador en la App Store (🔵).**
Aparece «RAUL ALEXANDER VARGAS PUJOTA» porque la cuenta de Apple Developer es
de persona física. Para que salga un nombre de empresa hay que convertirla en
cuenta de **organización**, y eso exige un CIF/NIF de empresa y un número D-U-N-S.
No se puede cambiar desde el código de la app: es un trámite con Apple.
Mientras siga siendo cuenta individual, el nombre del titular seguirá
apareciendo.

**2. Capturas y previsualización de la App Store (🔵).**
Indicaste que enviarías los datos aparte. El icono nuevo ya está listo para
usarse en la ficha.

**3. Facturación fiscal (🟡).**
Ahora mismo hay **desglose completo de importes** en la ficha del pedido, en el
PDF descargable y en el CSV del administrador, que es lo que pediste para poder
cuadrar cada pedido. Lo que aún **no** hay es una factura fiscal propiamente
dicha: falta añadir los datos fiscales de ComeYa (razón social, NIF, dirección),
numeración por serie, el desglose de IVA por tipo y un resumen mensual y
trimestral de IVA. Para hacerlo necesito que me facilites:

- Razón social y NIF de ComeYa
- Dirección fiscal
- Si la factura al cliente la emite ComeYa por el importe total, o si el
  restaurante factura a ComeYa por su parte

Con esos datos se completa en una segunda tanda.

**4. Puntos del documento que no se pudieron leer (⚠️).**
En el PDF hay varios puntos numerados cuyo texto quedó fuera de la captura
(dejaste solo el número y una imagen). Son, por lo que se ve:

- Puntos **4** y **6** de la lista del cliente: ambos están entre capturas del
  mapa, así que se han cubierto con la corrección de mapas.
- Punto **2** de la lista del cliente (captura de ComeYa Pass).
- Punto **2** de la lista del negocio (captura de Acciones Rápidas).
- Punto **6** de la lista del negocio (captura de Pedidos Recientes).
- Punto **2** de la lista del repartidor.

Si alguno era un cambio concreto, dímelo y lo añado.

---

## 6. Si algo no cuadra al probar

| Lo que ves | Qué mirar |
|---|---|
| La reserva se sigue confirmando sola | El servidor aún no se ha desplegado (esa regla está en el servidor, no en la app) |
| Los tiempos siguen siendo raros | Mismo caso: el cálculo lo hace el servidor. Comprueba el deploy de Render |
| El mapa de iOS sigue vacío | Que el build instalado sea el 1.0.16 (20) y que tenga conexión; la clave solo va dentro del build |
| El mapa de Android no carga | Que la APK instalada sea la nueva |
| El coste de servicio no aparece en el desglose | El build instalado debe ser el nuevo: es un cambio de la app |
