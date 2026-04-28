import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, ComeYaColors, Shadows } from '@/constants/theme';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY || "";
const SORIA = { lat: 41.7636, lng: -2.4677 };

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.maps) { resolve(); return; }
    const existing = document.getElementById("gmap-script");
    if (existing) { existing.addEventListener("load", () => resolve()); return; }
    const script = document.createElement("script");
    script.id = "gmap-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geocoding`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function LocationPickerScreen() {
  const navigation = useNavigation();
  const route = useRoute() as any;
  const { theme, isDark } = useTheme();
  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [mapsReady, setMapsReady] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadGoogleMaps().then(() => setMapsReady(true)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || gmap.current) return;
    const google = (window as any).google;

    gmap.current = new google.maps.Map(mapRef.current, {
      center: SORIA, zoom: 15,
      disableDefaultUI: true, zoomControl: true,
      styles: isDark ? DARK_STYLE : [],
      gestureHandling: "greedy",
    });

    // Pin arrastrable en el centro
    markerRef.current = new google.maps.Marker({
      position: SORIA,
      map: gmap.current,
      draggable: true,
      title: "Arrastra para ajustar",
      icon: {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48"><rect x="2" y="2" width="36" height="36" rx="18" fill="${ComeYaColors.primary}" stroke="white" stroke-width="2"/><text x="20" y="26" text-anchor="middle" font-size="20">📍</text><polygon points="14,38 26,38 20,48" fill="${ComeYaColors.primary}"/></svg>`)}`,
        scaledSize: new google.maps.Size(40, 48),
        anchor: new google.maps.Point(20, 48),
      },
    });

    const updateLocation = async (latLng: any) => {
      const lat = latLng.lat();
      const lng = latLng.lng();
      setLocation({ latitude: lat, longitude: lng });

      // Geocodificación inversa
      try {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
          if (status === "OK" && results[0]) {
            setAddress(results[0].formatted_address);
          }
        });
      } catch {}
    };

    // Actualizar al arrastrar
    markerRef.current.addListener("dragend", (e: any) => updateLocation(e.latLng));

    // Actualizar al hacer click en el mapa
    gmap.current.addListener("click", (e: any) => {
      markerRef.current.setPosition(e.latLng);
      updateLocation(e.latLng);
    });

    // Inicializar con posición actual
    setLocation({ latitude: SORIA.lat, longitude: SORIA.lng });
    updateLocation({ lat: () => SORIA.lat, lng: () => SORIA.lng });

    // GPS del usuario
    navigator.geolocation?.getCurrentPosition((pos) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      gmap.current?.panTo(loc);
      markerRef.current?.setPosition(loc);
      updateLocation({ lat: () => loc.lat, lng: () => loc.lng });
    });
  }, [mapsReady]);

  const handleGetLocation = () => {
    setLoading(true);
    navigator.geolocation?.getCurrentPosition((pos) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      gmap.current?.panTo(loc);
      gmap.current?.setZoom(17);
      markerRef.current?.setPosition(loc);
      setLocation({ latitude: loc.lat, longitude: loc.lng });
      setLoading(false);

      const google = (window as any).google;
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: loc }, (results: any, status: any) => {
        if (status === "OK" && results[0]) setAddress(results[0].formatted_address);
      });
    }, () => setLoading(false), { enableHighAccuracy: true });
  };

  const handleConfirm = () => {
    if (!location) return;
    if (route.params?.onLocationSelected) {
      route.params.onLocationSelected(location, address);
    }
    navigation.goBack();
  };

  return (
    <View style={[s.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Mapa */}
      <div ref={mapRef} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 160 }} />

      {!mapsReady && (
        <View style={s.loading}>
          <ActivityIndicator size="large" color={ComeYaColors.primary} />
        </View>
      )}

      {/* Instrucción flotante */}
      <View style={[s.instruction, { backgroundColor: theme.card, top: Spacing.xl }]}>
        <Feather name="move" size={16} color={ComeYaColors.primary} />
        <ThemedText type="caption" style={{ marginLeft: Spacing.xs, color: theme.textSecondary }}>
          Toca el mapa o arrastra el pin para ajustar
        </ThemedText>
      </View>

      {/* Panel inferior */}
      <View style={[s.panel, { backgroundColor: theme.card }]}>
        {address ? (
          <View style={s.addressRow}>
            <Feather name="map-pin" size={16} color={ComeYaColors.primary} />
            <ThemedText type="small" style={{ flex: 1, marginLeft: Spacing.sm, color: theme.text }} numberOfLines={2}>
              {address}
            </ThemedText>
          </View>
        ) : (
          <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
            Selecciona una ubicación en el mapa
          </ThemedText>
        )}

        <View style={s.buttons}>
          <Pressable onPress={handleGetLocation} style={[s.btnSecondary, { borderColor: ComeYaColors.primary }]} disabled={loading}>
            {loading
              ? <ActivityIndicator size="small" color={ComeYaColors.primary} />
              : <><Feather name="navigation" size={16} color={ComeYaColors.primary} /><ThemedText type="small" style={{ color: ComeYaColors.primary, fontWeight: "600", marginLeft: 6 }}>Mi ubicación</ThemedText></>
            }
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            style={[s.btnPrimary, { backgroundColor: location ? ComeYaColors.primary : "#ccc" }]}
            disabled={!location}
          >
            <Feather name="check" size={16} color="#fff" />
            <ThemedText type="small" style={{ color: "#fff", fontWeight: "700", marginLeft: 6 }}>Confirmar</ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#373737" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

const s = StyleSheet.create({
  container: { flex: 1 },
  loading: { position: "absolute", inset: 0, justifyContent: "center", alignItems: "center", zIndex: 20 } as any,
  instruction: {
    position: "absolute", left: Spacing.lg, right: Spacing.lg,
    flexDirection: "row", alignItems: "center",
    padding: Spacing.md, borderRadius: BorderRadius.full,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
    zIndex: 10,
  },
  panel: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: 160, padding: Spacing.lg,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8,
    zIndex: 10,
  },
  addressRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: Spacing.md },
  buttons: { flexDirection: "row", gap: Spacing.md },
  btnSecondary: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 2,
  },
  btnPrimary: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: Spacing.md, borderRadius: BorderRadius.md,
  },
});
