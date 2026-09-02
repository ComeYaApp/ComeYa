// Estilos de mapa compartidos (solo tienen efecto con PROVIDER_GOOGLE en
// Android/iOS; en web se aplican via map.setOptions({ styles })).
// Objetivo: look limpio tipo Uber/Glovo — sin ruido de POIs, calles claras
// y agua suave para que los pines y la ruta destaquen.

export const lightMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#f5f3f0" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f3f0" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#d9d5d0" }],
  },
  {
    featureType: "administrative.land_parcel",
    elementType: "labels.text.fill",
    stylers: [{ color: "#bdbdbd" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#eceae7" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#938f8a" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#dbe8dd" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#7d8f81" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8a8681" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#e3e0dc" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#e9e7e4" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#c3d6d2" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#7f9e98" }],
  },
];

export const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#373737" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#3c3c3c" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#000000" }],
  },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

/** Estilo según tema de la app. */
export const mapStyleForTheme = (isDark: boolean) =>
  isDark ? darkMapStyle : lightMapStyle;
