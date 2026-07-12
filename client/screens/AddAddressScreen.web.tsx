import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Text,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";

const PRIMARY = "#DC2626";
const SORIA = { lat: 41.7636, lng: -2.4677 };

function loadGoogleMaps(): Promise<string> {
  return new Promise(async (resolve, reject) => {
    if ((window as any).google?.maps?.Map) {
      resolve("");
      return;
    }
    const existing = document.getElementById("gmap-script");
    if (existing) {
      existing.addEventListener("load", () => resolve(""));
      if ((window as any).google?.maps?.Map) resolve("");
      return;
    }
    const key = await fetch(
      (process.env.EXPO_PUBLIC_BACKEND_URL || "") + "/api/config/maps-key",
    )
      .then((r) => r.json())
      .then((d) => d.key)
      .catch(() => "");
    const script = document.createElement("script");
    script.id = "gmap-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
    script.async = true;
    script.onload = () => resolve(key);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function resolveProfileImageUrl(img: string): string {
  if (img.startsWith("data:image/")) return img;
  const base = getApiUrl().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(img)) return img;
  return `${base}${img.startsWith("/") ? "" : "/"}${img}`;
}

const LABEL_OPTIONS = ["Casa", "Trabajo", "Otro"];

// Places API (New) - autocomplete via REST
interface PlaceSuggestion {
  placeId: string;
  description: string;
}

async function fetchPlaceSuggestions(
  input: string,
  apiKey: string,
): Promise<PlaceSuggestion[]> {
  if (!input || input.length < 3) return [];
  try {
    const res = await fetch(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
        },
        body: JSON.stringify({
          input,
          locationBias: {
            circle: {
              center: { latitude: 41.7636, longitude: -2.4677 },
              radius: 50000.0,
            },
          },
          includedRegionCodes: ["ES"],
        }),
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.suggestions || []).map(
      (s: any) =>
        ({
          placeId: s.placePrediction?.placeId || "",
          description:
            s.placePrediction?.text?.text ||
            s.placePrediction?.structuredFormat?.mainText?.text ||
            "",
        }) as PlaceSuggestion,
    );
  } catch {
    return [];
  }
}

async function fetchPlaceDetails(
  placeId: string,
  apiKey: string,
): Promise<{
  lat: number;
  lng: number;
  street: string;
  city: string;
  zipCode: string;
} | null> {
  if (!placeId) return null;
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "location,addressComponents",
        },
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const loc = data.location;
    const comps = data.addressComponents || [];
    const get = (t: string) =>
      comps.find((c: any) => c.types.includes(t))?.longText || "";
    const num = get("street_number"),
      rt = get("route");
    const city = get("locality") || get("administrative_area_level_2");
    const zip = get("postal_code");
    return {
      lat: loc.latitude,
      lng: loc.longitude,
      street: `${rt}${num ? " " + num : ""}`,
      city,
      zipCode: zip,
    };
  } catch {
    return null;
  }
}

export default function AddAddressScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { isDark } = useTheme();

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const inputBg = isDark ? "#2a2a2a" : "#f9fafb";
  const inputBorder = isDark ? "#444" : "#d1d5db";

  const existingAddress = (route.params as any)?.address as any;
  const fromCheckout = Boolean((route.params as any)?.fromCheckout);

  const mapRef = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mapsReady, setMapsReady] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState(existingAddress?.label || "Casa");
  const [street, setStreet] = useState(existingAddress?.street || "");
  const [city, setCity] = useState(existingAddress?.city || "Soria");
  const [zipCode, setZipCode] = useState(existingAddress?.zipCode || "");
  const [coordinates, setCoordinates] = useState({
    lat: existingAddress?.latitude
      ? parseFloat(existingAddress.latitude)
      : SORIA.lat,
    lng: existingAddress?.longitude
      ? parseFloat(existingAddress.longitude)
      : SORIA.lng,
  });
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // Places New autocomplete state
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchingPlace, setSearchingPlace] = useState(false);

  useEffect(() => {
    if (user?.profileImage)
      setProfileImage(resolveProfileImageUrl(user.profileImage));
    loadGoogleMaps()
      .then((key) => {
        setApiKey(key);
        setMapsReady(true);
      })
      .catch(console.error);
  }, []);

  // Places New autocomplete
  const handleStreetChange = useCallback(
    (value: string) => {
      setStreet(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.length < 3) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        const results = await fetchPlaceSuggestions(value, apiKey);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      }, 300);
    },
    [apiKey],
  );

  const selectSuggestion = useCallback(
    async (suggestion: PlaceSuggestion) => {
      setShowSuggestions(false);
      setSuggestions([]);
      setSearchingPlace(true);
      const details = await fetchPlaceDetails(suggestion.placeId, apiKey);
      setSearchingPlace(false);
      if (details) {
        setStreet(details.street);
        setCity(details.city);
        setZipCode(details.zipCode);
        setCoordinates({ lat: details.lat, lng: details.lng });
        gmap.current?.panTo({ lat: details.lat, lng: details.lng });
        gmap.current?.setZoom(17);
        markerRef.current?.setPosition({
          lat: details.lat,
          lng: details.lng,
        });
      }
    },
    [apiKey],
  );

  // Cerrar sugerencias al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestionRef.current &&
        !suggestionRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const reverseGeocode = useCallback((lat: number, lng: number) => {
    const google = (window as any).google;
    if (!google) return;
    new google.maps.Geocoder().geocode(
      { location: { lat, lng } },
      (results: any, status: any) => {
        if (status !== "OK" || !results[0]) return;
        const comps = results[0].address_components || [];
        const get = (t: string) =>
          comps.find((c: any) => c.types.includes(t))?.long_name || "";
        const num = get("street_number"),
          rt = get("route");
        const loc = get("locality") || get("administrative_area_level_2");
        const zip = get("postal_code");
        if (rt) setStreet(`${rt}${num ? " " + num : ""}`);
        if (loc) setCity(loc);
        if (zip) setZipCode(zip);
      },
    );
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || gmap.current) return;
    const google = (window as any).google;

    gmap.current = new google.maps.Map(mapRef.current, {
      center: coordinates,
      zoom: 16,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: "greedy",
    });

    markerRef.current = new google.maps.Marker({
      position: coordinates,
      map: gmap.current,
      draggable: true,
      icon: {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48"><circle cx="20" cy="20" r="18" fill="#DC2626" stroke="white" stroke-width="3"/><circle cx="20" cy="20" r="6" fill="white"/><polygon points="14,38 26,38 20,48" fill="#DC2626"/></svg>')}`,
        scaledSize: new google.maps.Size(40, 48),
        anchor: new google.maps.Point(20, 48),
      },
    });

    markerRef.current.addListener("dragend", (e: any) => {
      const lat = e.latLng.lat(),
        lng = e.latLng.lng();
      setCoordinates({ lat, lng });
      reverseGeocode(lat, lng);
    });

    gmap.current.addListener("click", (e: any) => {
      const lat = e.latLng.lat(),
        lng = e.latLng.lng();
      markerRef.current.setPosition(e.latLng);
      setCoordinates({ lat, lng });
      reverseGeocode(lat, lng);
    });
  }, [mapsReady]);

  const handleMyLocation = () => {
    setLocating(true);
    setError(null);
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          setCoordinates({ lat, lng });
          gmap.current?.panTo({ lat, lng });
          gmap.current?.setZoom(17);
          markerRef.current?.setPosition({ lat, lng });

          const google = (window as any).google;
          const geocoder = new google.maps.Geocoder();

          const results = await new Promise<any[]>((resolve, reject) => {
            geocoder.geocode(
              { location: { lat, lng } },
              (results: any[], status: string) => {
                status === "OK" ? resolve(results) : reject(status);
              },
            );
          });

          if (results[0]) {
            const addressComponents = results[0].address_components.reduce(
              (acc: any, comp: any) => {
                comp.types.forEach(
                  (type: string) => (acc[type] = comp.long_name),
                );
                return acc;
              },
              {},
            );

            setStreet(
              [addressComponents.route, addressComponents.street_number]
                .filter(Boolean)
                .join(" "),
            );
            setCity(
              addressComponents.locality ||
                addressComponents.administrative_area_level_2,
            );
            setZipCode(addressComponents.postal_code || "");
          }
        } catch (error) {
          setError("Error obteniendo detalles de la dirección");
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        setError(`Error de geolocalización: ${error.message}`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const handleSave = async () => {
    setError(null);
    if (!label.trim() || !street.trim()) {
      setError("Completa la etiqueta y la calle");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        label: label.trim(),
        street: street.trim(),
        city: city.trim() || "Soria",
        state: "España",
        zipCode: zipCode.trim(),
        latitude: coordinates.lat,
        longitude: coordinates.lng,
      };
      const response = existingAddress?.id
        ? await apiRequest(
            "PUT",
            `/api/users/${user?.id}/addresses/${existingAddress.id}`,
            payload,
          )
        : await apiRequest("POST", `/api/users/${user?.id}/addresses`, payload);
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        const savedId = (data as any)?.address?.id || existingAddress?.id;
        setSuccess(true);
        showToast(
          existingAddress?.id ? "Dirección actualizada" : "Dirección guardada",
          "success",
        );
        setTimeout(() => {
          if (fromCheckout && savedId)
            navigation.navigate(
              "Checkout" as never,
              {
                addressRefreshToken: Date.now(),
                selectedAddressId: savedId,
              } as never,
            );
          else navigation.goBack();
        }, 500);
      } else {
        setError("No se pudo guardar la dirección");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = () => {
    switch (user?.role) {
      case "customer":
        return "Cliente";
      case "business_owner":
        return "Negocio";
      case "delivery_driver":
        return "Repartidor";
      default:
        return "Admin";
    }
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    height: 46,
    border: "none",
    outline: "none",
    fontSize: 15,
    color: isDark ? "#fff" : "#1f2937",
    backgroundColor: "transparent",
    paddingLeft: 36,
    width: "100%",
  };

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* Sidebar */}
      <MobileSidebarWrapper
        title={existingAddress?.id ? "Editar dirección" : "Nueva dirección"}
        sidebarStyle={[
          s.sidebar,
          { backgroundColor: card, borderRightColor: border },
        ]}
      >
        <View style={[s.sideHeader, { borderBottomColor: border }]}>
          <Pressable
            style={s.avatarWrap}
            onPress={() => navigation.navigate("EditProfile")}
          >
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={s.avatar}
                contentFit="cover"
              />
            ) : (
              <View
                style={[
                  s.avatar,
                  {
                    backgroundColor: PRIMARY + "20",
                    justifyContent: "center",
                    alignItems: "center",
                  },
                ]}
              >
                <Feather name="user" size={40} color={PRIMARY} />
              </View>
            )}
          </Pressable>
          <Text style={[s.userName, { color: text }]}>
            {user?.name || "Usuario"}
          </Text>
          <Text style={[s.userPhone, { color: sub }]}>{user?.phone || ""}</Text>
          <View style={[s.roleBadge, { backgroundColor: PRIMARY + "15" }]}>
            <Text style={[s.roleBadgeText, { color: PRIMARY }]}>
              {getRoleLabel()}
            </Text>
          </View>
        </View>
        <View style={s.sideNav}>
          <Pressable
            onPress={() =>
              navigation.getParent()?.navigate("Main", { screen: "ProfileTab" })
            }
            style={s.navItem}
          >
            <Feather name="user" size={18} color={sub} />
            <Text style={[s.navItemText, { color: text }]}>Cuenta</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("SavedAddresses")}
            style={s.navItem}
          >
            <Feather name="map-pin" size={18} color={sub} />
            <Text style={[s.navItemText, { color: text }]}>
              Mis direcciones
            </Text>
          </Pressable>
          <Pressable style={[s.navItem, s.navItemActive]}>
            <Feather name="plus-circle" size={18} color={PRIMARY} />
            <Text style={[s.navItemText, { color: PRIMARY }]}>
              {existingAddress?.id ? "Editar dirección" : "Nueva dirección"}
            </Text>
          </Pressable>
        </View>
        <View style={[s.sideFooter, { borderTopColor: border }]}>
          <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
            <Feather name="arrow-left" size={16} color={sub} />
            <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
          </Pressable>
        </View>
      </MobileSidebarWrapper>

      {/* Main */}
      <ScrollView
        style={s.main}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[s.pageTitle, { color: text }]}>
          {existingAddress?.id ? "Editar dirección" : "Nueva dirección"}
        </Text>

        {/* Mapa */}
        <View style={[s.mapWrapper, { borderColor: border }]}>
          <div
            ref={mapRef}
            style={{ width: "100%", height: "100%", borderRadius: 14 } as any}
          />
          {!mapsReady && (
            <View style={s.mapLoading}>
              <ActivityIndicator color={PRIMARY} />
            </View>
          )}
          <View style={s.mapHint}>
            <Feather name="move" size={13} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 12, marginLeft: 6 }}>
              Toca el mapa o arrastra el pin
            </Text>
          </View>
        </View>

        {/* GPS */}
        <Pressable
          onPress={handleMyLocation}
          disabled={locating}
          style={[s.gpsBtn, locating && { opacity: 0.7 }]}
        >
          {locating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Feather name="navigation" size={16} color="#fff" />
          )}
          <Text style={s.gpsBtnText}>
            {locating ? "Obteniendo ubicación..." : "Usar mi ubicación actual"}
          </Text>
        </Pressable>

        {/* Calle con Places New autocomplete */}
        <View style={s.fieldGroup}>
          <Text style={[s.label, { color: sub }]}>CALLE Y NÚMERO *</Text>
          <View
            style={[
              s.inputRow,
              { backgroundColor: inputBg, borderColor: inputBorder },
            ]}
          >
            <Feather name="map-pin" size={16} color={sub} style={s.inputIcon} />
            <input
              ref={inputRef}
              type="text"
              value={street}
              onChange={(e) => handleStreetChange(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder="Ej: Calle Mayor 12"
              style={inputStyle}
            />
            {searchingPlace && (
              <ActivityIndicator
                size="small"
                color={PRIMARY}
                style={{ marginRight: 10 }}
              />
            )}
          </View>

          {/* Dropdown de sugerencias Places New */}
          {showSuggestions && suggestions.length > 0 && (
            <div ref={suggestionRef} style={s.dropdownStyle as any}>
              {suggestions.map((sugg, idx) => (
                <div
                  key={sugg.placeId || idx}
                  onClick={() => selectSuggestion(sugg)}
                  style={{
                    padding: "12px 16px",
                    cursor: "pointer",
                    borderBottom:
                      idx < suggestions.length - 1
                        ? "1px solid #e5e7eb"
                        : "none",
                    fontSize: 14,
                    color: "#1f2937",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    ((e.target as HTMLElement).style.background = "#f3f4f6")
                  }
                  onMouseLeave={(e) =>
                    ((e.target as HTMLElement).style.background = "transparent")
                  }
                >
                  <Feather
                    name="map-pin"
                    size={14}
                    color="#9ca3af"
                    style={{ marginRight: 10 }}
                  />
                  {sugg.description}
                </div>
              ))}
              <div
                style={{
                  padding: "8px 16px",
                  fontSize: 11,
                  color: "#9ca3af",
                  textAlign: "center",
                  borderTop: "1px solid #e5e7eb",
                }}
              >
                Powered by Google Places
              </div>
            </div>
          )}
        </View>

        {/* Etiqueta */}
        <View style={s.fieldGroup}>
          <Text style={[s.label, { color: sub }]}>ETIQUETA *</Text>
          <View style={s.chipRow}>
            {LABEL_OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                onPress={() => setLabel(opt)}
                style={[
                  s.chip,
                  {
                    backgroundColor: label === opt ? PRIMARY : inputBg,
                    borderColor: label === opt ? PRIMARY : inputBorder,
                  },
                ]}
              >
                <Text
                  style={{
                    color: label === opt ? "#fff" : text,
                    fontWeight: "600",
                    fontSize: 13,
                  }}
                >
                  {opt}
                </Text>
              </Pressable>
            ))}
          </View>
          <View
            style={[
              s.inputRow,
              {
                backgroundColor: inputBg,
                borderColor: inputBorder,
                marginTop: 8,
              },
            ]}
          >
            <Feather name="tag" size={16} color={sub} style={s.inputIcon} />
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Casa, Trabajo, etc."
              style={inputStyle}
            />
          </View>
        </View>

        {/* Ciudad + CP */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={[s.fieldGroup, { flex: 2 }]}>
            <Text style={[s.label, { color: sub }]}>CIUDAD</Text>
            <View
              style={[
                s.inputRow,
                { backgroundColor: inputBg, borderColor: inputBorder },
              ]}
            >
              <Feather name="map" size={16} color={sub} style={s.inputIcon} />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={inputStyle}
              />
            </View>
          </View>
          <View style={[s.fieldGroup, { flex: 1 }]}>
            <Text style={[s.label, { color: sub }]}>C.P.</Text>
            <View
              style={[
                s.inputRow,
                { backgroundColor: inputBg, borderColor: inputBorder },
              ]}
            >
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="42001"
                style={{ ...inputStyle, paddingLeft: 12 }}
              />
            </View>
          </View>
        </View>

        {/* Coords */}
        <View style={s.coordsBadge}>
          <Feather name="check-circle" size={13} color="#059669" />
          <Text style={{ color: "#059669", fontSize: 12, marginLeft: 6 }}>
            Ubicación: {coordinates.lat.toFixed(5)},{" "}
            {coordinates.lng.toFixed(5)}
          </Text>
        </View>

        {error && (
          <View style={s.errorBanner}>
            <Feather name="alert-circle" size={15} color="#DC2626" />
            <Text style={{ color: "#DC2626", marginLeft: 8, fontSize: 14 }}>
              {error}
            </Text>
          </View>
        )}

        <Pressable
          onPress={handleSave}
          disabled={loading || success}
          style={[s.saveBtn, (loading || success) && { opacity: 0.6 }]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.saveBtnText}>
              {success
                ? "✓ Guardado"
                : existingAddress?.id
                  ? "Actualizar dirección"
                  : "Guardar dirección"}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", overflow: "hidden" as any },
  sidebar: { width: 280, borderRightWidth: 1, flexDirection: "column" as any },
  sideHeader: { padding: 24, alignItems: "center", borderBottomWidth: 1 },
  avatarWrap: { marginBottom: 12 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  userName: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  userPhone: { fontSize: 13, marginBottom: 10, textAlign: "center" },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  roleBadgeText: { fontSize: 11, fontWeight: "700" },
  sideNav: { flex: 1, paddingVertical: 16 },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  navItemActive: {
    backgroundColor: "#DC262610",
    borderRightWidth: 3,
    borderRightColor: "#DC2626",
  },
  navItemText: { fontSize: 14, fontWeight: "600" },
  sideFooter: { borderTopWidth: 1, padding: 16 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backBtnText: { fontSize: 14, fontWeight: "600" },
  main: { flex: 1, height: "100vh" as any },
  content: { padding: 32, maxWidth: 720, paddingBottom: 160 },
  pageTitle: { fontSize: 22, fontWeight: "800", marginBottom: 24 },
  mapWrapper: {
    height: 260,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16,
    position: "relative",
  } as any,
  mapLoading: {
    position: "absolute",
    inset: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(128,128,128,0.3)",
    zIndex: 10,
  } as any,
  mapHint: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 5,
  } as any,
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 24,
  },
  gpsBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  fieldGroup: { marginBottom: 20 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 10,
    height: 48,
    position: "relative",
  } as any,
  inputIcon: { position: "absolute", left: 10, zIndex: 1 },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  coordsBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  saveBtn: {
    paddingVertical: 16,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  dropdownStyle: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    zIndex: 1000,
    background: "#fff",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
    maxHeight: 240,
    overflowY: "auto" as any,
    overflowX: "hidden",
  },
} as any);