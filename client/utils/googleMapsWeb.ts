// Cargador ÚNICO de la Google Maps JavaScript API para toda la web.
// Sustituye a las ~13 copias de loadGoogleMaps repartidas por las pantallas.
//
// - Idempotente: una sola etiqueta <script> para el núcleo aunque varias
//   pantallas la pidan a la vez; si luego alguien necesita librerías extra
//   (geometry, visualization…) se inyecta SOLO lo que falta, en cola, sin
//   descargas duplicadas.
// - La clave es la Web Key de Google Cloud (restringida por referrers),
//   servida por el backend en GET /api/config/maps-key — nunca la Backend
//   Key sin restricciones.

type Google = any;

/** Librerías reales de la Maps JS API con namespace comprobable. */
const LIB_NAMESPACES: Record<string, string> = {
  geometry: "geometry",
  visualization: "visualization",
  places: "places",
  drawing: "drawing",
  journeys: "journeys",
};

let keyPromise: Promise<string> | null = null;
let currentLoad: Promise<void> = Promise.resolve();

function fetchKey(): Promise<string> {
  if (!keyPromise) {
    keyPromise = fetch(
      (process.env.EXPO_PUBLIC_BACKEND_URL || "") + "/api/config/maps-key",
    )
      .then((r) => r.json())
      .then((d) => (d?.key as string) || "")
      .catch(() => "");
  }
  return keyPromise;
}

function hasLibs(libs: string[]): boolean {
  const g: Google = (window as any).google;
  if (!g?.maps) return false;
  return libs.every((l) => {
    const ns = LIB_NAMESPACES[l];
    return !ns || !!g.maps[ns];
  });
}

function inject(libs: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    fetchKey()
      .then((key) => {
        const script = document.createElement("script");
        script.dataset.gmapsLoader = "1";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}${
          libs.length ? `&libraries=${libs.join(",")}` : ""
        }`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () =>
          reject(new Error("No se pudo cargar Google Maps"));
        document.head.appendChild(script);
      })
      .catch(reject);
  });
}

/**
 * Carga la Maps JS API (y las librerías pedidas). Devuelve una promesa que
 * se resuelve cuando window.google.maps está disponible.
 * Ejemplos: loadGoogleMaps() · loadGoogleMaps(["geometry"]) ·
 *           loadGoogleMaps(["visualization", "geometry"])
 */
export function loadGoogleMaps(libraries: string[] = []): Promise<void> {
  const libs = Array.from(new Set(libraries)).filter(
    (l) => !!LIB_NAMESPACES[l],
  );
  if (hasLibs(libs)) return Promise.resolve();

  // En cola: nunca dos etiquetas simultáneas con librerías solapadas.
  currentLoad = currentLoad
    .then(async () => {
      if (hasLibs(libs)) return;
      const g: Google = (window as any).google;
      if (g?.maps) {
        // Núcleo ya cargado: inyectar solo las librerías que faltan.
        const missing = libs.filter((l) => !hasLibs([l]));
        if (missing.length) await inject(missing);
      } else {
        await inject(libs);
      }
    })
    .catch(() => {
      // Un fallo no debe bloquear la cola para el siguiente intento.
    });

  return currentLoad;
}

/** La Web Key cruda (para llamadas REST que la necesiten, ej. Places). */
export async function fetchMapsWebKey(): Promise<string> {
  return fetchKey();
}

/** Atajo tipado como any al objeto google ya cargado. */
export function getGoogleMaps(): Google {
  return (window as any).google;
}
