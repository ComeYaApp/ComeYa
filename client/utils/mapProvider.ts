import { Platform } from "react-native";

/**
 * Proveedor de mapas efectivo para `react-native-maps`.
 *
 * En iOS, `PROVIDER_GOOGLE` exige una API key de Google Cloud restringida al
 * bundle de la app. Si esa key falta o no está autorizada, el SDK de Google
 * pinta un lienzo vacío: sin calles, sin etiquetas y sin comercios —
 * exactamente el mapa "desactualizado" que veía el cliente.
 *
 * La decisión tiene que mirar LA MISMA variable que `app.config.js` inyecta
 * en el proyecto nativo (`ios.config.googleMapsApiKey`); si no, la app
 * pediría Google Maps sin key y volvería el mapa en blanco. Si no hay key,
 * se usa Apple Maps, que no necesita ninguna y siempre dibuja calles y
 * etiquetas. Las rutas siguen viniendo del servidor
 * (`/api/gps/directions`), así que la navegación giro a giro no cambia.
 *
 * En Android se mantiene Google Maps: la key va embebida en el build y es la
 * que da el aspecto ya aprobado por el cliente.
 */
const IOS_GOOGLE_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const HAS_IOS_GOOGLE_KEY = Boolean(IOS_GOOGLE_KEY);

export function effectiveMapProvider(googleProvider: any): any {
  if (Platform.OS === "ios" && !HAS_IOS_GOOGLE_KEY) {
    // `undefined` = PROVIDER_DEFAULT, es decir Apple Maps en iOS.
    return undefined;
  }
  return googleProvider;
}

/** true si el mapa está usando Google Maps (y por tanto admite customMapStyle). */
export const USING_GOOGLE_MAPS = Platform.OS !== "ios" || HAS_IOS_GOOGLE_KEY;
